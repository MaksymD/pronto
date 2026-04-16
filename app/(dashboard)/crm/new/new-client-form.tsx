'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DatePicker } from '@/components/ui/date-picker'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface Props {
  businessId: string
}

export function NewClientForm({ businessId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const t = useTranslations('newClient')

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp_number: '',
    birthday: '',
    tags: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const tags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

    const { data: client } = await supabase.from('clients').insert({
      business_id: businessId,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      whatsapp_number: form.whatsapp_number || null,
      birthday: form.birthday || null,
      notes: form.notes || null,
      tags,
    }).select('id').single()

    setSaving(false)
    if (client) router.push(`/crm/${client.id}`)
    else router.push('/crm')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.name')}</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('fields.namePlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.phone')}</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder={t('fields.phonePlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.email')}</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder={t('fields.emailPlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.whatsapp')}</label>
        <input
          type="tel"
          value={form.whatsapp_number}
          onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
          placeholder={t('fields.whatsappPlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.birthday')}</label>
        <DatePicker
          value={form.birthday}
          onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.tags')}</label>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          placeholder={t('fields.tagsPlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.notes')}</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder={t('fields.notesPlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Link
          href="/crm"
          className="flex-1 text-center border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {t('cancelButton')}
        </Link>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? '…' : t('submitButton')}
        </button>
      </div>
    </form>
  )
}
