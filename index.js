/**
 * dsh-phanthy-connect —— 把 PhanthyCode 的模型接进 dsh，不需要桌面端常驻。
 *
 * ## 为什么需要本地 shim
 *
 * PhanthyCode 的推理端点不接受裸 Bearer：每个请求都要带一组 Ed25519 证明头，
 * 签名覆盖**请求体的哈希**，因此无法用「静态 header」的提供方路由实现，
 * 必须有一个能逐请求介入的地方。这个 shim 就是那个地方：
 *
 *   dsh / pi-ai (anthropic-messages, 宿主自带)
 *      │  x-api-key: <本进程随机密钥>
 *      ▼
 *   shim (本文件, 127.0.0.1:随机端口)
 *      │  Authorization: Bearer <从 ~/.phanthy-code/.credentials.json 现读>
 *      │  + x-phanthy-proof-* (Ed25519, 覆盖 body 哈希)
 *      ▼
 *   https://code.phanthy.com/v1/messages
 *
 * ## 安装证明协议（自举，无需桌面端）
 *
 *   三对 Ed25519 密钥：installation / device / inference
 *   installationId = "di_" + base64url(sha256(裸 32 字节 installation 公钥))
 *
 *   注册  POST /api/oauth/desktop-installations/register
 *     头 x-desktop-installation-id / -timestamp / -nonce
 *        x-desktop-signature = sign(installationKey,
 *          "v1\n{方法}\n{路径}\n{ts}\n{nonce}\n{base64url(sha256(body))}\n{idempotencyKey}")
 *     体 public_key / device_public_key / inference_public_key（base64url SPKI）
 *        + device_signature = sign(deviceKey,
 *          "desktop-device-v1\n{accountScope}\n{installationId}\n{instPub}\n{infPub}\n{ts}\n{nonce}")
 *     注意 device_signature 与 x-desktop-signature **共用同一组 ts/nonce**。
 *
 *   换会话  POST /api/oauth/activities/summary  → desktop_inference_token（短命 JWT）
 *
 *   推理    POST /v1/messages
 *     头 x-phanthy-desktop-session / x-phanthy-proof-timestamp / -nonce / -signature
 *        signature = sign(inferenceKey, ["desktop-inference-v2", 方法, 路径, ts, nonce,
 *          base64url(sha256(body)), base64url(sha256(authorization)),
 *          base64url(sha256(desktopSession)), "","","","" ].join("\n"))
 *
 * 身份（含私钥）落在 $DSH_HOME/phanthy/state.json，0600。
 *
 * @module index.js
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'

export const name = 'phanthy'

/**
 * `settings` 用于写模型路由；`credentials` 用于存放回环网关的密钥。
 *
 * 密钥走 `apiKeyEnv` + credentials，而不是把值塞进提供方路由的 `headers`：
 * settings 是深合并写入的，`headers` 一旦写进去就**再也不会消失**，每次重启都会
 * 在路由里堆一份上一个进程的过期密钥。`apiKeyEnv` 只是个引用，解析永远取当前值。
 */
export const inject = ['settings', 'credentials']

/** 插件页读数据的同源路由；浏览器半身与宿主靠它通信。 */
const STATUS_PATH = '/plugins/dsh-phanthy-connect/status'
/** 页面上「签到」按钮打这里。 */
const CLAIM_PATH = '/plugins/dsh-phanthy-connect/claim'

const BASE = 'https://code.phanthy.com'
const PROVIDER = 'phanthy'
const PROVIDER_NAME = 'Phanthy'
const GATEWAY_KEY_ENV = 'PHANTHY_GATEWAY_KEY'
const PI_AI_NS = 'llm-pi-ai'
const EDITION = 'phanthy_work'
const APP_VERSION = '2.47.0'

const DEFAULT_CONTEXT_WINDOW = 200_000
const DEFAULT_MAX_TOKENS = 32_000

/**
 * OAuth（PKCE，公共客户端）。
 *
 * 回调地址固定在官网的授权成功页，没有 loopback 回调，所以只能「生成链接 → 用户
 * 在浏览器授权 → 把页面上的 code 粘回来」两步走。
 */
const OAUTH_CLIENT_ID = 'phanthy-code-cli'
const OAUTH_REDIRECT_URI = `${BASE}/oauth/code/success`
const OAUTH_SCOPE = 'user:inference user:profile user:sessions:claude_code'
const OAUTH_BETA = 'oauth-2025-04-20'
const REFRESH_SKEW_MS = 60_000

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const home = () => os.homedir()

function dshHome() {
  return process.env.DSH_HOME || path.join(home(), '.dsh')
}

function stateFile() {
  return path.join(dshHome(), 'phanthy', 'state.json')
}

/** PhanthyCode CLI / 桌面端共用的登录态文件。 */
function credentialsFile() {
  return process.env.PHANTHY_CREDENTIALS_FILE
    || path.join(home(), '.phanthy-code', '.credentials.json')
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode })
  fs.renameSync(tmp, file)
}

function maskSecret(value) {
  if (!value) return '（空）'
  return value.length <= 12 ? `${value.slice(0, 4)}***` : `${value.slice(0, 8)}…${value.slice(-4)}`
}

function fmtTs(ms) {
  if (!ms) return '-'
  try {
    return new Date(ms).toLocaleString('zh-CN')
  } catch {
    return String(ms)
  }
}

const b64url = (value) => Buffer.from(value).toString('base64url')
const sha256 = (input) => crypto.createHash('sha256').update(input).digest()
const nonce18 = () => b64url(crypto.randomBytes(18))
const nonce24 = () => b64url(crypto.randomBytes(24))
const spkiOf = (publicKey) => b64url(publicKey.export({ format: 'der', type: 'spki' }))
const rawOf = (publicKey) => Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url')

/**
 * `di_` + base64url(sha256(裸 32 字节公钥))。
 * 哈希的是裸公钥而不是 SPKI DER —— 服务端就是这么推的，已用真实抓包核对。
 */
function installationIdOf(publicKey) {
  return `di_${b64url(sha256(rawOf(publicKey)))}`
}

