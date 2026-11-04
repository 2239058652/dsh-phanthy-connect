/**
 * Live smoke test for the plugin's shim, independent of DSH.
 *
 * Boots the real shim with the plugin's own installed identity, then speaks to
 * it exactly as pi-ai will: an Anthropic Messages body with the per-process
 * secret in `x-api-key`. A 200 here proves the whole chain -- gateway auth,
 * session exchange, proof signing, device header, upstream forwarding.
 *
 * Requires the plugin to have run at least once (so `$DSH_HOME/phanthy/state.json`
 * exists and the installation is registered).
 *
 * Spends a little credit, so it is not part of the offline suite.
 *
 *   node scripts/smoke-shim.mjs [model]
 */
import { createShim, __internals } from '../index.js'

const state = __internals.loadState()
if (!state.installationPrivateKeyPem) {
  console.error(`还没有安装身份（${__internals.stateFile()}）。先启动一次 DSH 让插件初始化，或跑 /phanthy login。`)
  process.exit(1)
}
if (!state.oauth?.accessToken && __internals.readOfficialAccessToken() === null) {
  console.error('没有可用登录态。跑 /phanthy login，或先用官方客户端登录一次。')
  process.exit(1)
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
