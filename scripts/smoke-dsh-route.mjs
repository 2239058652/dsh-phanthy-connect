/**
 * End-to-end check of the DSH-facing path, without touching the UI.
 *
 * Speaks to the plugin's shim exactly as the host's pi-ai adapter does:
 * the gateway secret resolved from DSH credentials as `x-api-key`, plus the
 * anthropic-version and content-type the adapter sets.
 *
 *   node scripts/smoke-dsh-route.mjs [model]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const profilePatch = path.join(os.homedir(), '.dsh', 'profiles', 'web', 'cordis.patch.yml')
const credentials = path.join(os.homedir(), '.dsh', '.credentials.yaml')

const patch = fs.readFileSync(profilePatch, 'utf8')
const baseMatch = /^ {6}phanthy:\n(?:.*\n)*? {8}baseURL: (\S+)$/m.exec(patch)
if (!baseMatch) throw new Error('could not find the phanthy baseURL in the profile patch')
const baseURL = baseMatch[1].replace(/\/$/, '')
console.log('route baseURL :', baseURL)

const keyMatch = /PHANTHY_GATEWAY_KEY:\s*(\S+)/.exec(fs.readFileSync(credentials, 'utf8'))
if (!keyMatch) throw new Error('PHANTHY_GATEWAY_KEY is not in the DSH credential store')
const gatewayKey = keyMatch[1]
console.log('gateway key   :', gatewayKey.slice(0, 6) + '...')

const model = process.argv[2] || 'deepseek-v4.1-flash-1017'
const body = JSON.stringify({
  model,
  max_tokens: 64,
  messages: [{ role: 'user', content: 'Reply with exactly: DSH-ROUTE-OK' }],
})

// The Anthropic SDK appends `/v1/messages` to the route's baseURL, so the
// request DSH actually makes is `<origin>/v1/messages`. Tolerate a route that
// still carries a stale trailing `/v1` so this works before and after a fix.
const origin = baseURL.replace(/\/v1$/, '')
const response = await fetch(`${origin}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': gatewayKey,
  },
  body,
  signal: AbortSignal.timeout(120_000),
})

const text = await response.text()
console.log('\nstatus:', response.status)
if (response.ok) {
  const parsed = JSON.parse(text)
  console.log('model :', parsed.model)
  console.log('text  :', parsed.content?.find((b) => b.type === 'text')?.text)
} else {
  console.log('body  :', text.slice(0, 300))
}
process.exit(response.ok ? 0 : 1)