/** 从 JWT 里取 exp（秒），失败返回 0。 */
function jwtExpiry(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return typeof claims.exp === 'number' ? claims.exp * 1000 : 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// 身份（安装密钥对）
// ---------------------------------------------------------------------------

const EMPTY_STATE = {
  installationId: null,
  installationPrivateKeyPem: null,
  installationPublicKeyPem: null,
  devicePrivateKeyPem: null,
  devicePublicKeyPem: null,
  inferencePrivateKeyPem: null,
  inferencePublicKeyPem: null,
  registeredAt: 0,
  accountScope: null,
  models: [],
  lastSyncAt: 0,
  lastError: null,
  /** 插件自己走 OAuth 拿到的登录态；与官方客户端的那份互不影响。 */
  oauth: null,
  /** 两步登录的中间态：第一次 `/phanthy login` 写好，粘 code 时消费掉。 */
  pendingLogin: null,
}

function loadState() {
  return { ...EMPTY_STATE, ...(readJson(stateFile()) ?? {}) }
}

function saveState(state) {
  writeJson(stateFile(), state)
  return state
}

function asPair(privatePem, publicPem) {
  return {
    privateKey: crypto.createPrivateKey(privatePem),
    publicKey: crypto.createPublicKey(publicPem),
  }
}

function keysOf(state) {
  if (!state.installationPrivateKeyPem) return null
  return {
    installation: asPair(state.installationPrivateKeyPem, state.installationPublicKeyPem),
    device: asPair(state.devicePrivateKeyPem, state.devicePublicKeyPem),
    inference: asPair(state.inferencePrivateKeyPem, state.inferencePublicKeyPem),
  }
}

/** 首次调用时生成三对 Ed25519 密钥并存盘。 */
function ensureKeys(state) {
  if (keysOf(state)) return keysOf(state)
  const installation = crypto.generateKeyPairSync('ed25519')
  const device = crypto.generateKeyPairSync('ed25519')
  const inference = crypto.generateKeyPairSync('ed25519')
  state.installationId = installationIdOf(installation.publicKey)
  state.installationPrivateKeyPem = installation.privateKey.export({ format: 'pem', type: 'pkcs8' })
  state.installationPublicKeyPem = installation.publicKey.export({ format: 'pem', type: 'spki' })
  state.devicePrivateKeyPem = device.privateKey.export({ format: 'pem', type: 'pkcs8' })
  state.devicePublicKeyPem = device.publicKey.export({ format: 'pem', type: 'spki' })
  state.inferencePrivateKeyPem = inference.privateKey.export({ format: 'pem', type: 'pkcs8' })
  state.inferencePublicKeyPem = inference.publicKey.export({ format: 'pem', type: 'spki' })
  saveState(state)
  return keysOf(state)
}

// ---------------------------------------------------------------------------
// 登录态
// ---------------------------------------------------------------------------

/** 官方客户端（CLI / 桌面端）落盘的那份登录态，只读复用。 */
function readOfficialAccessToken() {
  const token = readJson(credentialsFile())?.claudeAiOauth?.accessToken
  return typeof token === 'string' && token !== '' ? token : null
}

/**
 * 授权链接：PKCE(S256)。
 *
 * `redirectUri` 默认是官网的成功页（只能手动粘码）；改成回环地址后浏览器授权完
 * 会直接回调到本机，全程不需要复制粘贴 —— 官方 CLI 也走这条路。服务端对
 * redirect_uri 有白名单，回环地址是被允许的（拿一个明显不合法的域名试过会 400）。
 */
export function buildAuthorizeUrl({ verifier, state, redirectUri = OAUTH_REDIRECT_URI }) {
  const url = new URL(`${BASE}/oauth/authorize`)
  url.searchParams.set('client_id', OAUTH_CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', OAUTH_SCOPE)
  url.searchParams.set('code_challenge', b64url(sha256(verifier)))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  return url.toString()
}

/** 一次登录用到的 PKCE 材料。 */
export function newPkce() {
  return { verifier: b64url(crypto.randomBytes(48)), state: b64url(crypto.randomBytes(16)) }
}

/**
 * 只服务本次授权的回环监听。返回它监听的端口，以及一个在拿到授权码（或失败/超时）
 * 时 resolve 的 promise。
 */
export function startLoginListener(expectedState, { timeoutMs = 120_000, logger } = {}) {
  let settle
  const result = new Promise((resolve) => { settle = resolve })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const reply = (text) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!doctype html><meta charset="utf-8"><title>PhanthyCode</title><body style="font:15px/1.7 system-ui,sans-serif;padding:48px">${text}</body>`)
    }
    if (url.pathname !== '/oauth/callback') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    const code = url.searchParams.get('code')
    const returnedState = url.searchParams.get('state')
    if (url.searchParams.get('error') !== null) {
      reply('授权被拒绝，可以关闭此页面。')
      settle(null)
      return
    }
    if (code === null || code === '') {
      reply('没有收到授权码，可以关闭此页面。')
      settle(null)
      return
    }
    if (expectedState !== null && returnedState !== expectedState) {
      reply('state 不匹配，可以关闭此页面并重试。')
      settle(null)
      return
    }
    reply('授权完成，可以关闭此页面，回到 dsh 继续。')
    settle(code)
  })

  const ready = new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const timer = setTimeout(() => settle(null), timeoutMs)
  timer.unref?.()
  const close = () => {
    clearTimeout(timer)
    server.closeAllConnections?.()
    server.close()
  }
  result.then(close, close)

  return {
    ready,
    result,
    close,
    port: () => {
      const address = server.address()
      return address === null || typeof address === 'string' ? null : address.port
    },
  }
}

/**
 * 解析用户粘回来的授权信息。
 *
 * 授权成功页显示的其实是 `code#state`（官方 CLI 也按 `#` 拆：`j.split("#")`），
 * 所以这里必须把 `#` 之后的部分切掉，否则整串会被当成授权码发给服务端。
 * 另外也要能吃下整段跳转 URL、`code=xxx` 片段和裸 code。
 */
export function parseAuthorizationInput(input) {
  const raw = String(input ?? '').trim()
  if (raw === '') return { code: null, state: null }

  try {
    const url = new URL(raw)
    return { code: url.searchParams.get('code'), state: url.searchParams.get('state') }
  } catch {
    // 不是合法 URL，继续按片段处理
  }

  const marked = /(?:^|[?&])code=([^&#\s]+)/.exec(raw)
  if (marked !== null) {
    const stateParam = /(?:^|[?&])state=([^&#\s]+)/.exec(raw)
    return {
      code: decodeURIComponent(marked[1]),
      state: stateParam === null ? null : decodeURIComponent(stateParam[1]),
    }
  }

  const hash = raw.indexOf('#')
  if (hash >= 0) {
    return { code: raw.slice(0, hash).trim(), state: raw.slice(hash + 1).trim() || null }
  }
  return { code: raw, state: null }
}

/** 只要授权码。 */
export function extractAuthorizationCode(input) {
  return parseAuthorizationInput(input).code
}

/**
 * 上游的错误是 `{"error":{"code","message"}}` —— 直接把 `payload.error` 插进模板
 * 会渲染成 `[object Object]`，所以这里逐层取字符串。
 */
export function describeTokenError(payload, status, text) {
  const error = payload?.error
  if (typeof error === 'string' && error !== '') return error
  if (error !== null && typeof error === 'object') {
    const code = typeof error.code === 'string' ? error.code : ''
    const message = typeof error.message === 'string' ? error.message : ''
    const joined = [code, message].filter((part) => part !== '').join(': ')
    if (joined !== '') return joined
  }
  if (typeof payload?.error_description === 'string' && payload.error_description !== '') return payload.error_description
  if (typeof payload?.message === 'string' && payload.message !== '') return payload.message
  return text.slice(0, 200) || `HTTP ${status}`
}

async function tokenRequest(form) {
  const response = await phanthyFetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'anthropic-beta': OAUTH_BETA,
    },
    body: new URLSearchParams(form).toString(),
  })
  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  if (!response.ok || payload === null) {
    throw new Error(`换取令牌失败 HTTP ${response.status}: ${describeTokenError(payload, response.status, text)}`)
  }
  if (typeof payload.access_token !== 'string' || payload.access_token === '') {
    throw new Error(`令牌响应里没有 access_token：${text.slice(0, 200)}`)
  }
  return payload
}

/** 把一次 token 响应落成 `state.oauth`。 */
function storeTokenResponse(state, payload, previous) {
  const expiresIn = Number(payload.expires_in)
  state.oauth = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || previous?.refreshToken || null,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3_600_000),
    scope: payload.scope ?? previous?.scope ?? OAUTH_SCOPE,
    loggedInAt: previous?.loggedInAt ?? Date.now(),
  }
  saveState(state)
  return state.oauth
}

/**
 * 记下本次登录的 PKCE 材料并给出授权链接。
 *
 * 调用方可以自带 `pkce`（回环流程需要先知道 state 才能起监听）；
 * 不带就现生成一对。
 */
export function startLogin(state, { redirectUri = OAUTH_REDIRECT_URI, pkce = newPkce() } = {}) {
  state.pendingLogin = { verifier: pkce.verifier, state: pkce.state, redirectUri, startedAt: Date.now() }
  saveState(state)
  return { url: buildAuthorizeUrl({ verifier: pkce.verifier, state: pkce.state, redirectUri }), pkce }
}

/** 第二步：用授权码换令牌。 */
export async function completeLogin(state, input) {
  const pending = state.pendingLogin
  if (pending === null || typeof pending?.verifier !== 'string') {
    throw new Error('没有进行中的授权。先跑 `/phanthy login` 拿链接。')
  }
  const { code } = parseAuthorizationInput(input)
  if (code === null || code === '') throw new Error('没从输入里解析出授权码。')
  // 授权码与 verifier 绑定，服务端会自己校验（码串了会得到 invalid_grant），
  // 所以不额外硬校验粘贴过来的 state —— 手工粘贴很容易差一点，硬失败反而挡路。
  let payload
  try {
    payload = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: pending.verifier,
      redirect_uri: pending.redirectUri ?? OAUTH_REDIRECT_URI,
      client_id: OAUTH_CLIENT_ID,
      state: pending.state,
    })
  } catch (error) {
    // invalid_grant 有两种常见成因，分开说清楚，否则用户只会看到「换取令牌失败」。
    if (String(error?.message).includes('invalid_grant')) {
      throw new Error(`${error.message}\n授权码已失效、或与本次登录不匹配。常见原因：① 授权码用过了（只能用一次）；② 码是上一次 /phanthy login 的，而之后又生成过新链接（verifier 已换）。请重新跑 \`/phanthy login\`、打开新链接授权、立刻把码粘回来。`)
    }
    throw error
  }
  state.pendingLogin = null
  return storeTokenResponse(state, payload, null)
}

