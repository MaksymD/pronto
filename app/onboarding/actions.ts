'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function completeOnboarding(data: {
  bizType: string
  serviceName: string
  servicePrice: number
  serviceDuration: number
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/login')

  await supabase.from('businesses').update({
    ...(data.bizType ? { type: data.bizType } : {}),
    onboarding_completed: true,
  }).eq('id', business.id)

  if (data.serviceName && data.servicePrice) {
    await supabase.from('services').insert({
      business_id: business.id,
      name: data.serviceName,
      price: data.servicePrice,
      duration_min: data.serviceDuration || 60,
    })
  }

  redirect('/dashboard')
}
