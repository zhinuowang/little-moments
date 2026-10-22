# Sign-in — Google or guest

**Current decision (2026-10-22, Phase 3A):** two ways in — **Continue with Google** or **Continue as
Guest**. Email sign-in (magic link and code) has been removed from the app. Data separation and
sync design: [SYNC.md](SYNC.md).

- **Guest** (default): no account; everything stays in this browser (`little-moments` database,
  exactly as v1.0.0). Never uploaded automatically.
- **Google**: Supabase Auth with Google OAuth, PKCE (`?code=` returns to the app's own address —
  `http://localhost:5173/` in development, `https://zhinuowang.github.io/little-moments/` live — and
  the app exchanges it). The button only works when Google is enabled in Supabase *and* reachable
  on the current network; otherwise it explains and guest mode remains.
- Returning Google users are restored from the saved session (also offline) and skip the welcome
  screen. If a session ends, the app shows the guest diary with a note; the account's local data
  stays on the device and comes back on the next sign-in.
- Mainland China: Google is unreachable there (measured below), so guest mode is the option.

The sections below are the history of the earlier email work, kept for reference.

---

# Sign-in design — North America and mainland China

Status: design approved for Phase 2 on `develop`. Nothing here is live on the public site.

## Ways to use Little Moments

| Way | Role | Works in mainland China? |
| --- | --- | --- |
| **Guest** (default) | No sign-in. Everything stays in this browser, exactly like v1.0.0. | Yes — no network needed after the first load |
| **Email link** (primary) | Type an email, open the **sign-in link** it receives. No password. | Depends on email delivery to QQ / 163 — to be measured with real inboxes |
| **Continue with Google** (optional) | One tap where Google is reachable. | **No** — 0 of 8 mainland probes reached `accounts.google.com` (2026-10-22) |

**Entry flow (2026-10-22 decision):** a first-time visitor sees a welcome screen with Momo and
two choices — *Continue with Email* or *Continue as Guest*. The choice is remembered on the device
(`lm-entry`); people who already have data on the device, signed-in people, and builds without
Supabase settings never see it. Settings → Account → *Show the welcome screen* brings it back.

**Why a token-hash link:** the email links to the app's own address with a one-time `token_hash`;
only the app's `verifyOtp({ token_hash, type: 'email' })` call signs in. Typing an email signs no
one in. It works when the link is opened in another browser or a mail app, no session tokens appear
in the address bar, and mail scanners (Outlook Safe Links, QQ) that pre-open links can't use it up,
because opening the page alone doesn't verify anything.

## Measured reachability from mainland China (2026-10-22, Globalping, 8 probes each)

| Address | Reached | Time |
| --- | --- | --- |
| `zhinuowang.github.io/little-moments/` (GitHub Pages) | 7 / 8 | 0.5–3.9 s (one Ningbo probe timed out) |
| `supabase.co` | 8 / 8 | 0.2–0.4 s |
| `accounts.google.com` | 0 / 8 | TCP connection timed out everywhere |

| Project auth API `jcvtizdyqwjiqpvjepna.supabase.co/auth/v1/health` (US West) | 8 / 8 | 0.35–1.9 s |
| Project data API `jcvtizdyqwjiqpvjepna.supabase.co/rest/v1/` | 8 / 8 | 0.18–1.5 s |

(Project rows measured later the same day; HTTP 401 there is the expected "no key" answer, which
proves the server responded.)

Probes are mostly Tencent / Alibaba cloud and China Unicom backbone networks, not home
broadband, so this is a strong signal rather than a guarantee. Still to try: real devices on
China Telecom / China Mobile home networks. Re-run any time with `npm run check:china -- <url>`.

## Sign-in screens

- **Welcome** (first visit): Momo, "little moments ♡", "Your little space to unwind", then
  *Continue with Google* (only when enabled in Supabase and reachable on this network), *Continue
  with Email*, and a quiet *Continue as guest* link. If Google is off or blocked, email is the main
  button. While email delivery is limited, the email step says so (`VITE_EMAIL_SIGNIN`).
