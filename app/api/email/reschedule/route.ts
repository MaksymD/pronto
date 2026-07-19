import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingReschedule, formatEmailDate, formatEmailTime } from '@/lib/email'
import { sendTelegramMessage, tplRescheduled, tplRescheduledClient } from '@/lib/telegram'
import { sendViberMessage, tplRescheduled as viberTplRescheduled, tplRescheduledClient as viberTplRescheduledClient } from '@/lib/viber'
import { sendWhatsAppMessage, tplBookingReschedule as waTplReschedule } from '@/lib/whatsapp'

/**
 * POST /api/email/reschedule
 *
 * Sends "booking rescheduled" notifications (owner + client, all connected
 * channels). Must be called AFTER the appointment row has already been
 * updated with the new starts_at/ends_at — this route reads the current
 * (new) time from the database and needs the previous time passed in
 * (oldStartsAt) since that's no longer stored anywhere after the update.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const { appointmentId, oldStartsAt } = await req.json()
        if (!appointmentId || !oldStartsAt) {
            return NextResponse.json({ error: 'missing appointmentId or oldStartsAt' }, { status: 400 })
        }

        const supabase = createServiceClient()

        const { data: appt, error: apptErr } = await supabase
            .from('appointments')
            .select('id, starts_at, business_id, clients(name, email, whatsapp_number, telegram_id, viber_user_id), services(name), employees(name)')
            .eq('id', appointmentId)
            .single()

        if (apptErr) console.error('[email/reschedule] appointment fetch error:', apptErr.message)
        if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 })

        const client = appt.clients as unknown as {
            name: string
            email: string | null
            whatsapp_number: string | null
            telegram_id: string | null
            viber_user_id: string | null
        } | null
        const service = appt.services as unknown as { name: string } | null
        const employee = appt.employees as unknown as { name: string } | null

        const { data: biz } = await supabase
            .from('businesses')
            .select('name, timezone, telegram_bot_token, telegram_chat_id, viber_bot_token, viber_chat_id, meta_whatsapp_phone_number_id, meta_whatsapp_access_token')
            .eq('id', appt.business_id)
            .single()

        const tz = biz?.timezone ?? 'UTC'
        const oldDate = formatEmailDate(oldStartsAt, tz)
        const oldTime = formatEmailTime(oldStartsAt, tz)
        const newDate = formatEmailDate(appt.starts_at, tz)
        const newTime = formatEmailTime(appt.starts_at, tz)

        // Dedup keyed by the specific new time — so rescheduling the same
        // appointment again later still sends a fresh notification.
        const refId = `${appt.id}:${appt.starts_at}`
        const { data: alreadySent } = await supabase
            .from('notification_log')
            .select('id')
            .eq('business_id', appt.business_id)
            .eq('ref_id', refId)
            .eq('type', 'reschedule')
            .eq('channel', 'all')
            .maybeSingle()

        if (alreadySent) {
            return NextResponse.json({ sent: true, note: 'skipped: already sent' })
        }

        // ── Telegram → to owner ────────────────────────────────────────────────
        if (biz?.telegram_bot_token && biz?.telegram_chat_id) {
            await sendTelegramMessage(
                biz.telegram_bot_token,
                biz.telegram_chat_id,
                tplRescheduled({
                    clientName: client?.name ?? 'Walk-in',
                    serviceName: service?.name ?? '—',
                    oldDate, oldTime, newDate, newTime,
                    employeeName: employee?.name,
                })
            )
        }

        // ── Telegram → to client ───────────────────────────────────────────────────
        if (biz?.telegram_bot_token && client?.telegram_id) {
            await sendTelegramMessage(
                biz.telegram_bot_token,
                client.telegram_id,
                tplRescheduledClient({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    newDate, newTime,
                    businessName: biz.name,
                })
            )
        }

        // ── Viber → to owner ───────────────────────────────────────────────────
        if (biz?.viber_bot_token && biz?.viber_chat_id) {
            await sendViberMessage(
                biz.viber_bot_token,
                biz.viber_chat_id,
                viberTplRescheduled({
                    clientName: client?.name ?? 'Walk-in',
                    serviceName: service?.name ?? '—',
                    oldDate, oldTime, newDate, newTime,
                    employeeName: employee?.name,
                })
            )
        }

        // ── Viber → to client ──────────────────────────────────────────────────────
        if (biz?.viber_bot_token && client?.viber_user_id) {
            await sendViberMessage(
                biz.viber_bot_token,
                client.viber_user_id,
                viberTplRescheduledClient({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    newDate, newTime,
                    businessName: biz.name,
                })
            )
        }

        // ── WhatsApp → to client ───────────────────────────────────────────────────
        const waCredentials = biz?.meta_whatsapp_phone_number_id && biz?.meta_whatsapp_access_token
            ? { phoneNumberId: biz.meta_whatsapp_phone_number_id, accessToken: biz.meta_whatsapp_access_token }
            : undefined
        if (client?.whatsapp_number) {
            await sendWhatsAppMessage(
                client.whatsapp_number,
                waTplReschedule({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    newDate, newTime,
                    businessName: biz?.name ?? '',
                }),
                waCredentials
            )
        }

        // ── Email → to client ──────────────────────────────────────────────────────
        if (client?.email) {
            const result = await sendBookingReschedule({
                to: client.email,
                clientName: client.name,
                businessName: biz?.name ?? 'Your appointment',
                serviceName: service?.name ?? '—',
                newDate, newTime,
                employeeName: employee?.name,
            })
            if (result?.error) {
                console.error('[email/reschedule] send error:', result.error)
            }
        }

        const { error: logErr } = await supabase.from('notification_log').insert({
            business_id: appt.business_id,
            ref_id: refId,
            type: 'reschedule',
            channel: 'all',
        })
        if (logErr && logErr.code !== '23505') {
            console.error('[email/reschedule] notification_log insert error:', logErr.message)
        }

        return NextResponse.json({ sent: true })
    } catch (err) {
        console.error('[email/reschedule]', err)
        return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
}