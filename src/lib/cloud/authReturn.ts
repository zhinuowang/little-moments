/**
 * Coming back from a sign-in link or Google, the URL carries credentials or an error:
 *   ?token_hash=…&type=email             (email sign-in link — verified by the app itself)
 *   ?code=…                              (Google, PKCE)
 *   #access_token=…&refresh_token=…      (email link, implicit)
 *   #error=…&error_description=…  or  ?error=…
 * This runs before the app renders: it takes them out of the address bar (so they never stay
 * in history or reach the #/ router) and keeps them in memory for the auth provider.
 */

export type AuthReturn =
  | { kind: 'hash'; tokenHash: string; type: 'email' | 'signup' | 'magiclink' }
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string; description: string }

const RETURN_ROUTE_KEY = 'lm-auth-return'

let pending: AuthReturn | null = null

export function captureAuthReturn() {
  const url = new URL(window.location.href)
  const q = url.searchParams
  const frag = new URLSearchParams(url.hash.startsWith('#/') ? '' : url.hash.slice(1))

  const type = q.get('type')
  if (q.get('token_hash')) {
    pending = { kind: 'hash', tokenHash: q.get('token_hash')!, type: type === 'signup' || type === 'magiclink' ? type : 'email' }
  } else if (q.get('code')) pending = { kind: 'code', code: q.get('code')! }
  else if (frag.get('access_token') && frag.get('refresh_token')) {
    pending = { kind: 'tokens', accessToken: frag.get('access_token')!, refreshToken: frag.get('refresh_token')! }
  } else if (q.get('error') || frag.get('error')) {
    const src = q.get('error') ? q : frag
    pending = { kind: 'error', code: src.get('error_code') ?? src.get('error') ?? 'unknown', description: src.get('error_description') ?? '' }
  }
  if (!pending) return

  let route = '#/'
  try { route = localStorage.getItem(RETURN_ROUTE_KEY) || route; localStorage.removeItem(RETURN_ROUTE_KEY) } catch { /* fine */ }
  window.history.replaceState(null, '', url.pathname + route)
}

/** Hands over (once) whatever the URL brought back. */
export function takeAuthReturn() {
  const p = pending
  pending = null
  return p
}

/** Where to land after the round trip — the page the person started signing in from. */
export function rememberReturnRoute() {
  try { localStorage.setItem(RETURN_ROUTE_KEY, window.location.hash.startsWith('#/') ? window.location.hash : '#/') } catch { /* fine */ }
}