/** 用 refresh_token 换新的 access_token。 */
export async function refreshLogin(state) {
  const previous = state.oauth
  if (previous?.refreshToken == null) throw new Error('没有 refresh_token，需要重新 `/phanthy login`。')
  const payload = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: previous.refreshToken,
    client_id: OAUTH_CLIENT_ID,
    scope: OAUTH_SCOPE,
  })
  return storeTokenResponse(state, payload, previous)
}

/**
 * 取当前可用的 access_token：优先插件自己那份（快过期就刷新），
 * 没有则回退到官方客户端落盘的那份。
 */
export async function resolveAccessToken(state, logger) {
  const oauth = state.oauth
  if (oauth?.accessToken) {
    if (Number(oauth.expiresAt) - REFRESH_SKEW_MS > Date.now()) return oauth.accessToken
    try {
      const refreshed = await refreshLogin(state)
      logger?.debug?.('dsh-phanthy: 已刷新登录态')
      return refreshed.accessToken
    } catch (error) {
      // 刷新失败不直接放弃：官方客户端那份可能还有效。
      logger?.warn?.(`dsh-phanthy: 刷新登录态失败（${error?.message || error}）`)
    }
  }
  const official = readOfficialAccessToken()
  if (official !== null) {
    // 只读复用那份登录态，所以它的续期完全依赖官方客户端。过期了就明说，
    // 否则用户只会看到上游一句「Login session has expired」而无从下手。
    const expiresAt = jwtExpiry(official)
    if (expiresAt !== 0 && expiresAt <= Date.now()) {
      throw new Error(`官方客户端那份登录态已过期（${fmtTs(expiresAt)}），而插件是只读复用它、不会替它刷新。两种解法：① 打开一次 PhanthyCode 桌面端让它续期；② 跑 \`/phanthy login\`，让插件持有自己的登录态并自动续期（推荐）。`)
    }
    return official
  }
  throw new Error(`没有可用的登录态。跑 \`/phanthy login\` 授权，或先用 PhanthyCode 官方客户端登录一次（会在 ${credentialsFile()} 落一份）。`)
}

// ---------------------------------------------------------------------------
// 上游调用
// ---------------------------------------------------------------------------

