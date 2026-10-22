import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { localizeActivity } from '../data/activities'
import { useDuration, useI18n, type Key } from '../i18n'
import { play } from '../lib/sound'
import { uid } from '../lib/util'
import { useApp } from '../store/AppContext'
import type { Activity } from '../types'
import { ActivityArt, Heart } from './art/Icons'
import { HeartBurst } from './ui/Bits'

/** The activity, in the current language. */
export function useLocalized() {
  const { lang } = useI18n()
  return (a: Activity) => localizeActivity(a, lang)
}

/** "20 min · indoors · free" — one quiet line instead of badges. */
export function MetaLine({ a, className = '' }: { a: Activity; className?: string }) {
  const { t } = useI18n()
  const dur = useDuration()
  return (
    <p className={`text-[13px] text-muted ${className}`}>
      {dur(a.minutes)} · {t(a.place === 'indoor' ? 'act.indoor' : 'act.outdoor')} · {t(a.cost === 'free' ? 'act.free' : 'act.paid')}
    </p>
  )
}

/** A heart toggle that saves the idea to Plans. */
export function SaveButton({ a, withLabel }: { a: Activity; withLabel?: boolean }) {
  const { isSaved, plans, savePlan, removePlan, toast } = useApp()
  const { t } = useI18n()
  const [burst, setBurst] = useState(0)
  const saved = isSaved(a.id)
  const toggle = async () => {
    if (saved) {
      const p = plans.find((x) => x.activityId === a.id)
      if (p) await removePlan(p.id)
      toast(t('act.removedToast'))
    } else {
      await savePlan({ id: uid(), activityId: a.id, createdAt: Date.now() })
      setBurst((b) => b + 1)
      play('pop')
      toast(t('act.savedToast'), 'love')
    }
  }
  const label = saved ? t('act.saved') : t('act.save')
  return (
    <button className={withLabel ? 'btn btn-quiet relative' : 'icon-btn relative'} onClick={toggle} aria-pressed={saved} aria-label={withLabel ? undefined : label} title={label}>
      <HeartBurst show={burst} />
      <Heart className="h-5 w-5" filled={saved} />
      {withLabel && <span>{label}</span>}
    </button>
  )
}

/** A small printed card: doodle, title, a line or two, and the how-to tucked away. */
export function ActivityCard({ activity, corner, actions }: { activity: Activity; corner?: ReactNode; actions?: ReactNode }) {
  const { t } = useI18n()
  const loc = useLocalized()
  const a = loc(activity)
  const [open, setOpen] = useState(false)
  return (
    <article className="card relative px-6 pt-7 pb-6 sm:px-8">
      {corner}
      <ActivityArt icon={a.icon} className="h-14 w-14" />
      <p className="eyebrow mt-4">{t(`cat.${a.category}` as Key)}</p>
      <h2 className="mt-1 text-[23px] leading-snug">{a.title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a.description}</p>
      <MetaLine a={a} className="mt-3" />

      <button className="mt-4 font-hand text-[15px] text-ink underline decoration-faint underline-offset-4 hover:decoration-ink" aria-expanded={open} onClick={() => { play('flip'); setOpen((o) => !o) }}>
        {open ? t('act.hide') : t('act.howItGoes')}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <ol className="mt-4 space-y-2.5">
              {a.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] text-ink-2">
                  <span className="w-4 shrink-0 text-right text-muted">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {a.materials?.length ? (
              <p className="mt-4 text-[13px] text-muted">{t('act.youMightWant')}: {a.materials.join(' · ')}</p>
            ) : null}
            <p className="mt-2 text-[13px] text-muted">{t('act.noPressure')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {actions && <div className="mt-7 flex flex-wrap items-center gap-2">{actions}</div>}
    </article>
  )
}
