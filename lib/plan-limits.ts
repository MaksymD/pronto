/**
 * lib/plan-limits.ts
 * Серверные хелперы для проверки лимитов плана.
 * Использовать в Server Actions и API-роутах.
 *
 * В self-hosted режиме (NEXT_PUBLIC_DEPLOYMENT_MODE != 'saas') все лимиты отключены.
 */

import { PLAN_LIMITS } from './lemonsqueezy'

export interface PlanCheck {
  allowed: boolean
  limit: number
  current: number
  plan: string
}

const isSelfHosted = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE !== 'saas'

/**
 * Проверить, можно ли добавить сотрудника
 */
export async function checkEmployeeLimit(
  supabase: ReturnType<typeof import('./supabase/server').createClient>,
  businessId: string,
  plan: string
): Promise<PlanCheck> {
  if (isSelfHosted) return { allowed: true, limit: Infinity, current: 0, plan }

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const { count } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)

  const current = count ?? 0
  return {
    allowed: current < limits.employees,
    limit: limits.employees,
    current,
    plan,
  }
}

/**
 * Проверить, можно ли добавить клиента
 */
export async function checkClientLimit(
  supabase: ReturnType<typeof import('./supabase/server').createClient>,
  businessId: string,
  plan: string
): Promise<PlanCheck> {
  if (isSelfHosted) return { allowed: true, limit: Infinity, current: 0, plan }

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)

  const current = count ?? 0
  return {
    allowed: current < limits.clients,
    limit: limits.clients,
    current,
    plan,
  }
}
