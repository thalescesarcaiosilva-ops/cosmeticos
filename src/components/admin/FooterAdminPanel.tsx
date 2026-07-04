'use client'

import { useState } from 'react'
import { FooterAssetsManager } from '@/components/admin/FooterAssetsManager'
import { FooterConfigForm } from '@/components/admin/FooterConfigForm'
import { FooterMenusManager } from '@/components/admin/FooterMenusManager'

const TABS = [
  { id: 'config', label: 'Configurações' },
  { id: 'menus', label: 'Menus' },
  { id: 'security', label: 'Selos' },
] as const

type TabId = (typeof TABS)[number]['id']

export function FooterAdminPanel() {
  const [tab, setTab] = useState<TabId>('menus')

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap gap-2 border-b border-border pb-3"
        aria-label="Seções do rodapé"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'config' && <FooterConfigForm />}
      {tab === 'menus' && <FooterMenusManager />}
      {tab === 'security' && (
        <FooterAssetsManager assetType="security" title="Selo de segurança" />
      )}
    </div>
  )
}
