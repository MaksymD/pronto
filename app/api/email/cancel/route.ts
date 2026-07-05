import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendBookingCancellation, formatEmailDate, formatEmailTime } from '@/lib/email'
import { sendTelegramMessage, tplCancelled, tplCancelledClient } from '@/lib/telegram'
import { sendViberMessage, tplCancelled as viberTplCancelled, tplCancelledClient as viberTplCancelledClient } from '@/lib/viber'
import { sendWhatsAppMessage, tplBookingCancellation as waTplCancellation } from '@/lib/whatsapp'

/**
 * POST /api/email/cancel
 *
 * Sends cancellation notifications (owner + client, all connected channels)
 * for an appointment. Must be called BEFORE the appointment row is deleted —
 * it reads the appointment/client/business data that a delete would remove.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }

        const { appointmentId } = await req.json()
        if (!appointmentId) return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })

        const supabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: appt, error: apptErr } = await supabase
            .from('appointments')
            .select('id, starts_at, business_id, clients(name, email, whatsapp_number, telegram_id, viber_user_id), services(name), employees(name)')
            .eq('id', appointmentId)
            .single()

        if (apptErr) console.error('[email/cancel] appointment fetch error:', apptErr.message)
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
        const date = formatEmailDate(appt.starts_at, tz)
        const time = formatEmailTime(appt.starts_at, tz)

        // Dedup — avoid sending twice if the appointment is cancelled via status
        // AND then deleted, or if cancelled status is set more than once.
        const { data: alreadySent } = await supabase
            .from('notification_log')
            .select('id')
            .eq('business_id', appt.business_id)
            .eq('ref_id', appt.id)
            .eq('type', 'cancel')
            .eq('channel', 'all')
            .maybeSingle()

        if (alreadySent) {
            return NextResponse.json({ sent: true, note: 'skipped: already sent' })
        }

        // ── Telegram → владельцу ────────────────────────────────────────────────
        if (biz?.telegram_bot_token && biz?.telegram_chat_id) {
            await sendTelegramMessage(
                biz.telegram_bot_token,
                biz.telegram_chat_id,
                tplCancelled({
                    clientName: client?.name ?? 'Walk-in',
                    serviceName: service?.name ?? '—',
                    date,
                    time,
                    employeeName: employee?.name,
                })
            )
        }

        // ── Telegram → клиенту ───────────────────────────────────────────────────
        if (biz?.telegram_bot_token && client?.telegram_id) {
            await sendTelegramMessage(
                biz.telegram_bot_token,
                client.telegram_id,
                tplCancelledClient({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    date,
                    time,
                    businessName: biz.name,
                })
            )
        }

        // ── Viber → владельцу ───────────────────────────────────────────────────
        if (biz?.viber_bot_token && biz?.viber_chat_id) {
            await sendViberMessage(
                biz.viber_bot_token,
                biz.viber_chat_id,
                viberTplCancelled({
                    clientName: client?.name ?? 'Walk-in',
                    serviceName: service?.name ?? '—',
                    date,
                    time,
                    employeeName: employee?.name,
                })
            )
        }

        // ── Viber → клиенту ──────────────────────────────────────────────────────
        if (biz?.viber_bot_token && client?.viber_user_id) {
            await sendViberMessage(
                biz.viber_bot_token,
                client.viber_user_id,
                viberTplCancelledClient({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    date,
                    time,
                    businessName: biz.name,
                })
            )
        }

        // ── WhatsApp → клиенту ───────────────────────────────────────────────────
        const waCredentials = biz?.meta_whatsapp_phone_number_id && biz?.meta_whatsapp_access_token
            ? { phoneNumberId: biz.meta_whatsapp_phone_number_id, accessToken: biz.meta_whatsapp_access_token }
            : undefined
        if (client?.whatsapp_number) {
            await sendWhatsAppMessage(
                client.whatsapp_number,
                waTplCancellation({
                    clientName: client.name,
                    serviceName: service?.name ?? '—',
                    date,
                    time,
                    businessName: biz?.name ?? '',
                }),
                waCredentials
            )
        }

        // ── Email → клиенту ──────────────────────────────────────────────────────
        if (client?.email) {
            const result = await sendBookingCancellation({
                to: client.email,
                clientName: client.name,
                businessName: biz?.name ?? 'Your appointment',
                serviceName: service?.name ?? '—',
                date,
                time,
                employeeName: employee?.name,
            })
            if (result?.error) {
                console.error('[email/cancel] send error:', result.error)
            }
        }

        // Record after sending, so a failed attempt (e.g. before any channel fired)
        // can still be retried — matches the pattern used by /api/email/confirm.
        const { error: logErr } = await supabase.from('notification_log').insert({
            business_id: appt.business_id,
            ref_id: appt.id,
            type: 'cancel',
            channel: 'all',
        })
        if (logErr && logErr.code !== '23505') {
            console.error('[email/cancel] notification_log insert error:', logErr.message)
        }

        return NextResponse.json({ sent: true })
    } catch (err) {
        console.error('[email/cancel]', err)
        return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
}