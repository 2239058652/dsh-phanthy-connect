# DSH Phanthy Connect

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

把 **PhanthyCode** 账号里的模型接进 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）。

**不需要桌面端常驻**，也不需要另起代理服务：复用本机已有的 PhanthyCode 登录态，按官方的「安装证明」协议直接调上游。

## 功能

- **设置页**：**设置 → 插件 → Phanthy** 里能看到积分余额、今日签到状态与连续天数、登录态与到期时间、安装 ID、13 个模型的上下文窗口，并带「立即签到」「重新同步」「刷新」按钮。
- **零配置接入**：安装启用后，账号可用的模型出现在 DSH 的模型选择器里的「Phanthy」分组。
- **模型自动发现**：启动时从 `/api/phanthy_code/models` 拉取当前账号的模型清单（含上下文窗口）。
- **自动签到**：每次启动检查一次，当天没领就自动领取（幂等，重复启动不会多领）。
- **流式与工具调用**：走 DSH 自带的 `anthropic-messages` 协议栈，SSE 流式与 tool_use 完整可用。
- **不碰你的登录态**：官方客户端那份只读，插件自己的令牌存在自己的状态文件里。

## 为什么需要一个本地网关

PhanthyCode 的推理端点拒绝裸 Bearer：每个请求都要带一组 Ed25519 证明头，而签名**覆盖请求体的哈希**。这意味着无法用「静态请求头」的提供方路由实现，必须有个能逐请求介入的地方。

插件因此在回环地址起一个只服务本进程的网关：

```
dsh / pi-ai (anthropic-messages, 宿主自带)
   │  x-api-key: <本进程随机密钥>
   ▼
shim (127.0.0.1:随机端口)
   │  Authorization: Bearer <从磁盘现读>
   │  + x-phanthy-proof-*  (Ed25519, 覆盖 body 哈希)
   ▼
https://code.phanthy.com/v1/messages
```

> **路由的 `baseURL` 必须是 origin，不能带 `/v1`** —— Anthropic SDK 自己会拼 `/v1/messages`，写成 `.../v1` 会让实际请求变成 `/v1/v1/messages`（网关会回 404）。

真实 token 从不离开网关进程。pi-ai 拿到的是一个每次进程启动都会重新生成的随机密钥：插件把它写进 DSH 的 credentials，提供方路由以 `apiKeyEnv` 引用它。密钥只对回环有效、随进程消失。

> 为什么不用提供方路由的 `headers` 直接下发密钥？settings 是深合并写入的，`headers` 一旦写进去就不再消失——每次重启都会在路由里堆一份上一个进程的过期密钥。`apiKeyEnv` 只是个引用，解析永远取当前值。

## 前置条件

| | |
|---|---|
| **DSH** | `>= 0.2.1-rc.2 <0.3.0` |
| **Node.js** | `>= 22.19` |
| **PhanthyCode 账号** | 免费档即可，每天有签到积分；额度耗尽会由 `/phanthy status` 反映出来。 |

登录态有两条来源，任选其一：

1. **插件内授权**（推荐，不需要装官方客户端）：`/phanthy login`
2. **复用官方客户端**：装过并登录过一次 PhanthyCode CLI 或桌面端，插件只读复用 `~/.phanthy-code/.credentials.json`

## 安装

```powershell
cd <本仓库路径>
pnpm install          # 装构建所需的 devDependencies
pnpm build            # 产出 lib/client.js（设置页面的浏览器半身）

cd ~/.dsh/profiles/web
pnpm add link:<本仓库路径>/dsh-phanthy-connect
```

然后把 `dsh-phanthy-connect` 加进该 profile `package.json` 的 `dsh.profile.bundles` 数组，重启 DSH。

> 宿主半身（`index.js`）零依赖；只有设置页需要构建。`lib/` 已随仓库提交，从 npm 使用时无需自行构建。

## 首次登录

```
/phanthy login
```

**一步完成。** 插件会在 `127.0.0.1` 上随机端口起一个只服务本次授权的回调服务，用它作为 `redirect_uri`（服务端接受回环地址——官方 CLI 也这么做；实测非法域名才会被 400 拒绝），然后打开浏览器。授权完回调直接打回本机，插件自动换令牌并同步模型，**不需要复制粘贴**。

命令会立即返回并**同时打印授权链接**（不依赖浏览器是否真的弹出来）。授权在后台完成，约一两秒后用 `/phanthy status` 确认「登录态：插件自带（有效至 …）」。

> 兜底：回环服务起不来、或浏览器没能打开时，手动访问链接，授权后把页面上的 code#state 整段粘回来（`/phanthy login <授权码>`）。插件按 `#` 切开；整段跳转 URL、`code=xxx` 片段、裸 code 也都认。

