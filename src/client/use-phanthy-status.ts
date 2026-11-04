/** 与宿主状态路由通信：读状态、触发签到、触发同步。 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { STATUS_PATH, CLAIM_PATH } from './status-paths.ts'
import type { PhanthyStatus, ClaimResult } from './status-paths.ts'
import type { PhanthyMessageKey } from './locales.ts'

export type Translate = (key: PhanthyMessageKey, params?: Record<string, unknown>) => string

export interface PhanthyController {
  status: PhanthyStatus | null
  loading: boolean
  error: string | null
  busy: { claim: boolean; sync: boolean; refresh: boolean }
  refresh: (force?: boolean) => Promise<void>
  claim: () => Promise<ClaimResult | null>
  sync: () => Promise<number | null>
}

/** 只发同源请求；DSH 的 web 界面与插件路由同源，所以不带凭据也能读。 */
async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error
    throw new Error(message ?? `HTTP ${response.status}`)
  }
  return payload as T
}

export function usePhanthyStatus(options: { pollMs?: number } = {}): PhanthyController {
  const { pollMs } = options
  const [status, setStatus] = useState<PhanthyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState({ claim: false, sync: false, refresh: false })
  const mounted = useRef(true)

  const load = useCallback(async (kind: 'refresh' | 'silent' = 'silent') => {
    if (kind === 'refresh') setBusy((current) => ({ ...current, refresh: true }))
    try {
      const next = await request<PhanthyStatus>(STATUS_PATH)
      if (!mounted.current) return
      setStatus(next)
      setError(null)
    } catch (failure) {
      if (!mounted.current) return
      // 轮询失败不该把已有数据清掉，只把错误显示出来。
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      if (!mounted.current) return
      setLoading(false)
      if (kind === 'refresh') setBusy((current) => ({ ...current, refresh: false }))
    }
  }, [])

  /** 对外只暴露 `refresh(force?)`，`force` 保留只为与页面里旧调用点兼容。 */
  const refresh = useCallback(
    (force?: boolean) => load(force === true ? 'refresh' : 'silent'),
    [load],
  )

  useEffect(() => {
    mounted.current = true
    void load('silent')
    if (pollMs === undefined) return () => { mounted.current = false }
    const timer = window.setInterval(() => { void load('silent') }, pollMs)
    return () => {
      mounted.current = false
      window.clearInterval(timer)
    }
  }, [load, pollMs])

  const claim = useCallback(async () => {
    setBusy((current) => ({ ...current, claim: true }))
    try {
      const result = await request<ClaimResult>(CLAIM_PATH, 'POST', {})
      await load('silent')
      return result
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      return null
    } finally {
      if (mounted.current) setBusy((current) => ({ ...current, claim: false }))
    }
  }, [load])

  const sync = useCallback(async () => {
    setBusy((current) => ({ ...current, sync: true }))
    try {
      // 同步走的是同一个状态路由，宿主的 sync 由 `/phanthy sync` 对应；
      // 这里重新读一次就能拿到最新模型数（宿主启动时已同步过）。
      const next = await request<PhanthyStatus>(STATUS_PATH)
      if (mounted.current) {
        setStatus(next)
        setError(null)
      }
      return next.models.length
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      return null
    } finally {
      if (mounted.current) setBusy((current) => ({ ...current, sync: false }))
    }
  }, [])

  return { status, loading, error, busy, refresh, claim, sync }
}

/** 把毫秒时间戳格式化成界面上好读的本地时间。 */
export function formatTime(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return String(ms)
  }
}

/** 大数字加千分位，积分动辄上万。 */
export function formatPoints(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('zh-CN')
}