async function phanthyFetch(url, options, timeoutMs = 30_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

/**
 * 三个待签消息的构造。抽出来是为了能对真实抓包做离线校验（见 test/offline.test.mjs），
 * 它们的分隔符、哈希对象、编码都不能凭直觉改。
 */

/** 活动签名：`v1\n方法\n路径\n时间戳\nnonce\n{body 哈希}\n{幂等键}`。 */
export function desktopSignatureMessage({ method, path: urlPath, body, idempotencyKey, ts, non }) {
  return ['v1', method, urlPath, ts, non, b64url(sha256(body)), idempotencyKey ?? ''].join('\n')
}

/** 设备绑定：把账号、安装与推理公钥绑在一起。 */
export function deviceBindingMessage({ accountScope, installationId, installationPublicKey, inferencePublicKey, ts, non }) {
  return ['desktop-device-v1', accountScope, installationId, installationPublicKey, inferencePublicKey, ts, non].join('\n')
}

/** 推理证明：分隔符是换行符，且同时覆盖 body、authorization 与会话令牌三者。 */
export function inferenceProofMessage({ method, pathname, body, authorization, session, ts, non }) {
  return [
    'desktop-inference-v2', method.toUpperCase(), pathname, ts, non,
    b64url(sha256(body)), b64url(sha256(authorization)), b64url(sha256(session)),
    '', '', '', '',
  ].join('\n')
}

/** 用 installation 私钥签一组 `x-desktop-*` 头。ts/nonce 必须与 device_signature 共用。 */
function desktopHeaders({ method, path: urlPath, body, idempotencyKey, installationId, keys, ts, non }) {
  const message = desktopSignatureMessage({ method, path: urlPath, body, idempotencyKey, ts, non })
  return {
    'x-desktop-installation-id': installationId,
    'x-desktop-timestamp': ts,
    'x-desktop-nonce': non,
    'x-desktop-signature': b64url(crypto.sign(null, Buffer.from(message, 'utf8'), keys.installation.privateKey)),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  }
}

/** 读账号作用域 —— 它就是 account.uuid，device binding 的签名内容之一。 */
async function fetchAccountScope(accessToken) {
  const response = await phanthyFetch(`${BASE}/api/oauth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`读取账号信息失败 HTTP ${response.status}`)
  const profile = await response.json()
  const scope = profile?.account?.uuid
  if (typeof scope !== 'string' || scope === '') throw new Error('账号信息里没有 account.uuid')
  return scope
}

/** 注册本机安装。幂等：同一个 installationId 重复注册返回既有记录。 */
async function registerInstallation(state, keys, accessToken, accountScope) {
  const ts = String(Date.now())
  const non = nonce18()
  const urlPath = '/api/oauth/desktop-installations/register'

  const body = JSON.stringify({
    public_key: spkiOf(keys.installation.publicKey),
    edition: EDITION,
    platform: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
    version: APP_VERSION,
    device_public_key: spkiOf(keys.device.publicKey),
    device_signature: b64url(crypto.sign(null, Buffer.from(deviceBindingMessage({
      accountScope,
      installationId: state.installationId,
      installationPublicKey: spkiOf(keys.installation.publicKey),
      inferencePublicKey: spkiOf(keys.inference.publicKey),
      ts,
      non,
    }), 'utf8'), keys.device.privateKey)),
    inference_public_key: spkiOf(keys.inference.publicKey),
  })

  const response = await phanthyFetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...desktopHeaders({
        method: 'POST', path: urlPath, body,
        idempotencyKey: `register:${state.installationId}`,
        installationId: state.installationId, keys, ts, non,
      }),
    },
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`注册安装失败 HTTP ${response.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

// ---------------------------------------------------------------------------
// 会话令牌（desktop_inference_token）
// ---------------------------------------------------------------------------

let sessionCache = { token: null, expiresAt: 0, boundTo: null }

/**
 * 取（或复用）desktop_inference_token。它有效期很短，所以在 shim 里按需刷新。
 * 该令牌绑定取 summary 时用的那个 authorization，因此换 token 会让缓存失效。
 */
/** 读一次 activities/summary（带签名），拿签到状态与桌面会话令牌。 */
async function fetchSummary(state, keys, accessToken) {
  const urlPath = '/api/oauth/activities/summary'
  const body = JSON.stringify({ inference_public_key: spkiOf(keys.inference.publicKey) })
  const ts = String(Date.now())
  const non = nonce18()

  const response = await phanthyFetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...desktopHeaders({
        method: 'POST', path: urlPath, body,
        installationId: state.installationId, keys, ts, non,
      }),
    },
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`换取会话令牌失败 HTTP ${response.status}: ${text.slice(0, 200)}`)
  return { summary: JSON.parse(text) }
}

export async function getDesktopSession(state, keys, accessToken, logger) {
  const now = Date.now()
  if (sessionCache.token && sessionCache.boundTo === accessToken && sessionCache.expiresAt - 30_000 > now) {
    return sessionCache.token
  }

  const { summary } = await fetchSummary(state, keys, accessToken)
  const token = summary?.desktop_inference_token
  if (typeof token !== 'string' || token === '') throw new Error('summary 响应里没有 desktop_inference_token')

  sessionCache = { token, expiresAt: jwtExpiry(token), boundTo: accessToken }
  logger?.debug?.('dsh-phanthy: 已刷新 desktop_inference_token')
  return token
}

/** 读当前签到状态（不复用缓存，签到决策要看最新值）。 */
export async function readDailyState(state, keys, accessToken) {
  const { summary } = await fetchSummary(state, keys, accessToken)
  return { daily: dailyStateOf(summary), raw: summary }
}

/**
 * 今天还能不能签到（以及签到后的积分）。
 *
 * `summary` 的 `daily` 字段由上游给：`status` 是 `eligible_today` / `granted_today`
 * 之类的状态，`server_date` 是签到时要回传的日期（用服务端日期而不是本地日期，
 * 否则时区不同会让幂等键对不上）。
 */
export function dailyStateOf(summary) {
  const daily = summary?.daily
  if (daily === null || typeof daily !== 'object') return null
  return {
    status: typeof daily.status === 'string' ? daily.status : 'unknown',
    serverDate: typeof daily.server_date === 'string' ? daily.server_date : null,
    points: Number(daily.points) || 0,
    streakDay: Number(daily.streak_day) || 0,
  }
}

/** 领取今天的签到积分。幂等键用 installationId + 服务端日期。 */
export async function claimDaily(state, keys, accessToken, serverDate, logger) {
  const urlPath = '/api/oauth/activities/daily-login/claim'
  const body = '{}'
  const ts = String(Date.now())
  const non = nonce18()

  const response = await phanthyFetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...desktopHeaders({
        method: 'POST', path: urlPath, body,
        idempotencyKey: `daily:${state.installationId}:${serverDate}`,
        installationId: state.installationId, keys, ts, non,
      }),
    },
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`签到失败 HTTP ${response.status}: ${text.slice(0, 200)}`)

  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  logger?.info?.(`dsh-phanthy: 已领取今日签到积分${payload?.points === undefined ? '' : ` +${payload.points}`}`)
  return payload
}

