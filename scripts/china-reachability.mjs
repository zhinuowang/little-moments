// Measures whether addresses load from inside mainland China, using public Globalping probes.
//
//   npm run check:china                                  # site, Supabase, Google
//   npm run check:china -- https://<ref>.supabase.co/auth/v1/health
//
// Only public URLs are sent. Probes are mostly Chinese cloud and backbone networks (Tencent,
// Alibaba, China Unicom), so treat results as a strong signal, not proof for every home network.

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['https://zhinuowang.github.io/little-moments/', 'https://supabase.co/', 'https://accounts.google.com/']

const api = 'https://api.globalping.io/v1/measurements'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function measure(target) {
  const u = new URL(target)
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'http',
      target: u.hostname,
      locations: [{ country: 'CN', limit: 8 }],
      measurementOptions: { protocol: 'HTTPS', request: { method: 'GET', path: u.pathname + u.search } },
    }),
  })
  const { id, error } = await res.json()
  if (!id) throw new Error(error?.message ?? 'measurement not created')
  for (let i = 0; i < 30; i++) {
    await sleep(3000)
    const m = await (await fetch(`${api}/${id}`)).json()
    if (m.status === 'finished') return m
  }
  throw new Error('measurement did not finish')
}

for (const target of targets) {
  try {
    const m = await measure(target)
    const rows = m.results.map(({ probe, result }) => {
      const okay = result.statusCode != null
      const what = okay ? `HTTP ${result.statusCode} in ${result.timings?.total}ms` : `failed: ${(result.rawOutput ?? result.status ?? '').split('\n')[0].slice(0, 70)}`
      return { okay, line: `  ${(probe.city ?? '').padEnd(12)} ${(probe.network ?? '').slice(0, 30).padEnd(30)} ${what}` }
    })
    console.log(`\n${target}\n  reached by ${rows.filter((r) => r.okay).length}/${rows.length} probes in mainland China`)
    for (const r of rows) console.log(r.line)
  } catch (e) {
    console.log(`\n${target}\n  could not measure: ${e.message}`)
  }
}
