/** 插件页的文案。中英双语，跟随 DSH 界面语言。 */

export const zh = {
  intro: 'PhanthyCode 账号概览。模型已注册到「Phanthy」提供方，在会话的模型选择器里即可切换。',

  pointsHeading: '积分',
  pointsAvailable: '可用积分',
  pointsHint: '签到后即时到账',
  dailyPoints: '今日签到',
  dailyStreak: '连续天数',
  streakUnit: '天',

  dailyStatusHeading: '每日签到',
  dailyEligible: '今天可以签到',
  dailyGranted: '今天已签到',
  dailyUnknown: '签到状态未知',
  claimButton: '立即签到',
  claimBusy: '签到中…',
  claimSuccess: '已签到，+{points} 积分',
  claimAlready: '今天已经签过了',
  claimFailed: '签到失败',

  accountHeading: '账号',
  loginPlugin: '插件授权',
  loginOfficial: '复用官方客户端',
  loginNone: '未登录',
  validUntil: '有效至 {time}',
  expired: '已过期',
  autoRefresh: '插件会自行续期',
  needLogin: '跑 /phanthy login 授权',
  officialWeak: '官方客户端那份不会由插件续期',

  installHeading: '安装',
  installId: '安装 ID',
  installRegistered: '已注册',
  installPending: '未注册',
  registeredAt: '注册于 {time}',

  modelsHeading: '模型',
  modelsCount: '{count} 个可用',
  modelName: '模型',
  modelContext: '上下文',
  modelEmpty: '还没有同步到模型',

  actionsHeading: '操作',
  syncButton: '重新同步模型',
  syncBusy: '同步中…',
  syncSuccess: '已同步 {count} 个模型',
  refreshButton: '刷新',
  refreshBusy: '刷新中…',

  loading: '读取中…',
  loadFailed: '读取失败',
  lastSync: '上次同步 {time}',
  never: '从未',
  errorHeading: '错误',
} as const

export type PhanthyMessageKey = keyof typeof zh

export const en: Record<PhanthyMessageKey, string> = {
  intro: 'PhanthyCode account overview. Its models are registered under the "Phanthy" provider — pick one in the session model selector.',

  pointsHeading: 'Points',
  pointsAvailable: 'Available',
  pointsHint: 'credited right after check-in',
  dailyPoints: 'Today',
  dailyStreak: 'Streak',
  streakUnit: 'days',

  dailyStatusHeading: 'Daily check-in',
  dailyEligible: 'Available today',
  dailyGranted: 'Already claimed today',
  dailyUnknown: 'Status unknown',
  claimButton: 'Claim now',
  claimBusy: 'Claiming…',
  claimSuccess: 'Claimed, +{points} points',
  claimAlready: 'Already claimed today',
  claimFailed: 'Check-in failed',

  accountHeading: 'Account',
  loginPlugin: 'Plugin sign-in',
  loginOfficial: 'Reusing the official client',
  loginNone: 'Not signed in',
  validUntil: 'valid until {time}',
  expired: 'expired',
  autoRefresh: 'the plugin renews this itself',
  needLogin: 'run /phanthy login',
  officialWeak: 'the official client owns renewal of this one',

  installHeading: 'Installation',
  installId: 'Installation ID',
  installRegistered: 'registered',
  installPending: 'not registered',
  registeredAt: 'registered {time}',

  modelsHeading: 'Models',
  modelsCount: '{count} available',
  modelName: 'Model',
  modelContext: 'Context',
  modelEmpty: 'No models synced yet',

  actionsHeading: 'Actions',
  syncButton: 'Re-sync models',
  syncBusy: 'Syncing…',
  syncSuccess: 'Synced {count} models',
  refreshButton: 'Refresh',
  refreshBusy: 'Refreshing…',

  loading: 'Loading…',
  loadFailed: 'Failed to load',
  lastSync: 'Last sync {time}',
  never: 'never',
  errorHeading: 'Error',
}
