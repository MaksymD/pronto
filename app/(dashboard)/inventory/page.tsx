import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Plus, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { InventoryList } from './inventory-list'

export default async function InventoryPage() {
  const supabase = createClient()
  const t = await getTranslations('inventory')
  const { data: { user } } = await supabase.auth.getUser()

  const { data: business } = await supabase
    .from('businesses').select('id, currency').eq('owner_id', user!.id).maybeSingle()

  if (!business) return null

  const { data: items } = await supabase.from('inventory_items')
    .select('id, name, sku, category, unit, quantity, low_stock_threshold, cost_price, sell_price')
    .eq('business_id', business.id).order('name')

  const lowStockCount = items?.filter((i) => i.quantity <= i.low_stock_threshold).length ?? 0

  return (
    <>
      <Header
        title={t('title')}
        actions={
          <Link href="/inventory/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('addItem')}</Button>
          </Link>
        }
      />
      <main className="p-6">
        {lowStockCount > 0 && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {lowStockCount === 1
              ? t('lowStockAlert', { count: lowStockCount })
              : t('lowStockAlertPlural', { count: lowStockCount })}
          </div>
        )}

        <InventoryList items={items ?? []} currency={business.currency} />
      </main>
    </>
  )
}
