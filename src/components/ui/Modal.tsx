'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (visible) {
      closeRef.current?.focus()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mounted, visible, onClose])

  if (!mounted || typeof document === 'undefined') return null

  const maxWidth = size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-label="Fechar"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl bg-surface shadow-2xl transition-all duration-300 ease-out sm:rounded-xl ${maxWidth} ${
          visible
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-6 opacity-0 sm:translate-y-2 sm:scale-[0.98]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-text-primary">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted"
            aria-label="Fechar modal"
          >
            <span className="text-2xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
