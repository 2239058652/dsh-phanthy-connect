/** 插件页与宿主之间的数据契约，两端共用同一份形状。 */

export const STATUS_PATH = '/plugins/dsh-phanthy-connect/status'
export const CLAIM_PATH = '/plugins/dsh-phanthy-connect/claim'

export interface PhanthyModel {
  id: string
  name: string
  contextWindow?: number
}

export interface PhanthyLogin {
  /** `plugin` = 插件自己授权的那份；`official` = 复用官方客户端；`none` = 都没有 */
  source: 'plugin' | 'official' | 'none'
  expiresAt: number
  valid: boolean
}

export interface PhanthyDaily {
  status: string
  serverDate: string | null
  points: number
  streakDay: number
}

export interface PhanthyWallet {
  availablePoints?: number
  balancePoints?: number
  accountBalancePoints?: number
  reservedPoints?: number
}

export interface PhanthyStatus {
  installationId: string | null
  installationRegistered: boolean
  registeredAt: number
  models: PhanthyModel[]
  lastSyncAt: number
  lastError: string | null
  login: PhanthyLogin
  daily: PhanthyDaily | null
  wallet: PhanthyWallet | null
  /** 上游读失败时的原因；其余字段仍然可用。 */
  upstreamError?: string
}

export interface ClaimResult {
  claimed: boolean
  points?: number
  daily: PhanthyDaily
}
