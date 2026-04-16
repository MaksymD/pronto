/**
 * POST /api/webhooks/lemonsqueezy
 *
 * LemonSqueezy присылает сюда события подписки.
 * Обрабатываем: subscription_created, subscription_updated, subscription_cancelled, subscription_expired
 *
 * Настройка в LS Dashboard:
 *   Settings → Webhooks → Add webhook
 *   URL: https://yourdomain.com/api/webhooks/lemonsqueezy
 *   Secret: значение из LEMONSQUEEZY_WEBHOOK_SECRET в .env
 *   Events: subscription_created, subscription_updated, subscription_cancelled, subscription_expired
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { variantIdToPlan } from '@/lib/lemonsqueezy'

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

// ─── Проверка подписи ─────────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true // в dev-режиме без секрета пропускаем
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
  const digest = hmac.update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
}

// ─── Маппинг статуса подписки → plan ────────────────────────────────────────

function statusToPlan(status: string, variantId: string): string {
  if (['active', 'trialing'].includes(status)) return variantIdToPlan(variantId)
  return 'free' // cancelled, expired, paused, past_due → откатываем на free
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    console.error('[ls/webhook] Invalid signature')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventName = payload.meta && (payload.meta as Record<string, unknown>).event_name as string
  const data      = payload.data as Record<string, unknown> | undefined
  const attrs     = data?.attributes as Record<string, unknown> | undefined

  if (!attrs) return NextResponse.json({ ok: true }) // игнорируем неизвестные события

  console.log('[ls/webhook] Event:', eventName)

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed':
    case 'subscription_unpaused': {
      await handleSubscriptionChange(attrs, 'update')
      break
    }
    case 'subscription_cancelled':
    case 'subscription_expired':
    case 'subscription_paused': {
      await handleSubscriptionChange(attrs, 'cancel')
      break
    }
    case 'order_created': {
      // Разовые покупки (если будут) — можно расширить
      break
    }
    default:
      // Прочие события игнорируем
      break
  }

  return NextResponse.json({ ok: true })
}

// ─── Обновление плана в базе ──────────────────────────────────────────────────

async function handleSubscriptionChange(
  attrs: Record<string, unknown>,
  action: 'update' | 'cancel'
) {
  const supabase = createClient()

  // business_id передаётся как custom_data при создании checkout
  const customData = attrs.first_subscription_item as Record<string, unknown> | undefined
  const meta = attrs as Record<string, unknown>

  // LemonSqueezy кладёт custom в разные места в зависимости от версии API
  // Проверяем несколько мест
  const businessId: string =
    ((meta.custom_data as Record<string, unknown>)?.business_id as string) ??
    ((meta.first_order_item as Record<string, unknown>)?.custom_data as Record<string, unknown>)?.business_id as string ??
    ''

  if (!businessId) {
    console.error('[ls/webhook] No business_id in custom_data. attrs:', JSON.stringify(attrs).slice(0, 300))
    return
  }

  const status    = (attrs.status as string) ?? 'active'
  const variantId = String((attrs.variant_id as number | string) ?? '')
  const endsAt    = (attrs.ends_at as string | null) ?? null
  const renewsAt  = (attrs.renews_at as string | null) ?? null
  const subscriptionId = String(data_id(attrs))

  const newPlan = action === 'cancel' ? 'free' : statusToPlan(status, variantId)
  const expiresAt = action === 'cancel' ? endsAt : (renewsAt ?? null)

  await supabase.from('businesses').update({
    plan: newPlan,
    plan_expires_at: expiresAt,
    ls_subscription_id: subscriptionId,
    ls_customer_id: String((attrs.customer_id as number | string) ?? ''),
    ls_variant_id: variantId,
  }).eq('id', businessId)

  console.log(`[ls/webhook] Business ${businessId} → plan: ${newPlan}, expires: ${expiresAt}`)
}

function data_id(attrs: Record<string, unknown>): string | number {
  return (attrs.id as string | number) ?? ''
}
