import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLowStockAlert } from '@/lib/email'
import { sendTelegramMessage, tplLowStock } from '@/lib/telegram'
import { sendViberMessage, tplLowStock as viberTplLowStock } from '@/lib/viber'
import { sendWhatsAppMessage, tplLowStock as waTplLowStock } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'missing itemId' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: item } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, unit, low_stock_threshold, business_id')
      .eq('id', itemId)
      .single()

    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (item.quantity > item.low_stock_threshold) return NextResponse.json({ skipped: 'stock ok' })

    // Dedup — один алерт на каждый уровень остатка
    const { error: logErr } = await supabase.from('notification_log').insert({
      business_id: item.business_id,
      ref_id: `low_stock_${item.id}_${item.quantity}`,
      type: 'low_stock',
      channel: 'email',
    })
    if (logErr) return NextResponse.json({ skipped: 'already alerted at this level' })

    const { data: biz } = await supabase
      .from('businesses')
      .select('name, email, telegram_bot_token, telegram_chat_id, viber_bot_token, viber_chat_id, owner_whatsapp')
      .eq('id', item.business_id)
      .single()

    // ── Telegram → владельцу ─────────────────────────────────────────────────
    if (biz?.telegram_bot_token && biz?.telegram_chat_id) {
      await sendTelegramMessage(
        biz.telegram_bot_token,
        biz.telegram_chat_id,
        tplLowStock({
          itemName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          threshold: item.low_stock_threshold,
        })
      )
    }

    // ── Viber → владельцу ────────────────────────────────────────────────────
    if (biz?.viber_bot_token && biz?.viber_chat_id) {
      await sendViberMessage(
        biz.viber_bot_token,
        biz.viber_chat_id,
        viberTplLowStock({
          itemName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          threshold: item.low_stock_threshold,
        })
      )
    }

    // ── WhatsApp → владельцу ─────────────────────────────────────────────────
    if (biz?.owner_whatsapp) {
      await sendWhatsAppMessage(
        biz.owner_whatsapp,
        waTplLowStock({
          itemName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          threshold: item.low_stock_threshold,
        })
      )
    }

    // ── Email → владельцу ────────────────────────────────────────────────────
    if (!biz?.email) return NextResponse.json({ tg: true, email: 'skipped: no business email' })

    await sendLowStockAlert({
      to: biz.email,
      businessName: biz.name,
      items: [{
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        threshold: item.low_stock_threshold,
      }],
    })

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('[email/low-stock]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