/**
 * 客户端标识（`x-phanthy-cli-device`）。
 *
 * 官方客户端会把这个头写成「平台 + 架构 + 系统版本 + 内网 IP 候选」的完整指纹。
 * 实测上游只用它填用量记录的 OS 列，且**只读 `platform` 就够**：只发这一个字段，
 * 用量页的 OS 列照样显示 Windows。所以这里刻意只报平台，不上报 IP、架构和系统
 * 版本——那些对我们的使用没有帮助，只是多泄露一份设备信息。
 */
export function deviceHeader() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
  const payload = { version: 1, platform, cliVersion: APP_VERSION }
  return { 'x-phanthy-cli-device': b64url(Buffer.from(JSON.stringify(payload), 'utf8')) }
}

/** 推理证明头。签名覆盖 body 与 authorization 的哈希。 */
function proofHeaders({ method, pathname, body, authorization, session, keys }) {
  const ts = String(Date.now())
  const non = nonce24()
  const message = inferenceProofMessage({ method, pathname, body, authorization, session, ts, non })
  return {
    'x-phanthy-desktop-session': session,
    'x-phanthy-proof-timestamp': ts,
    'x-phanthy-proof-nonce': non,
    'x-phanthy-proof-signature': b64url(crypto.sign(null, Buffer.from(message, 'utf8'), keys.inference.privateKey)),
    ...deviceHeader(),
  }
}

// ---------------------------------------------------------------------------
// 模型目录
// ---------------------------------------------------------------------------

/** 目录里客户端可见的模型；裸 Bearer 就能取。 */
async function fetchModels(accessToken) {
  const response = await phanthyFetch(`${BASE}/api/phanthy_code/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`读取模型目录失败 HTTP ${response.status}`)
  const catalog = await response.json()
  return (catalog?.models ?? [])
    .filter((model) => typeof model?.id === 'string' && model.id !== '')
    .map((model) => ({
      id: model.id,
      name: model.label || model.name || model.id,
      contextWindow: Number(model.context_window) || Number(model.limits?.context_window) || DEFAULT_CONTEXT_WINDOW,
      maxTokens: Number(model.limits?.max_output_tokens) || DEFAULT_MAX_TOKENS,
    }))
}

// ---------------------------------------------------------------------------
// shim：pi-ai → 证明头 → 上游
// ---------------------------------------------------------------------------

const REQUEST_BODY_LIMIT = 64 * 1024 * 1024
/** 转发给上游时不透传的 hop-by-hop / 由我们改写的头。 */
const STRIPPED = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'x-api-key', 'authorization'])
/** 只放行这些客户端头，其余一律丢弃。 */
const FORWARDED = new Set(['content-type', 'accept', 'anthropic-version', 'anthropic-beta', 'user-agent'])

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

export function createShim({ state, logger }) {
  const secret = crypto.randomBytes(32).toString('base64url')
  const server = http.createServer((req, res) => { void handle(req, res) })
  const ready = new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  server.listen(0, '127.0.0.1')

  const baseUrl = () => {
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('phanthy shim 未在监听')
    return `http://127.0.0.1:${address.port}`
  }

  async function handle(req, res) {
    const url = (req.url ?? '/').split('?')[0]
    // Anthropic SDK 自带 `/v1/messages` 并把它拼在 baseURL 之后，所以按「最后一段
    // 是 messages」匹配：无论路由写的是 origin 还是 origin/v1 都能收下。
    if (req.method !== 'POST' || !/(^|\/)messages$/.test(url)) {
      return json(res, 404, { error: { type: 'not_found', message: 'not found' } })
    }
    // 只认本进程发给 pi-ai 的密钥：shim 监听回环，但仍避免同机其它进程误用。
    const presented = req.headers['x-api-key']
    if (presented !== secret) {
      return json(res, 401, { error: { type: 'authentication_error', message: 'invalid gateway credential' } })
    }

    const chunks = []
    let length = 0
    for await (const chunk of req) {
      length += chunk.length
      if (length > REQUEST_BODY_LIMIT) return json(res, 413, { error: { type: 'invalid_request_error', message: 'request body too large' } })
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks)

    const controller = new AbortController()
    res.on('close', () => { if (!res.writableEnded) controller.abort() })

    try {
      const accessToken = await resolveAccessToken(state, logger)
      const keys = keysOf(state)
      if (!keys) throw new Error('尚未生成安装密钥')

      const session = await getDesktopSession(state, keys, accessToken, logger)
      const authorization = `Bearer ${accessToken}`

      const headers = {}
      for (const [key, value] of Object.entries(req.headers)) {
        if (STRIPPED.has(key) || !FORWARDED.has(key)) continue
        headers[key] = value
      }
      headers.Authorization = authorization
      Object.assign(headers, proofHeaders({
        method: 'POST', pathname: '/v1/messages', body, authorization, session, keys,
      }))

      const upstream = await fetch(`${BASE}/v1/messages?beta=true`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      const out = {}
      upstream.headers.forEach((value, key) => {
        if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key)) return
        out[key] = value
      })
      res.writeHead(upstream.status, out)
      if (upstream.body === null) return res.end()
      Readable.fromWeb(upstream.body).on('error', (error) => {
        logger?.warn?.('dsh-phanthy: 上游流中断', error)
        if (res.writable) res.end()
      }).pipe(res)
    } catch (error) {
      const message = error?.message || String(error)
      logger?.warn?.(`dsh-phanthy: 转发失败 ${message}`)
      if (!res.headersSent) json(res, 502, { error: { type: 'api_error', message } })
      else res.end()
    }
  }

  return {
    ready,
    token: () => secret,
    baseUrl,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)))
      server.closeAllConnections()
    }),
  }
}

// ---------------------------------------------------------------------------
// 写 llm-pi-ai 路由
// ---------------------------------------------------------------------------

function readProviders(settings) {
  let rows
  try {
    rows = settings.describe?.() ?? []
  } catch {
    return undefined
  }
  const row = Array.isArray(rows) ? rows.find((entry) => entry?.ns === PI_AI_NS) : undefined
  if (!row) return undefined
  const providers = row.value?.providers
  return providers && typeof providers === 'object' && !Array.isArray(providers) ? providers : {}
}

class SettingsNotReadyError extends Error {}

function buildProfile({ baseURL, models }) {
  return {
    apiKeyEnv: GATEWAY_KEY_ENV,
    displayName: PROVIDER_NAME,
    api: 'anthropic-messages',
    baseURL,
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    })),
  }
}

