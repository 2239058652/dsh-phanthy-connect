/**
 * Live smoke test for the plugin's shim, independent of DSH.
 *
 * Boots the real shim with the installation identity created during protocol
 * discovery, then speaks to it exactly as pi-ai will: an Anthropic Messages
 * body with the per-process secret in `x-api-key`. A 200 here proves the whole
 * chain -- gateway auth, session exchange, proof signing, upstream forwarding.
 *
 * Spends a little credit, so it is not part of the offline suite.
 *
 *   node scripts/smoke-shim.mjs [model]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createShim } from '../index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const identityFile = path.resolve(here, '..', '..', '_analysis', 'dsh-direct-identity.json')

if (!fs.existsSync(identityFile)) {
  console.error(`no identity at ${identityFile} -- run _analysis/phanthy-direct-client.js first`)
  process.exit(1)
}

const saved = JSON.parse(fs.readFileSync(identityFile, 'utf8'))
const state = {
  ...saved,
  registeredAt: Date.now(),
  accountScope: null,
  models: [],
  lastSyncAt: 0,
  lastError: null,
}

const logger = { info: console.log, warn: console.warn, debug: () => {} }
const shim = createShim({ state, logger })
await shim.ready
console.log('shim listening at', shim.baseUrl())

const model = process.argv[2] || 'deepseek-v4.1-flash-1017'
const body = JSON.stringify({
  model,
  max_tokens: 64,
  messages: [{ role: 'user', content: 'Reply with exactly: SHIM-OK' }],
})

const response = await fetch(`${shim.baseUrl()}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': shim.token(),
  },
  body,
  signal: AbortSignal.timeout(120_000),
})

const text = await response.text()
console.log('\nstatus:', response.status)
if (response.ok) {
  const parsed = JSON.parse(text)
  console.log('model :', parsed.model)
  console.log('text  :', parsed.content?.find((block) => block.type === 'text')?.text)
  console.log('usage :', JSON.stringify(parsed.usage && { input: parsed.usage.input_tokens, output: parsed.usage.output_tokens }))
} else {
  console.log('body  :', text.slice(0, 400))
}

await shim.close()
process.exit(response.ok ? 0 : 1)
