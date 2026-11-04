/**
 * 浏览器半身：往「设置 → 插件 → Phanthy」挂一个账号与积分页面。
 *
 * 页面只读宿主的状态路由（同源 JSON），令牌与私钥永远不进入浏览器。
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { CSS, ensureStyles } from './card-css.ts'
import { PhanthyPluginPage } from './PhanthyPluginPage.tsx'
import { en, zh } from './locales.ts'
import type { PhanthyMessageKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.phanthy': PhanthyMessageKey
  }
}

/** 浏览器插件的稳定名字。 */
export const name = 'dsh-phanthy-connect-client'

/** 需要的客户端服务；`slots` 由 dsh.client.inject 提前准备好。 */
export const inject = ['slots', 'locale']

const LOCALE_NAMESPACE = 'settings.phanthy'
/** 与 cordis.patch.yml 里的 entry id 一致：DSH 用它在插件列表里定位这张卡片。 */
const PACKAGE = 'dsh-phanthy-connect'

export function apply(ctx: ClientContext): void {
  ensureStyles()
  ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }), 'dsh-phanthy-connect: page copy')
  const t = ctx.locale.bind(LOCALE_NAMESPACE) as (key: PhanthyMessageKey, params?: Record<string, unknown>) => string
  const injected = (): { t: typeof t } => ({ t })

  try {
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: PACKAGE,
      locale: LOCALE_NAMESPACE,
      inject: injected,
    }, PhanthyPluginPage))
  } catch (error: unknown) {
    // 插槽 API 变更时降级为一行错误，别把整个插件通道带下去。
    console.error('[dsh-phanthy-connect] 插件页挂载失败:', error)
  }
}

export { CSS }
