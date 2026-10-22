/** Soft synthesized sounds — no audio files, nothing fetched. */
let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(v: boolean) { enabled = v }

function ac() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.06) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export type Sfx = 'tap' | 'pop' | 'save' | 'stamp' | 'chime' | 'pour' | 'mew' | 'flip'

export function play(s: Sfx) {
  if (!enabled) return
  try {
    switch (s) {
      case 'tap': tone(660, 0, 0.08, 'triangle', 0.035); break
      case 'flip': tone(520, 0, 0.06, 'triangle', 0.03); tone(780, 0.05, 0.08, 'triangle', 0.03); break
      case 'pop': tone(880, 0, 0.1, 'sine', 0.05); tone(1320, 0.05, 0.12, 'sine', 0.03); break
      case 'save': tone(784, 0, 0.18); tone(988, 0.1, 0.18); tone(1175, 0.2, 0.3); break
      case 'stamp': tone(140, 0, 0.18, 'triangle', 0.12); tone(90, 0.02, 0.2, 'sine', 0.1); break
      case 'chime': tone(1047, 0, 0.6, 'sine', 0.05); tone(1319, 0.25, 0.7, 'sine', 0.04); tone(1568, 0.5, 0.9, 'sine', 0.035); break
      case 'pour': for (let i = 0; i < 8; i++) tone(400 + Math.random() * 500, i * 0.08, 0.09, 'sine', 0.02); break
      case 'mew': {
        const c = ac(); if (!c) break
        const t = c.currentTime
        const o = c.createOscillator(); const g = c.createGain()
        o.type = 'triangle'
        o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1000, t + 0.08); o.frequency.linearRampToValueAtTime(620, t + 0.25)
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.35)
        break
      }
    }
  } catch { /* sound is a nicety; never break the app over it */ }
}