此后 token 过期由插件自己用 `refresh_token` 续期，不需要再手动登录。

## 设置页

**设置 → 插件 → Phanthy** 的页面上有：

| 区域 | 内容 |
|---|---|
| 积分 | 可用积分、今日签到积分、连续天数，配「立即签到」按钮（今天领过会自动置灰） |
| 账号 | 登录态来源（插件授权 / 复用官方客户端）、到期时间、是否失效 |
| 安装 | 安装 ID、是否已注册、注册时间 |
| 模型 | 13 个模型的卡片表格（id + 上下文窗口），配「重新同步」「刷新」按钮 |

页面通过宿主注册的同源路由读数据（`/plugins/dsh-phanthy-connect/status`），**令牌与私钥从不进入浏览器**——页面只拿到「是否有效、何时到期」这类事实。

签到按钮打 `/plugins/dsh-phanthy-connect/claim`，与 `/phanthy daily claim` 是同一套逻辑。

## 每日签到

插件每次启动会检查一次签到状态，当天没领就自动领取（幂等键用安装 ID + 上游返回的 `server_date`，重复启动不会多领）。

也可以在设置页点「立即签到」，或用命令：

| 命令 | 作用 |
|---|---|
| `/phanthy daily` | 看今日签到状态、可领积分、连续天数 |
| `/phanthy daily claim` | 立刻领取 |

不需要自动签到的话，在 profile 的插件配置里加 `autoDaily: false`。

其余初始化在首次启动时自动完成：

1. 生成三对 Ed25519 密钥（installation / device / inference），存到 `$DSH_HOME/phanthy/state.json`（0600）；
2. 用 `installationId = "di_" + base64url(sha256(裸 32 字节公钥))` 向 `POST /api/oauth/desktop-installations/register` 注册本机安装（幂等）；
3. 拉取模型目录，写入 `llm-pi-ai` 的 `phanthy` 提供方路由。

## 命令

| 命令 | 作用 |
|---|---|
| `/phanthy status` | 登录态来源与有效期、安装 ID、注册时间、模型数、网关地址 |
| `/phanthy login` | 打开浏览器授权，回调自动完成登录 |
| `/phanthy login <code>` | 手动粘贴授权码（兜底） |
| `/phanthy daily` | 看今日签到状态 |
| `/phanthy daily claim` | 立刻领取签到积分 |
| `/phanthy logout` | 清除插件自己保存的登录态 |
| `/phanthy sync` | 重新拉取模型目录并写路由 |
| `/phanthy models` | 列出账号可用模型 |
| `/phanthy reinstall` | 清掉注册标记后重新注册（密钥与 installationId 保留） |

## 已知限制

- **令牌短命**：`desktop_inference_token` 有效期只有几分钟，网关会在每次请求前按需换取（带缓存与提前刷新）。
- **推理强度由宿主补齐**：插件不声明 `reasoningEfforts`，宿主的 pi-ai 适配器会为这些模型自动填充（实测写入 `off/low/high/max`）。上游返回的 thinking 内容照常解析。
- **依赖上游未公开的内部端点**：`desktop-installations/register` 与 `activities/summary` 都不是公开 API，PhanthyCode 改版可能导致失效。届时 `/phanthy status` 会显示具体错误。
- **账号上会留下安装记录**：这是协议本身要求的，第一次启动就会创建一条。

## 安全边界

- 安装私钥与 OAuth 令牌都存在 `$DSH_HOME/phanthy/state.json`，权限 0600，**未加密**。前者等价于该账号的桌面端使用凭证，后者等价于账号登录态，请按密钥对待。
- 网关只监听 `127.0.0.1`，且只接受本进程启动时生成的随机密钥；其它本地进程即使发现端口也无法使用。
- 那个随机密钥存在 DSH 的 credentials 里，每次启动被覆盖；旧值随上一个进程一起失效。
- 通过 `/phanthy login` 授权后，令牌由插件自己持有和续期。官方客户端那份 `~/.phanthy-code/.credentials.json` 始终是**只读**的：插件不会刷新或改写它（那份由官方客户端自己维护）。

## 测试

```powershell
node test/offline.test.mjs     # 离线：协议实现 + 用真实抓包回放校验签名
node scripts/smoke-shim.mjs    # 联网：起真实网关发一次请求（会消耗少量积分）
```

离线套件里最有价值的是最后三项：它会重放一条**真实抓取**的注册请求，确认本插件的消息构造能复现出服务端当时接受的签名。

## 许可

MIT，见 [LICENSE](LICENSE)。

## 免责声明

本项目仅供学习与研究使用。它复现的是 PhanthyCode 客户端的安装证明协议，可能在服务条款上存在争议，请自行评估风险。作者不对任何直接或间接损失负责。