- **Email**: one field → *Email me a sign-in link* → "Check your inbox ✉" with *Send a new link*
  (60 s, or after Supabase's rate limit) and *Use another email*. Guests can still go in at any time.
- **Settings → Account**: the same form in a sheet for guests, plus *Show the welcome screen*;
  signed-in people see their address and *Sign out* (which keeps everything on the device).
- Coming back from the link lands on the home page; failures (used / expired link, offline, the
  email service refusing) show a calm message and nothing local changes. If a session ends on its
  own, the app carries on as a guest with a gentle note.
- Google stays optional: shown in the Settings sheet only when enabled in Supabase *and* reachable.

## Email link settings (Supabase → Authentication)

- Email provider on, **Confirm email on**. The link's lifetime follows "Email OTP Expiration".
- Templates **Confirm signup** and **Magic Link** both use `supabase/templates/email-link.html`
  (subject `Little Moments 登录链接 · Your sign-in link`). Its button goes to
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`; `RedirectTo` is the app's own address
  (`http://localhost:5173/` in development, `https://zhinuowang.github.io/little-moments/` live),
  which must be in the Redirect URLs allow-list.

## Custom SMTP (Resend) — needed for the code email

Supabase only lets templates be edited once custom SMTP is set. Resend settings (from Resend's
Supabase guide): host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key
(entered only in the Supabase dashboard). Until a domain is verified, Resend sends only from
`onboarding@resend.dev` and only to the Resend account's own address — enough to test the real
code flow, not enough for other people's inboxes.

**Seen in testing (2026-10-22):** a Resend account created with *Sign in with Apple → Hide My
Email* has an `@privaterelay.appleid.com` account address, so the test sender refused a QQ
recipient with `550 You can only send testing emails to your own email address`; Supabase returned
HTTP 500 `unexpected_failure`. Test with the account's own address, or verify a domain.

## Email delivery (needed before the public release, not for development)

Supabase's built-in email only reaches the project team's own address, 2 per hour — fine for
development, not for users. Production needs:

1. **A domain you own** (about US$10–15 / year), e.g. `littlemoments.app`. Mail can't be sent
   from `github.io`.
2. **SPF, DKIM and DMARC** records on that domain (the provider gives copy-paste DNS records).
   QQ Mail and 163 Mail are strict about unauthenticated or inconsistent senders.
3. **An SMTP provider**, plugged into Supabase → Authentication → SMTP settings:

| Provider | Cost | Notes |
| --- | --- | --- |
| **Resend** (US) | Free: 3,000 / month, 100 / day, 3 domains. Pro: US$20 / month for 50,000 | Simplest setup; SMTP included. Start here. |
| **Tencent Cloud SES** (international site) | 1,000 free, then about US$0.00028 per email | Tencent operates QQ Mail; a candidate if QQ delivery from Resend is slow or filtered. Account verification required. |
| **Amazon SES** | US$0.10 per 1,000 | Cheapest at scale; you must request removal from its sandbox. |

**Plan:** develop with Supabase's built-in email; before release, set up the domain + Resend and
send real codes to seed inboxes at **QQ, 163, Outlook and Gmail**, checking inbox vs. spam and
delay. Only switch to (or add) Tencent Cloud SES if QQ / 163 results are poor. Email template is
bilingual in one message (Supabase has one template per project), short, mostly text, one code,
no tracking links.

## Connectivity failures

- Every cloud request has a timeout. If Supabase is unreachable the app keeps working on the
  device, shows a calm one-line note, and retries later. Nothing local is ever cleared because of
  a network error, a sign-out or an expired session.
- The cloud library is loaded only when someone opens the sign-in sheet (or is already signed in),
  so guests — and visitors on networks where it's slow — don't download it.

## Security

- Only the project URL and the **publishable** key reach the browser; the app refuses secret /
  service_role keys. Row Level Security and the private photo bucket are unchanged (see
  `supabase/`, `npm run test:db`).
- Google uses the PKCE flow (`?code=` in the query string), so it doesn't collide with the app's
  `#/` routes, and the URL is cleaned afterwards. Redirects are limited to the allow-list in
  Supabase → Authentication → URL Configuration.
- Email codes: 6 digits, short expiry (10 minutes), Supabase's per-address and per-IP rate limits.

## What Phase 2 does not do

No cloud sync of pages, photos or plans yet, and no moving of guest data. Signing in only proves
who you are; those come in later phases, each tested and approved separately.
