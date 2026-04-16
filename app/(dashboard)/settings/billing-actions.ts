'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutUrl, createCustomerPortalUrl } from '@/lib/lemonsqueezy'

export async function startCheckout(plan: 'starter' | 'pro' | 'agency') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, email, ls_customer_id')
    .eq('owner_id', user.id)
    .single()

  if (!biz) redirect('/dashboard')

  try {
    const url = await createCheckoutUrl({
      plan,
      email: biz.email ?? user.email ?? '',
      businessId: biz.id,
      name: biz.name,
    })
    redirect(url)
  } catch (err) {
    console.error('[billing] createCheckout error:', err)
    redirect('/settings?tab=billing&error=checkout_failed')
  }
}

export async function openCustomerPortal() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: biz } = await supabase
    .from('businesses')
    .select('ls_customer_id')
    .eq('owner_id', user.id)
    .single()

  if (!biz?.ls_customer_id) redirect('/settings?tab=billing')

  try {
    const url = await createCustomerPortalUrl(biz.ls_customer_id)
    redirect(url)
  } catch {
    redirect('/settings?tab=billing&error=portal_failed')
  }
}
