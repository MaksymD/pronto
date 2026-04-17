import { unstable_cache } from 'next/cache'
import { createServiceClient } from './supabase/service'

export type TenantBusiness = {
  id: string
  name: string
  slug: string
}

/**
 * Look up a business by subdomain slug.
 * Cached for 60 seconds via Next.js Data Cache.
 * Use in Server Components / Route Handlers only — not in middleware.
 * Middleware does its own in-memory caching (see middleware.ts).
 */
export const getTenantBySubdomain = unstable_cache(
  async (subdomain: string): Promise<TenantBusiness | null> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('businesses')
      .select('id, name, slug')
      .eq('slug', subdomain)
      .maybeSingle()
    return data ?? null
  },
  ['tenant-by-subdomain'],
  { revalidate: 60, tags: ['tenants'] }
)