async function writeProfile(settings, profile, { overwrite }) {
  const providers = readProviders(settings)
  if (providers === undefined) throw new SettingsNotReadyError(`settings 命名空间 ${PI_AI_NS} 还没注册`)

  const existing = providers[PROVIDER]
  if (existing && !overwrite) {
    // baseURL 每进程都变（随机端口），必须覆盖；模型按 id 求差集，保留用户在
    // 「设置 → 模型」里的改动（数组是整体替换，所以要传完整数组）。
    const existingModels = Array.isArray(existing.models) ? existing.models : []
    const known = new Set(existingModels.map((model) => model.id))
    const added = profile.models.filter((model) => !known.has(model.id))
    await settings.update(PI_AI_NS, {
      providers: {
        [PROVIDER]: {
          ...profile,
          models: existingModels.length ? [...existingModels, ...added] : profile.models,
        },
      },
    })
    return { updated: true, addedModels: added.length, keptModels: existingModels.length }
  }

  await settings.update(PI_AI_NS, { providers: { [PROVIDER]: profile } })
  return { created: true, addedModels: profile.models.length, keptModels: 0 }
}

async function writeProfileWithRetry(settings, profile, options, logger) {
  const delays = [0, 150, 300, 600, 1000, 1500, 2000, 3000]
  let lastError
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      return await writeProfile(settings, profile, options)
    } catch (error) {
      if (!(error instanceof SettingsNotReadyError)) throw error
      lastError = error
      logger?.debug?.(`dsh-phanthy: 等待 ${PI_AI_NS} 命名空间（${error.message}）`)
    }
  }
  throw new Error(`写入 ${PI_AI_NS} 路由失败: ${lastError?.message || lastError}`)
}

/**
 * 把回环网关密钥写进 credentials，让宿主的 `apiKeyEnv` 解析得到。
 * 每次进程启动都会覆盖（端口和密钥都变了，旧值必然失效）。
 */
async function submitGatewayCredential(ctx, secret) {
  const credentials = ctx.credentials ?? ctx.get?.('credentials')
  if (!credentials?.set) return { ok: false, reason: 'credentials 服务不可用' }
  try {
    await credentials.set(GATEWAY_KEY_ENV, secret)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) }
  }
}

// ---------------------------------------------------------------------------
// 浏览器半身的数据路由
// ---------------------------------------------------------------------------

/**
 * 组装插件页要显示的状态。
 *
 * 这里**不返回任何令牌或私钥**：浏览器只需要「登录态是否有效、什么时候到期」
 * 这类事实，凭据本体永远留在宿主侧。
 */
async function collectStatus(state, logger) {
  const doc = {
    installationId: state.installationId,
    installationRegistered: Number(state.registeredAt) > 0,
    registeredAt: Number(state.registeredAt) || 0,
    models: (state.models ?? []).map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
    })),
    lastSyncAt: Number(state.lastSyncAt) || 0,
    lastError: state.lastError ?? null,
    login: { source: 'none', expiresAt: 0, valid: false },
    daily: null,
    credits: null,
  }

  const oauth = state.oauth
  if (oauth?.accessToken) {
    const expiresAt = Number(oauth.expiresAt) || 0
    doc.login = { source: 'plugin', expiresAt, valid: expiresAt > Date.now() }
  } else if (readOfficialAccessToken() !== null) {
    const expiresAt = jwtExpiry(readOfficialAccessToken())
    doc.login = { source: 'official', expiresAt, valid: expiresAt === 0 || expiresAt > Date.now() }
  }

  // 签到与积分要打上游；失败只记为页面上的提示，不影响其它字段显示。
  try {
    const accessToken = await resolveAccessToken(state, logger)
    const keys = ensureKeys(state)
    const { summary } = await fetchSummary(state, keys, accessToken)
    doc.daily = dailyStateOf(summary)
    // 上游把余额放在 `credits: { available, reserved }`，不是 `wallet`。
    if (summary?.credits !== undefined && summary.credits !== null) {
      doc.credits = {
        available: Number(summary.credits.available) || 0,
        reserved: Number(summary.credits.reserved) || 0,
      }
    }
  } catch (error) {
    doc.upstreamError = error?.message || String(error)
  }
  return doc
}

/**
 * 注册两个同源路由，供浏览器半身读写。
 *
 * `webServer` 是可选服务（无头 profile 没有浏览器），所以走 `ctx.inject`
 * 而不是写进硬依赖列表。契约来自 `@deepseek-ai/dsh-host-webserver`：
 * `register({ kind, path, handler })`，重复的 (kind, path) 会抛错。
 */
function registerStatusRoutes(ctx, state, shim, logger) {
  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.webServer
    if (typeof server?.register !== 'function') {
      logger?.warn?.('dsh-phanthy: webServer 没有 register 接口，插件页拿不到数据')
      return
    }

    /** 把「返回一个可序列化值的函数」包成 WebRoute 处理器。 */
    const route = (urlPath, produce) => ({
      kind: 'exact',
      path: urlPath,
      async handler(req, res) {
        try {
          const result = await produce(req)
          const payload = JSON.stringify(result)
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
          res.end(payload)
        } catch (error) {
          const message = error?.message || String(error)
          logger?.warn?.(`dsh-phanthy: 路由 ${urlPath} 失败 ${message}`)
          const payload = JSON.stringify({ error: message })
          res.writeHead(500, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
          res.end(payload)
        }
      },
    })

    const disposers = []
    try {
      disposers.push(server.register(route(STATUS_PATH, () => collectStatus(state, logger))))
      disposers.push(server.register(route(CLAIM_PATH, async () => {
        const accessToken = await resolveAccessToken(state, logger)
        const keys = ensureKeys(state)
        const { daily } = await readDailyState(state, keys, accessToken)
        if (daily === null || daily.serverDate === null) throw new Error('上游没有返回签到状态')
        if (daily.status === 'granted_today') return { claimed: false, daily }
        const claimed = await claimDaily(state, keys, accessToken, daily.serverDate, logger)
        return { claimed: true, points: claimed?.points ?? daily.points, daily }
      })))
      ctx.effect?.(() => () => { for (const dispose of disposers) dispose() })
      logger?.info?.(`dsh-phanthy: 插件页数据路由已注册（${STATUS_PATH}）`)
    } catch (error) {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {}
      }
      logger?.warn?.(`dsh-phanthy: 状态路由未注册（${error?.message || error}），插件页将拿不到数据`)
    }
  })
}

// ---------------------------------------------------------------------------
// 同步主流程
// ---------------------------------------------------------------------------

