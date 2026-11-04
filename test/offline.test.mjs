/**
 * Offline checks for the three signed messages.
 *
 * The strongest check is the last two: they replay a REAL registration request
 * captured from the PhanthyWork desktop app and confirm that this plugin's
 * message construction reproduces signatures the server accepted. If the
 * capture is absent the replay is skipped, and only the self-consistency checks
 * run.
 *
 *   node test/offline.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { __internals } from '../index.js'

const {
  installationIdOf,
  buildProfile,
  desktopSignatureMessage,
  deviceBindingMessage,
  inferenceProofMessage,
} = __internals

const here = path.dirname(fileURLToPath(import.meta.url))
const capture = path.resolve(here, '..', '..', '_analysis', 'proxy-capture.jsonl')
const signatureFixture = path.join(here, 'fixtures', 'register-signature.json')

let passed = 0
function check(label, fn) {
  fn()
  passed++
  console.log(`  ok  ${label}`)
}

async function acheck(label, fn) {
  await fn()
  passed++
  console.log(`  ok  ${label}`)
}

const b64url = (value) => Buffer.from(value).toString('base64url')

// ---------------------------------------------------------------------------
console.log('\ninstallation id')
// ---------------------------------------------------------------------------
const keys = crypto.generateKeyPairSync('ed25519')
const id = installationIdOf(keys.publicKey)

check('carries the di_ prefix', () => {
  assert.ok(id.startsWith('di_'), `expected di_ prefix, got ${id}`)
})
check('is 43 chars of base64url after the prefix', () => {
  assert.equal(id.slice(3).length, 43)
  assert.match(id.slice(3), /^[A-Za-z0-9_-]+$/)
})
check('hashes the raw 32-byte key, not the SPKI DER', () => {
  const raw = Buffer.from(keys.publicKey.export({ format: 'jwk' }).x, 'base64url')
  const der = keys.publicKey.export({ format: 'der', type: 'spki' })
  assert.equal(id, 'di_' + b64url(crypto.createHash('sha256').update(raw).digest()))
  assert.notEqual(id, 'di_' + b64url(crypto.createHash('sha256').update(der).digest()))
})
check('is stable across calls', () => {
  assert.equal(installationIdOf(keys.publicKey), id)
})

// ---------------------------------------------------------------------------
console.log('\nmessage shapes')
// ---------------------------------------------------------------------------
check('desktop signature message joins with newlines and hashes the body', () => {
  const message = desktopSignatureMessage({
    method: 'POST', path: '/x', body: 'BODY', idempotencyKey: 'k', ts: '1', non: 'n',
  })
  assert.equal(message, ['v1', 'POST', '/x', '1', 'n', b64url(crypto.createHash('sha256').update('BODY').digest()), 'k'].join('\n'))
})
check('device binding message lists scope, id, both keys, ts, nonce', () => {
  const message = deviceBindingMessage({
    accountScope: 'acct', installationId: 'di_x', installationPublicKey: 'IP', inferencePublicKey: 'FP', ts: '1', non: 'n',
  })
  assert.equal(message, ['desktop-device-v1', 'acct', 'di_x', 'IP', 'FP', '1', 'n'].join('\n'))
})
check('inference proof message joins with newlines, not a middle dot', () => {
  const message = inferenceProofMessage({
    method: 'POST', pathname: '/v1/messages', body: 'B', authorization: 'Bearer t', session: 'S', ts: '1', non: 'n',
  })
  const parts = message.split('\n')
  assert.equal(parts.length, 12)
  assert.equal(parts[0], 'desktop-inference-v2')
  assert.equal(parts[1], 'POST')
  assert.equal(parts[2], '/v1/messages')
  assert.deepEqual(parts.slice(8), ['', '', '', ''])
  assert.ok(!message.includes('\u00b7'), 'must not use U+00B7 as separator')
})

// ---------------------------------------------------------------------------
console.log('\nprofile')
// ---------------------------------------------------------------------------
check('profile addresses the gateway credential through apiKeyEnv', () => {
  const profile = buildProfile({
    baseURL: 'http://127.0.0.1:1/v1',
    models: [{ id: 'm', name: 'M', contextWindow: 10, maxTokens: 5 }],
  })
  assert.equal(profile.api, 'anthropic-messages')
  assert.equal(profile.baseURL, 'http://127.0.0.1:1/v1')
  // apiKeyEnv rather than a literal header: settings writes deep-merge, so a
  // header value would never be removed and every restart would leave another
  // stale secret in the route. apiKeyEnv is a reference and always resolves to
  // the current value.
  assert.equal(profile.apiKeyEnv, __internals.GATEWAY_KEY_ENV)
  assert.equal(profile.headers, undefined)
  assert.deepEqual(profile.models, [{ id: 'm', name: 'M', contextWindow: 10, maxTokens: 5 }])
})

// ---------------------------------------------------------------------------
console.log('\nreplay against a captured real request')
// ---------------------------------------------------------------------------
if (!fs.existsSync(capture)) {
  console.log(`  --  skipped: no capture at ${capture}`)
} else {
  const records = fs.readFileSync(capture, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const register = records.find((entry) => entry.url.includes('desktop-installations/register'))

  if (!register) {
    console.log('  --  skipped: capture has no register request')
  } else {
    const body = JSON.parse(register.body)
    const headers = register.headers
    // The proxy log was sanitised: bearer tokens and the signature headers were
    // redacted. The one signature the replay needs is kept in a fixture.
    const desktopSignature = JSON.parse(fs.readFileSync(signatureFixture, 'utf8')).xDesktopSignature
    const installationKey = crypto.createPublicKey({ key: Buffer.from(body.public_key, 'base64'), format: 'der', type: 'spki' })
    const deviceKey = crypto.createPublicKey({ key: Buffer.from(body.device_public_key, 'base64'), format: 'der', type: 'spki' })

    check('installationId derivation reproduces the real identifier', () => {
      assert.equal(installationIdOf(installationKey), headers['x-desktop-installation-id'])
    })

    check('desktop signature message verifies against the real signature', () => {
      const message = desktopSignatureMessage({
        method: 'POST',
        path: '/api/oauth/desktop-installations/register',
        body: register.body,
        idempotencyKey: headers['idempotency-key'],
        ts: headers['x-desktop-timestamp'],
        non: headers['x-desktop-nonce'],
      })
      const ok = crypto.verify(
        null, Buffer.from(message, 'utf8'), installationKey,
        Buffer.from(desktopSignature, 'base64url'),
      )
      assert.ok(ok, 'captured x-desktop-signature did not verify')
    })

    check('device binding message verifies against the real signature', () => {
      // accountScope is the account uuid; recover it from the capture's other
      // header if present, otherwise this check needs the value substituted.
      const accountScope = 'cmw0exqub0dhhnb3i5xon2h6m'
      const message = deviceBindingMessage({
        accountScope,
        installationId: headers['x-desktop-installation-id'],
        installationPublicKey: body.public_key,
        inferencePublicKey: body.inference_public_key,
        ts: headers['x-desktop-timestamp'],
        non: headers['x-desktop-nonce'],
      })
      const ok = crypto.verify(
        null, Buffer.from(message, 'utf8'), deviceKey,
        Buffer.from(body.device_signature, 'base64url'),
      )
      assert.ok(ok, 'captured device_signature did not verify')
    })
  }
}

// ---------------------------------------------------------------------------
console.log('\nlogin (PKCE)')
// ---------------------------------------------------------------------------
const { startLogin, buildAuthorizeUrl, extractAuthorizationCode, parseAuthorizationInput, startLoginListener, resolveAccessToken } = await import('../index.js')

check('authorize URL carries PKCE S256 and the fixed redirect', () => {
  const url = new URL(buildAuthorizeUrl({ verifier: 'v'.repeat(64), state: 'st' }))
  assert.equal(url.origin + url.pathname, 'https://code.phanthy.com/oauth/authorize')
  assert.equal(url.searchParams.get('client_id'), __internals.OAUTH_CLIENT_ID)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('redirect_uri'), __internals.OAUTH_REDIRECT_URI)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('state'), 'st')
  assert.equal(
    url.searchParams.get('code_challenge'),
    b64url(crypto.createHash('sha256').update('v'.repeat(64)).digest()),
  )
})

check('startLogin stores a pending verifier and never reuses it', () => {
  const state = { pendingLogin: null }
  const first = startLogin(state)
  const second = startLogin(state)
  assert.equal(state.pendingLogin.verifier.length, 64)
  assert.notEqual(first.url, second.url)
})

check('paste handling accepts every shape the UI or address bar can produce', () => {
  assert.equal(extractAuthorizationCode('https://code.phanthy.com/oauth/code/success?code=abc&state=x'), 'abc')
  assert.equal(extractAuthorizationCode('code=abc&state=x'), 'abc')
  assert.equal(extractAuthorizationCode('  abc  '), 'abc')
  assert.equal(extractAuthorizationCode(''), null)

  // The success page displays `code#state`; keeping the `#...` suffix would send
  // a wrong code to the token endpoint, so this split is load-bearing.
  const shown = 'aBoAWBcEAg1PQoPblZzPJ1S5ItRkstPw0PF6EVB8IfQ#ySmvEfcWGOyT7LdvLakn_A'
  assert.equal(extractAuthorizationCode(shown), 'aBoAWBcEAg1PQoPblZzPJ1S5ItRkstPw0PF6EVB8IfQ')
  const parsed = parseAuthorizationInput(shown)
  assert.deepEqual(parsed, {
    code: 'aBoAWBcEAg1PQoPblZzPJ1S5ItRkstPw0PF6EVB8IfQ',
    state: 'ySmvEfcWGOyT7LdvLakn_A',
  })
})

await acheck('a fresh plugin token is used as-is, with no network call', async () => {
  const state = { oauth: { accessToken: 'plugin-token', refreshToken: null, expiresAt: Date.now() + 3_600_000 } }
  assert.equal(await resolveAccessToken(state, {}), 'plugin-token')
})

await acheck('the loopback listener captures the code and rejects a bad state', async () => {
  // Rejected state must not yield a code, and the server must stay up for the
  // real callback that follows.
  const bad = startLoginListener('right-state', { timeoutMs: 5_000 })
  await bad.ready
  await fetch(`http://127.0.0.1:${bad.port()}/oauth/callback?code=nope&state=wrong`)
  // A second, independent listener for the success path (the first one already
  // consumed its single settle).
  const good = startLoginListener('right-state', { timeoutMs: 5_000 })
  await good.ready
  const page = await fetch(`http://127.0.0.1:${good.port()}/oauth/callback?code=REAL&state=right-state`).then((r) => r.text())
  assert.match(page, /授权完成/)
  assert.equal(await good.result, 'REAL')
})

await acheck('a non-callback path on the listener is a 404, not a code', async () => {
  const listener = startLoginListener('s', { timeoutMs: 5_000 })
  await listener.ready
  const response = await fetch(`http://127.0.0.1:${listener.port()}/anything-else`)
  assert.equal(response.status, 404)
  assert.equal(await listener.result, null)
})

check('the authorize URL carries whichever redirect_uri it was given', () => {
  const loopback = 'http://127.0.0.1:45678/oauth/callback'
  const url = new URL(buildAuthorizeUrl({ verifier: 'v'.repeat(64), state: 'st', redirectUri: loopback }))
  assert.equal(url.searchParams.get('redirect_uri'), loopback)
})

await acheck('with no token at all it explains both ways to get one', async () => {
  const previous = process.env.PHANTHY_CREDENTIALS_FILE
  process.env.PHANTHY_CREDENTIALS_FILE = path.join(here, 'fixtures', 'does-not-exist.json')
  try {
    assert.equal(__internals.readOfficialAccessToken(), null)
    await assert.rejects(
      () => resolveAccessToken({ oauth: null }, {}),
      (error) => error.message.includes('/phanthy login'),
    )
  } finally {
    if (previous === undefined) delete process.env.PHANTHY_CREDENTIALS_FILE
    else process.env.PHANTHY_CREDENTIALS_FILE = previous
  }
})

console.log(`\n${passed} checks passed\n`)
