import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED = ['en', 'es', 'de', 'ua'] as const
type Locale = (typeof SUPPORTED)[number]

export default getRequestConfig(async () => {
  const raw = cookies().get('dashboard_locale')?.value ?? 'ua'
  const locale: Locale = (SUPPORTED as readonly string[]).includes(raw) ? (raw as Locale) : 'ua'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