export async function syncOnce(ctx, state, shim, { overwrite = false } = {}) {
  const logger = ctx?.logger ?? console
  const settings = ctx.get?.('settings')
  if (!settings) throw new Error('settings 服务不可用，无法注册模型路由')

  const accessToken = await resolveAccessToken(state, logger)
  const keys = ensureKeys(state)

  if (!state.registeredAt || state.accountScope === null) {
    state.accountScope = await fetchAccountScope(accessToken)
    const registration = await registerInstallation(state, keys, accessToken, state.accountScope)
    state.registeredAt = Date.now()
    logger?.info?.(`dsh-phanthy: 安装已注册（${registration?.installation?.id ?? state.installationId}）`)
  }

  const models = await fetchModels(accessToken)
  state.models = models
  state.lastSyncAt = Date.now()
  state.lastError = null
  saveState(state)

  const submitted = await submitGatewayCredential(ctx, shim.token())
  const written = await writeProfileWithRetry(
    settings,
    // 注意：baseURL 是 origin，**不带** /v1 —— Anthropic SDK 自己会拼 /v1/messages。
    buildProfile({ baseURL: shim.baseUrl(), models }),
    { overwrite },
    logger,
  )

  return { ok: true, models: models.length, submitted, written }
}

// ---------------------------------------------------------------------------
// /phanthy 命令
// ---------------------------------------------------------------------------

function describeLogin(state) {
  if (state.oauth?.accessToken) {
    const until = Number(state.oauth.expiresAt) > Date.now()
      ? `有效至 ${fmtTs(state.oauth.expiresAt)}`
      : '已过期（下次请求会尝试刷新）'
    return `插件自带（${until}）`
  }
  if (state.pendingLogin) return '等待浏览器授权（或手动粘贴授权码）'
  if (readOfficialAccessToken() !== null) return `复用官方客户端（\`${credentialsFile()}\`）`
  return '未登录 —— 跑 `/phanthy login`'
}

