# Sign-in design — North America and mainland China

Status: design approved for Phase 2 on `develop`. Nothing here is live on the public site.

## Ways to use Little Moments

| Way | Role | Works in mainland China? |
| --- | --- | --- |
| **Guest** (default) | No sign-in. Everything stays in this browser, exactly like v1.0.0. | Yes — no network needed after the first load |
| **Email code** (primary) | Type an email, receive a **6-digit code**, type it in. No password, no link to click. | Depends on email delivery to QQ / 163 — to be measured with real inboxes |
| **Continue with Google** (optional) | One tap where Google is reachable. | **No** — 0 of 8 mainland probes reached `accounts.google.com` (2026-10-22) |

Codes instead of magic links: a code works inside the installed app (a link would open the
browser instead), works when the email is read on another device, and avoids link-scanning by
mail providers that can "use up" a link before the person clicks it.

## Measured reachability from mainland China (2026-10-22, Globalping, 8 probes each)

| Address | Reached | Time |
| --- | --- | --- |
| `zhinuowang.github.io/little-moments/` (GitHub Pages) | 7 / 8 | 0.5–3.9 s (one Ningbo probe timed out) |
| `supabase.co` | 8 / 8 | 0.2–0.4 s |
| `accounts.google.com` | 0 / 8 | TCP connection timed out everywhere |

Probes are mostly Tencent / Alibaba cloud and China Unicom backbone networks, not home
broadband, so this is a strong signal rather than a guarantee. Still to measure: the project's own
API address (`https://<ref>.supabase.co/auth/v1/health`) — `npm run check:china -- <url>` — and
real devices on China Telecom / China Mobile home networks.

## Sign-in screen

- Lives in **Settings → Account & sync** as a small sheet. The home page, mood check-in, ideas,
  rituals, diary and plans never require it, and never show a login wall.
- Order: email field first → **Send code** → one 6-digit box (`inputmode="numeric"`,
  `autocomplete="one-time-code"`, paste-friendly) → **Resend** after 60 s. Then a quiet
  "or" line and **Continue with Google** underneath.
- Before leaving for Google, the app checks in the background whether Google answers (≈3 s). If it
  doesn't, the button explains gently "Google isn't reachable on this network — the email code
  works everywhere" instead of sending the person to a dead page.
- Monochrome, hand-lettered, Momo beside the title, every word in EN and 中文. Google's own "G"
  mark is shown in its required colours, small; everything else stays black and white.
- Signing out never deletes anything on the device.

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
