import { motion } from 'motion/react'
import { useI18n, type Key } from '../../i18n'

/*
  Momo's yarn, used as a quiet UI motif: a little ball for the wordmark,
  a loose thread for dividers, and a thread with knots for the three steps.
*/
const INK = '#1F1F1F'

export function YarnDot({ className = 'h-[0.5em] w-[0.5em]' }: { className?: string }) {
  return (
    <svg viewBox="-16 -16 32 32" className={className} aria-hidden="true">
      <circle r={13} fill="#fff" stroke={INK} strokeWidth={3.6} />
      <g fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
        <path d="M -9 -5 Q 0 -12 10 -3" /><path d="M -11 2 Q 0 -5 11 4" /><path d="M -8 8 Q 1 2 9 9" />
      </g>
    </svg>
  )
}

/** A loose strand of yarn with one small loop — a soft divider. */
export function YarnThread({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 16" preserveAspectRatio="none" className={`h-4 w-40 ${className}`} aria-hidden="true">
      <path d="M2 9 C 24 4, 40 13, 62 8 C 74 5, 80 2, 78 7 C 76 12, 70 10, 72 6 C 76 0, 100 12, 122 8 S 150 6, 158 9" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

export type Step = 0 | 1 | 2

/** Feeling → Choose → Draw, strung on one thread. Earlier steps are tappable. */
export function YarnSteps({ step, onStep }: { step: Step; onStep?: (s: Step) => void }) {
  const { t } = useI18n()
  const labels: Key[] = ['flow.feel', 'flow.choose', 'flow.draw']
  const xs = [20, 110, 200]
  return (
    <nav aria-label={t('flow.steps')} className="mx-auto w-full max-w-[16rem]">
      <svg viewBox="0 0 220 22" className="h-5 w-full overflow-visible" aria-hidden="true">
        <path d="M 6 12 C 40 6, 70 17, 110 11 S 180 6, 214 12" fill="none" stroke="#B8B8B3" strokeWidth={1.8} strokeLinecap="round" />
        <motion.path
          d="M 6 12 C 40 6, 70 17, 110 11 S 180 6, 214 12"
          fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round"
          initial={false}
          animate={{ pathLength: [0.09, 0.5, 0.91][step] }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        />
        {xs.map((x, i) => (
          i === step
            ? <g key={i} transform={`translate(${x} 11) scale(0.62)`}><circle r={13} fill="#fff" stroke={INK} strokeWidth={3.6} /><path d="M -9 -5 Q 0 -12 10 -3 M -11 2 Q 0 -5 11 4 M -8 8 Q 1 2 9 9" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" /></g>
            : <circle key={i} cx={x} cy={11} r={4} fill={i < step ? INK : '#fff'} stroke={i < step ? INK : '#B8B8B3'} strokeWidth={2} />
        ))}
      </svg>
      <ol className="mt-1 grid grid-cols-3 text-[12px]">
        {labels.map((k, i) => {
          const label = t(k)
          const cls = `${i === 0 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'} ${i === step ? 'text-ink' : 'text-faint'}`
          return (
            <li key={k} className={cls} aria-current={i === step ? 'step' : undefined}>
              {onStep && i < step ? <button className="underline decoration-faint underline-offset-2 hover:text-ink" onClick={() => onStep(i as Step)}>{label}</button> : label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