function renderStatus(state, shim) {
  const lines = [
    '**PhanthyCode**',
    `- 登录态: ${describeLogin(state)}`,
    `- 安装 ID: ${state.installationId ? `\`${state.installationId}\`` : '未生成'}`,
    `- 安装注册: ${state.registeredAt ? fmtTs(state.registeredAt) : '未注册'}`,
    `- 账号: ${state.accountScope || '未知'}`,
    `- 模型: ${state.models?.length ? `${state.models.length} 个` : '未同步'}`,
    `- 上次同步: ${fmtTs(state.lastSyncAt)}`,
    `- 本地网关: ${shim?.baseUrl?.() ?? '未启动'}`,
  ]
  if (state.lastError) lines.push(`- 上次错误: ${state.lastError}`)
  lines.push('', '用法: `/phanthy status` · `/phanthy login` 授权 · `/phanthy logout` 退出 · `/phanthy sync` 重新同步 · `/phanthy models` 列模型 · `/phanthy reinstall` 重新注册安装')
  return lines.join('\n')
}

/**
 * 打开系统默认浏览器。Windows 上不能走 `cmd /c start`：cmd 会把 URL 里的 `&`
 * 当成命令分隔符，浏览器只拿到第一段参数。explorer.exe 直接收参数，不经 shell。
 */
/**
 * 打开系统默认浏览器，返回是否真的启动成功。
 *
 * Windows 上逐个试：`rundll32 url.dll,FileProtocolHandler` 最稳（直接交给
 * shell 关联处理，不经过命令行解析）；`explorer.exe` 在有 `&` 的 URL 上会
 * 把参数截断；`cmd /c start` 完全不能用（`&` 会被当成命令分隔符）。
 * 三者都失败时返回 false，让调用方把链接明明白白打印出来。
 */
export function openBrowser(url) {
  const candidates = process.platform === 'win32'
    ? [
      ['rundll32.exe', ['url.dll,FileProtocolHandler', url]],
      ['explorer.exe', [url]],
    ]
    : process.platform === 'darwin'
      ? [['open', [url]]]
      : [['xdg-open', [url]]]

  for (const [command, args] of candidates) {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
      child.on('error', () => {}) // 异步的失败不该变成未处理异常
      child.unref()
      return true
    } catch {
      // 试下一个
    }
  }
  return false
}

function registerCommand(ctx, state, shim, logger) {
  let commands
  try {
    commands = ctx.get?.('commands')
  } catch {
    commands = undefined
  }
  if (!commands?.register) {
    logger?.warn?.('dsh-phanthy: commands 服务不可用，/phanthy 命令未注册')
    return
  }

  commands.register({
    name: 'phanthy',
    description: 'PhanthyCode：把账号可用的模型同步进模型选择器',
    input: { hint: '[status|login [code]|logout|daily [claim]|sync|models|reinstall]' },
    handler: async (invocation) => {
      const raw = String(invocation?.rawInput || '').trim()
      const [sub, ...rest] = raw.split(/\s+/)
      const arg = rest.join(' ').trim()
      try {
        switch (sub || 'status') {
          case 'status':
            return { kind: 'success', text: renderStatus(state, shim) }

          case 'login': {
            // 带参数 = 手动粘贴授权码（回环流程失败时的兜底）。
            if (arg !== '') {
              await completeLogin(state, arg)
              const result = await syncOnce(ctx, state, shim, { overwrite: false })
              return { kind: 'success', text: `登录成功，已同步 ${result.models} 个模型。在模型选择器里选「${PROVIDER_NAME}」即可。` }
            }

            // 无参 = 一步式：回环回调自动收码。
            const pkce = newPkce()
            let listener = null
            try {
              listener = startLoginListener(pkce.state, { logger })
              await listener.ready
            } catch (error) {
              listener = null
              logger?.debug?.(`dsh-phanthy: 回环登录服务起不来（${error?.message || error}），退回手动粘贴`)
            }

            const redirectUri = listener === null
              ? OAUTH_REDIRECT_URI
              : `http://127.0.0.1:${listener.port()}/oauth/callback`
            const { url } = startLogin(state, { redirectUri, pkce })
            const opened = openBrowser(url)

            if (listener === null) {
              return {
                kind: 'success',
                text: [
                  '在浏览器里打开下面的链接完成授权：',
                  '',
                  url,
                  '',
                  '授权成功后把页面上显示的授权码粘回来（整段粘贴即可）：',
                  '',
                  '```',
                  '/phanthy login <授权码>',
                  '```',
                ].join('\n'),
              }
            }

            // 回调到了就自动换票并同步；命令本身立即返回，不阻塞输入框。
            listener.result.then(async (code) => {
              if (code === null) {
                logger?.info?.('dsh-phanthy: 没等到授权回调；可以手动跑 `/phanthy login <授权码>` 再试')
                return
              }
              try {
                await completeLogin(state, code)
                const result = await syncOnce(ctx, state, shim, { overwrite: false })
                logger?.info?.(`dsh-phanthy: 登录成功，已同步 ${result.models} 个模型`)
              } catch (error) {
                state.lastError = error?.message || String(error)
                saveState(state)
                logger?.warn?.(`dsh-phanthy: 自动登录失败 ${state.lastError}`)
              }
            })

            return {
              kind: 'success',
              text: [
                opened
                  ? '已尝试用默认浏览器打开授权页。'
                  : '没能自动打开浏览器，请手动访问下面的链接。',
                '',
                url,
                '',
                '授权完成后会**自动登录并同步模型**（约一两秒），不需要复制粘贴。',
                `然后跑 \`/phanthy status\` 确认「登录态：插件自带（有效至 …）」。等待超过 2 分钟没成功，再用 \`/phanthy login <授权码>\` 手动粘码兜底。`,
              ].join('\n'),
            }
          }

          case 'logout': {
            state.oauth = null
            state.pendingLogin = null
            saveState(state)
            const fallback = readOfficialAccessToken() !== null
              ? '（官方客户端那份登录态仍会被复用；要彻底断掉请退出官方客户端）'
              : ''
            return { kind: 'success', text: `已清除插件自己保存的登录态${fallback}` }
          }

          case 'daily': {
            // 无参 = 看状态；带 claim = 立刻签。
            const accessToken = await resolveAccessToken(state, logger)
            const keys = ensureKeys(state)

            if (arg === 'claim') {
              const { daily } = await readDailyState(state, keys, accessToken)
              if (daily === null || daily.serverDate === null) {
                return { kind: 'error', text: '上游没有返回签到状态（summary 里没有 daily 字段）。' }
              }
              const claimed = await claimDaily(state, keys, accessToken, daily.serverDate, logger)
              return {
                kind: 'success',
                text: `已签到（${daily.serverDate}）${claimed?.points === undefined ? '' : `，+${claimed.points} 积分`}。`,
              }
            }

            const { daily } = await readDailyState(state, keys, accessToken)
            if (daily === null) return { kind: 'error', text: '上游没有返回签到状态。' }
            const already = daily.status === 'granted_today'
            return {
              kind: 'success',
              text: [
                `**每日签到**`,
                `- 服务端日期: ${daily.serverDate ?? '未知'}`,
                `- 状态: ${daily.status}${already ? '（今天已领取）' : ''}`,
                `- 今日积分: ${daily.points || '未领取'}`,
                `- 连续天数: ${daily.streakDay || '-'}`,
                '',
                already ? '今天已经领过了。' : '跑 `/phanthy daily claim` 立刻领取。',
              ].join('\n'),
            }
          }

          case 'models':
            return {
              kind: 'success',
              text: state.models?.length
                ? state.models.map((model) => `- \`${model.id}\` — ${model.name}（${model.contextWindow} ctx）`).join('\n')
                : '还没有模型，先跑 `/phanthy sync`',
            }

          case 'sync': {
            const result = await syncOnce(ctx, state, shim, { overwrite: false })
            return { kind: 'success', text: `已同步 ${result.models} 个模型到 \`llm-pi-ai\` 提供方 \`${PROVIDER}\`。在模型选择器里选「${PROVIDER_NAME}」即可。` }
          }

          case 'reinstall': {
            // 只清注册标记，密钥与 installationId 保留 —— ID 由公钥决定，换不掉。
            state.registeredAt = 0
            state.accountScope = null
            saveState(state)
            const result = await syncOnce(ctx, state, shim, { overwrite: false })
            return { kind: 'success', text: `已重新注册安装并同步 ${result.models} 个模型` }
          }

          default:
            return { kind: 'error', text: `未知子命令: ${sub}\n${renderStatus(state, shim)}` }
        }
      } catch (error) {
        state.lastError = error?.message || String(error)
        saveState(state)
        return { kind: 'error', text: `Phanthy: ${state.lastError}` }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// 插件入口
// ---------------------------------------------------------------------------

export function apply(ctx, config = {}) {
  const logger = ctx.logger ?? console
  const state = loadState()
  const shim = createShim({ state, logger })

  registerCommand(ctx, state, shim, logger)
  registerStatusRoutes(ctx, state, shim, logger)
  ctx.effect?.(() => () => { void shim.close() })

  // settings.update() 在 HMR 事务里调用会被内核拒绝（`HMR transactions cannot be
  // nested`），热重载时 apply 本身就在事务中，所以把写入推到 apply 之外。
  const defer = (fn) => {
    const timer = setTimeout(() => fn().catch(() => {}), 0)
    timer.unref?.()
  }

  defer(async () => {
    await shim.ready
    logger?.info?.(`dsh-phanthy: 本地网关 ${shim.baseUrl()}`)
    try {
      const result = await syncOnce(ctx, state, shim, { overwrite: Boolean(config.overwrite) })
      logger?.info?.(`dsh-phanthy: 已注册 ${PROVIDER} 提供方，${result.models} 个模型`)
      if (!result.submitted.ok) {
        logger?.warn?.(`dsh-phanthy: 网关密钥写入 credentials 失败（${result.submitted.reason}），模型请求会因缺少凭据而被宿主拒绝`)
      }
    } catch (error) {
      state.lastError = error?.message || String(error)
      saveState(state)
      logger?.warn?.(`dsh-phanthy: 同步失败 ${state.lastError}`)
    }

    // 自动签到：每次启动检查一次，当天没领就领。上游的 server_date 决定幂等键，
    // 所以重复启动/重复调用不会多领（同一日期用同一个 key）。
    if (config.autoDaily !== false) {
      try {
        const accessToken = await resolveAccessToken(state, logger)
        const keys = ensureKeys(state)
        const { daily } = await readDailyState(state, keys, accessToken)
        if (daily !== null && daily.status !== 'granted_today' && daily.serverDate !== null) {
          await claimDaily(state, keys, accessToken, daily.serverDate, logger)
        } else {
          logger?.debug?.(`dsh-phanthy: 今日签到状态 ${daily?.status ?? 'unknown'}，跳过`)
        }
      } catch (error) {
        logger?.warn?.(`dsh-phanthy: 自动签到失败 ${error?.message || error}`)
      }
    }
  })
}

export const __internals = {
  loadState,
  saveState,
  stateFile,
  credentialsFile,
  installationIdOf,
  buildProfile,
  fetchModels,
  createShim,
  syncOnce,
  desktopSignatureMessage,
  deviceBindingMessage,
  inferenceProofMessage,
  readOfficialAccessToken,
  resolveAccessToken,
  newPkce,
  startLoginListener,
  readDailyState,
  claimDaily,
  dailyStateOf,
  openBrowser,
  PROVIDER,
  GATEWAY_KEY_ENV,
  OAUTH_CLIENT_ID,
  OAUTH_REDIRECT_URI,
  OAUTH_SCOPE,
}
