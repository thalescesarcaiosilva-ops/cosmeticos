'use client'

import { useState } from 'react'
import { PolicyLinksManager } from '@/components/admin/PolicyLinksManager'
import { SocialLinksManager } from '@/components/admin/SocialLinksManager'

export function TopBarManagers() {
  const [tab, setTab] = useState<'policy' | 'social'>('policy')

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('policy')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'policy' ? 'border-b-2 border-brand text-brand' : 'text-text-secondary'}`}
        >
          Links de política
        </button>
        <button
          type="button"
          onClick={() => setTab('social')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'social' ? 'border-b-2 border-brand text-brand' : 'text-text-secondary'}`}
        >
          Redes sociais
        </button>
      </div>
      {tab === 'policy' ? <PolicyLinksManager /> : <SocialLinksManager />}
    </div>
  )
}
