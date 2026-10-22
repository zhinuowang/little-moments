import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { ActivityCard, useLocalized } from '../components/ActivityBits'
import { ActivityArt, CategoryArt } from '../components/art/Icons'
import { Confirm, EmptyState, PageTitle, Sheet } from '../components/ui/Bits'
import { ACTIVITY_BY_ID } from '../data/activities'
import { CATEGORIES } from '../data/meta'
import { useI18n, type Key } from '../i18n'
import { play } from '../lib/sound'
import { prettyDate, toISODate, uid } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'
import type { Activity, CategoryId, Plan } from '../types'

type Cat = Exclude<CategoryId, 'nothing'>
const PLAN_CATS = CATEGORIES.filter((c) => c.id !== 'nothing').map((c) => c.id as Cat)

function usePlanInfo() {
  const loc = useLocalized()
  const { t } = useI18n()
  return (p: Plan) => {
    const base = p.activityId ? ACTIVITY_BY_ID[p.activityId] : undefined
    const a: Activity | undefined = base ? loc(base) : undefined
    return {
      a,
      title: a?.title ?? p.custom?.title ?? t('plans.untitled'),
      note: a?.description ?? p.custom?.note ?? '',
      category: (a?.category ?? p.custom?.category ?? 'slow') as Cat,
    }
  }
}

export function Plans() {
  const { plans, savePlan, removePlan, toast } = useApp()
  const { t } = useI18n()
  const info = usePlanInfo()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Plan | null>(null)
  const [removing, setRemoving] = useState<Plan | null>(null)

  const groups = PLAN_CATS.map((c) => ({
    c,
    items: plans.filter((p) => info(p).category === c).sort((x, y) => (x.date ?? '9999').localeCompare(y.date ?? '9999')),
  })).filter((g) => g.items.length)

  const journalFor = (p: Plan) => {
    const { a, title } = info(p)
    navigate(a ? `journal/new?activity=${a.id}` : `journal/new?title=${encodeURIComponent(title)}`)
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={t('plans.title')} subtitle={t('plans.subtitle')}>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ {t('plans.add')}</button>
      </PageTitle>

      {plans.length === 0 ? (
        <EmptyState momo="curious" title={t('plans.empty.title')}>
          <p>{t('plans.empty.body')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-1">
            <button className="btn btn-primary" onClick={() => navigate('discover')}>{t('plans.browse')}</button>
            <button className="btn btn-quiet" onClick={() => setAdding(true)}>{t('plans.addOwn')}</button>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {groups.map(({ c, items }) => (
            <section key={c} aria-label={t(`cat.${c}` as Key)}>
              <h2 className="eyebrow mb-1">{t(`cat.${c}` as Key)}</h2>
              <ul className="divide-y divide-line">
                {items.map((p) => {
                  const { a, title } = info(p)
                  return (
                    <motion.li key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 py-4">
                      <ActivityArt icon={a?.icon ?? 'star'} className="h-9 w-9 shrink-0" />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(p)}>
                        <span className="block truncate font-hand text-[16px] leading-snug text-ink">{title}</span>
                        {p.date && <span className="block text-[12px] text-muted">{prettyDate(p.date)}</span>}
                      </button>
                      <span className="flex shrink-0 items-center">
                        {a && <button className="btn btn-quiet btn-sm" onClick={() => navigate(`ritual/${a.id}`)}>{t('plans.start')}</button>}
                        <button className="icon-btn text-faint hover:text-ink" onClick={() => setRemoving(p)} aria-label={`${t('common.remove')}: ${title}`}>
                          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        </button>
                      </span>
                    </motion.li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AddPlanSheet open={adding} onClose={() => setAdding(false)} onSave={async (p) => { await savePlan(p); play('pop'); toast(t('plans.added'), 'love'); setAdding(false) }} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? info(open).title : ''}>
        {open && <PlanDetails plan={open} onChange={async (p) => { await savePlan(p); setOpen(p) }} onJournal={() => journalFor(open)} />}
      </Sheet>

      <Confirm
        open={!!removing}
        title={t('plans.removeTitle')}
        body={removing ? t('plans.removeBody', { t: info(removing).title }) : ''}
        confirmLabel={t('common.remove')}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => { if (removing) await removePlan(removing.id); setRemoving(null); toast(t('plans.removed')) }}
      />
    </div>
  )
}

function PlanDetails({ plan, onChange, onJournal }: { plan: Plan; onChange: (p: Plan) => void; onJournal: () => void }) {
  const { t } = useI18n()
  const info = usePlanInfo()
  const { a, note } = info(plan)
  return (
    <div>
      {a ? (
        <div className="-mx-2"><ActivityCard activity={ACTIVITY_BY_ID[a.id]} /></div>
      ) : (
        <p className="whitespace-pre-wrap text-ink-2">{note || t('plans.noNotes')}</p>
      )}
      <label className="mt-6 block">
        <span className="label">{t('plans.pencil')} {t('common.optional')}</span>
        <div className="flex gap-2">
          <input type="date" className="field" value={plan.date ?? ''} min={toISODate()} onChange={(e) => onChange({ ...plan, date: e.target.value || undefined })} />
          {plan.date && <button className="btn btn-quiet btn-sm" onClick={() => onChange({ ...plan, date: undefined })}>{t('common.clear')}</button>}
        </div>
      </label>
      <div className="mt-7 flex flex-wrap justify-end gap-1">
        {a && <button className="btn btn-quiet" onClick={() => navigate(`ritual/${a.id}`)}>{t('plans.startNow')}</button>}
        <button className="btn btn-primary" onClick={onJournal}>{t('plans.write')}</button>
      </div>
    </div>
  )
}

function AddPlanSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (p: Plan) => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<Cat>('slow')
  const [date, setDate] = useState('')
  const [error, setError] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError(true); return }
    onSave({ id: uid(), createdAt: Date.now(), date: date || undefined, custom: { title: title.trim(), note: note.trim(), category } })
    setTitle(''); setNote(''); setDate(''); setError(false)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('plans.addTitle')}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <label className="block">
          <span className="label">{t('plans.what')}</span>
          <input className="field" value={title} maxLength={60} onChange={(e) => { setTitle(e.target.value); setError(false) }} placeholder={t('plans.whatPh')} aria-invalid={error} aria-describedby={error ? 'plan-err' : undefined} data-autofocus />
          {error && <span id="plan-err" className="mt-1.5 block text-[13px] text-ink">{t('plans.nameFirst')}</span>}
        </label>
        <label className="block">
          <span className="label">{t('plans.notes')} {t('common.optional')}</span>
          <textarea className="field min-h-20" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t('plans.notesPh')} />
        </label>
        <div role="radiogroup" aria-label={t('plans.kind')}>
          <span className="label">{t('plans.kind')}</span>
          <div className="flex flex-wrap gap-1">
            {PLAN_CATS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={category === c} className="chip" onClick={() => setCategory(c)}>
                <CategoryArt category={c} className="h-4 w-4" />{t(`cat.${c}` as Key)}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">{t('plans.date')} {t('common.optional')}</span>
          <input type="date" className="field" value={date} min={toISODate()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="flex justify-end gap-1 pt-2">
          <button type="button" className="btn btn-quiet" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('plans.addBtn')}</button>
        </div>
      </form>
    </Sheet>
  )
}
