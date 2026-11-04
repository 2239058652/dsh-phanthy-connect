/** Phanthy 插件页：积分、签到、账号、安装、模型。 */

import type { ReactElement } from 'react'
import { CSS } from './card-css.ts'
import { formatPoints, formatTime } from './use-phanthy-status.ts'
import type { Translate, PhanthyController } from './use-phanthy-status.ts'

export interface PhanthyPluginPageProps {
  t: Translate
}

/** 一个统计块。`tone` 只在有明确好坏时用，别为好看而染色。 */
function Tile({ label, value, hint, tone }: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'warn' | 'bad'
}): ReactElement {
  const toneClass = tone === 'good' ? CSS.tileGood : tone === 'warn' ? CSS.tileWarn : tone === 'bad' ? CSS.tileBad : ''
  return (
    <div className={[CSS.tile, toneClass].filter(Boolean).join(' ')}>
      <span className={CSS.tileLabel}>{label}</span>
      <span className={CSS.tileValue}>{value}</span>
      {hint === undefined ? null : <span className={CSS.tileHint}>{hint}</span>}
    </div>
  )
}

export function PhanthyPluginPage({ t }: PhanthyPluginPageProps): ReactElement {
  return <PhanthyPageBody t={t} controller={usePhanthy()} />
}

// 拆一层，避免在同一个函数里既调 hook 又做条件渲染。
import { usePhanthyStatus } from './use-phanthy-status.ts'
function usePhanthy(): PhanthyController {
  return usePhanthyStatus({ pollMs: 60_000 })
}

function PhanthyPageBody({ t, controller }: { t: Translate; controller: PhanthyController }): ReactElement {
  const { status, loading, error, busy, refresh, claim, sync } = controller

  if (loading && status === null) {
    return <div className={CSS.panel}><p className={CSS.hint}>{t('loading')}</p></div>
  }
  if (status === null) {
    return (
      <div className={CSS.panel}>
        <p className={CSS.error}>{t('loadFailed')}{error === null ? '' : `：${error}`}</p>
        <div className={CSS.actions}>
          <button type="button" className={CSS.button} onClick={() => void refresh(true)}>{t('refreshButton')}</button>
        </div>
      </div>
    )
  }

  const points = status.credits?.available
  const daily = status.daily
  const claimedToday = daily?.status === 'granted_today'
  const loginLabel = status.login.source === 'plugin'
    ? t('loginPlugin')
    : status.login.source === 'official' ? t('loginOfficial') : t('loginNone')
  const loginHint = status.login.expiresAt
    ? (status.login.valid ? t('validUntil', { time: formatTime(status.login.expiresAt) }) : t('expired'))
    : (status.login.source === 'none' ? t('needLogin') : undefined)

  return (
    <div className={CSS.page}>
      <p className={CSS.text}>{t('intro')}</p>

      {error !== null || status.upstreamError !== undefined || status.lastError !== null
        ? (
          <div className={CSS.panel}>
            <p className={CSS.error}>
              {t('errorHeading')}：{error ?? status.upstreamError ?? status.lastError}
            </p>
          </div>
        )
        : null}

      {/* 积分 + 签到：这一块是页面存在的主要理由 */}
      <section className={CSS.panel}>
        <div className={CSS.section}>
          <span className={CSS.heading}>{t('pointsHeading')}</span>
          <div className={CSS.tiles}>
            <Tile label={t('pointsAvailable')} value={formatPoints(points)} hint={t('pointsHint')} tone="good" />
            <Tile
              label={t('dailyPoints')}
              value={daily === null ? '—' : claimedToday ? `+${formatPoints(daily.points)}` : t('dailyEligible')}
              hint={daily === null ? undefined : t('dailyGranted')}
              tone={daily === null ? undefined : claimedToday ? 'good' : 'warn'}
            />
            <Tile
              label={t('dailyStreak')}
              value={daily === null || !daily.streakDay ? '—' : `${daily.streakDay}`}
              hint={daily === null || !daily.streakDay ? undefined : t('streakUnit')}
            />
          </div>
          <div className={CSS.row}>
            <p className={CSS.hint}>
              {daily === null
                ? t('dailyUnknown')
                : claimedToday ? t('dailyGranted') : t('dailyEligible')}
            </p>
            <div className={CSS.actions}>
              <button
                type="button"
                className={`${CSS.button} ${CSS.buttonPrimary}`}
                disabled={busy.claim || claimedToday || daily === null}
                onClick={() => void claim()}
              >
                {busy.claim ? t('claimBusy') : claimedToday ? t('claimAlready') : t('claimButton')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 账号 */}
      <section className={CSS.panel}>
        <div className={CSS.section}>
          <span className={CSS.heading}>{t('accountHeading')}</span>
          <div className={CSS.tiles}>
            <Tile
              label={t('accountHeading')}
              value={loginLabel}
              hint={loginHint}
              tone={status.login.valid ? 'good' : 'bad'}
            />
          </div>
          <p className={CSS.hint}>
            {status.login.source === 'plugin' ? t('autoRefresh') : status.login.source === 'official' ? t('officialWeak') : t('needLogin')}
          </p>
        </div>
      </section>

      {/* 安装 */}
      <section className={CSS.panel}>
        <div className={CSS.section}>
          <span className={CSS.heading}>{t('installHeading')}</span>
          <div className={CSS.tiles}>
            <Tile
              label={t('installId')}
              value={status.installationId === null ? '—' : '已生成'}
              hint={status.installationId === null ? undefined : status.installationId}
            />
            <Tile
              label={t('installRegistered')}
              value={status.installationRegistered ? t('installRegistered') : t('installPending')}
              hint={status.registeredAt ? t('registeredAt', { time: formatTime(status.registeredAt) }) : t('never')}
              tone={status.installationRegistered ? 'good' : 'warn'}
            />
          </div>
        </div>
      </section>

      {/* 模型 */}
      <section className={CSS.panel}>
        <div className={CSS.section}>
          <div className={CSS.row}>
            <span className={CSS.heading}>
              {t('modelsHeading')} · {t('modelsCount', { count: status.models.length })}
            </span>
            <div className={CSS.actions}>
              <button
                type="button"
                className={CSS.button}
                disabled={busy.sync}
                onClick={() => void sync()}
              >
                {busy.sync ? t('syncBusy') : t('syncButton')}
              </button>
              <button
                type="button"
                className={CSS.button}
                disabled={busy.refresh}
                onClick={() => void refresh(true)}
              >
                {busy.refresh ? t('refreshBusy') : t('refreshButton')}
              </button>
            </div>
          </div>
          {status.models.length === 0
            ? <p className={CSS.hint}>{t('modelEmpty')}</p>
            : (
              <table className={CSS.table}>
                <thead>
                  <tr>
                    <th className={CSS.tableHeader}>{t('modelName')}</th>
                    <th className={CSS.tableHeader}>{t('modelContext')}</th>
                  </tr>
                </thead>
                <tbody>
                  {status.models.map((model) => (
                    <tr key={model.id} className={CSS.tableRow}>
                      <td className={`${CSS.tableCell} ${CSS.mono}`}>{model.id}</td>
                      <td className={`${CSS.tableCell} ${CSS.dash}`}>
                        {model.contextWindow === undefined ? '—' : model.contextWindow.toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <p className={CSS.hint}>
            {t('lastSync', { time: status.lastSyncAt ? formatTime(status.lastSyncAt) : t('never') })}
          </p>
        </div>
      </section>
    </div>
  )
}
