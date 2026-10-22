import { AnimatePresence, motion } from 'motion/react'
import { LiveMomo } from '../momo/LiveMomo'
import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { type MomoState } from '../momo/Momo'

/** Page heading: one quiet title, an optional line of context, an optional action. */
export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  )
}

/** What Momo says — plain text, no bubble. */
export function MomoLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={String(children)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className={`font-hand text-[19px] leading-snug text-ink ${className}`}
        aria-live="polite"
      >
        {children}
      </motion.p>
    </AnimatePresence>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto max-w-sm rounded-full px-5 py-2.5 text-left text-sm shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] ${t.kind === 'error' ? 'border-[1.5px] border-ink bg-surface text-ink' : 'bg-ink text-white'}`}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Accessible modal sheet — bottom sheet on phones, centred on larger screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const timer = setTimeout(() => {
      const el = ref.current
      ;(el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('input, textarea, select, button'))?.focus()
    }, 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[24px]"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-[20px]">{title}</h2>
              <button className="icon-btn -mt-2 -mr-2 text-muted" onClick={onClose} aria-label={t('common.close')}>
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Confirm({ open, title, body, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-ink-2">{body}</p>
      <div className="mt-7 flex flex-wrap justify-end gap-2">
        <button className="btn btn-quiet" onClick={onCancel} data-autofocus>{t('common.keep')}</button>
        <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Sheet>
  )
}

export function EmptyState({ momo = 'resting', art, title, children }: { momo?: MomoState; art?: ReactNode; title: string; children?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center px-6 pt-6 pb-10 text-center">
      {art ?? <div className="w-32"><LiveMomo state={momo} label={t('home.petMomo')} ground /></div>}
      <h2 className="mt-6 text-[19px]">{title}</h2>
      <div className="mt-2 max-w-xs text-sm text-muted">{children}</div>
    </div>
  )
}

/** A few tiny hearts — used when saving favourites. */
export function HeartBurst({ show }: { show: number }) {
  if (!show) return null
  return (
    <span key={show} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute h-3.5 w-3.5"
          initial={{ y: 0, x: 0, opacity: 1, scale: 0.6 }}
          animate={{ y: -26 - i * 4, x: (i - 1) * 14, opacity: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.06 }}
        >
          <path d="M12 7 C 12 2, 21 2, 21 8.5 C 21 14, 12 20, 12 20 C 12 20, 3 14, 3 8.5 C 3 2, 12 2, 12 7 Z" fill="#1F1F1F" stroke="#1F1F1F" strokeWidth={1.6} />
        </motion.svg>
      ))}
    </span>
  )
}

/** A thin hand-drawn arrow, used for list rows. */
export function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M4 10.5 C 8 10, 12 10.2, 15.5 10 M12 6.5 L 16 10 L 12 13.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
