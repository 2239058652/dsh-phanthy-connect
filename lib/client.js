window.__ModuleLoader__.load({
	id: "dsh-phanthy-connect",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/card-css.ts
		/**
		* Stylesheet for the Phanthy plugin page.
		*
		* DSH ships its card shell inside a package that exports only `apply`/`inject`,
		* so a third-party card cannot import the official CSS module. The class names
		* below are a namespaced copy of that shell's tokens (`--color-*`, 16px radius,
		* hairline borders) so this page looks native instead of foreign.
		*
		* Injected once, tagged with this plugin's id: a DSH restyle can leave it
		* looking dated, but never half-applied.
		*/
		const STYLE_TAG_ID = "dsh-phanthy-connect/Page.module.css";
		const CSS = {
			page: "dpc_page",
			panel: "dpc_panel",
			section: "dpc_section",
			heading: "dpc_heading",
			tiles: "dpc_tiles",
			tile: "dpc_tile",
			tileLabel: "dpc_tileLabel",
			tileValue: "dpc_tileValue",
			tileHint: "dpc_tileHint",
			tileGood: "dpc_tileGood",
			tileWarn: "dpc_tileWarn",
			tileBad: "dpc_tileBad",
			row: "dpc_row",
			text: "dpc_text",
			hint: "dpc_hint",
			error: "dpc_error",
			actions: "dpc_actions",
			button: "dpc_button",
			buttonPrimary: "dpc_buttonPrimary",
			buttonBusy: "dpc_buttonBusy",
			table: "dpc_table",
			tableHeader: "dpc_tableHeader",
			tableRow: "dpc_tableRow",
			tableCell: "dpc_tableCell",
			dash: "dpc_dash",
			mono: "dpc_mono"
		};
		const STYLESHEET = `
.dpc_page { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 8px; }
.dpc_panel {
  border: 1px solid var(--color-border, rgba(127,127,127,.22));
  border-radius: 12px;
  padding: 16px 18px;
  background: var(--color-surface-container-low, rgba(127,127,127,.04));
}
.dpc_section { display: flex; flex-direction: column; gap: 12px; }
.dpc_heading {
  font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--color-text-tertiary, rgba(127,127,127,.9));
}
.dpc_tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.dpc_tile {
  border: 1px solid var(--color-border, rgba(127,127,127,.22));
  border-radius: 10px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 4px;
  background: var(--color-surface, transparent);
}
.dpc_tileLabel { font-size: 12px; color: var(--color-text-tertiary, rgba(127,127,127,.9)); }
.dpc_tileValue {
  font-size: 19px; font-weight: 600; line-height: 1.25;
  color: var(--color-text-primary, inherit);
  font-variant-numeric: tabular-nums;
}
.dpc_tileHint { font-size: 11px; color: var(--color-text-tertiary, rgba(127,127,127,.9)); }
.dpc_tileGood .dpc_tileValue { color: var(--color-success, #2e9e5b); }
.dpc_tileWarn .dpc_tileValue { color: var(--color-warning, #c8871a); }
.dpc_tileBad .dpc_tileValue { color: var(--color-error, #d14343); }
.dpc_row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dpc_text { margin: 0; font-size: 13px; line-height: 1.65; color: var(--color-text-secondary, inherit); }
.dpc_hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--color-text-tertiary, rgba(127,127,127,.9)); }
.dpc_error {
  margin: 0; font-size: 12px; line-height: 1.6;
  color: var(--color-error, #d14343);
  word-break: break-word;
}
.dpc_actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dpc_button {
  appearance: none; cursor: pointer;
  border: 1px solid var(--color-border, rgba(127,127,127,.28));
  border-radius: 8px; padding: 7px 14px;
  font-size: 13px; font-weight: 500;
  color: var(--color-text-primary, inherit);
  background: var(--color-surface, transparent);
  transition: background .16s ease, border-color .16s ease;
}
.dpc_button:hover:not(:disabled) {
  background: var(--color-surface-container, rgba(127,127,127,.1));
}
.dpc_button:disabled { opacity: .55; cursor: default; }
.dpc_buttonPrimary {
  border-color: transparent;
  color: #fff;
  background: var(--color-brand, #4d6bfe);
}
.dpc_buttonPrimary:hover:not(:disabled) { filter: brightness(1.08); background: var(--color-brand, #4d6bfe); }
.dpc_buttonBusy { position: relative; color: transparent !important; }
.dpc_buttonBusy::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid currentColor; border-top-color: transparent;
  color: var(--color-text-primary, #888);
  animation: dpc_spin .7s linear infinite;
}
@keyframes dpc_spin { to { transform: rotate(360deg); } }
.dpc_table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dpc_tableHeader {
  text-align: left; font-weight: 500; font-size: 11px; letter-spacing: .04em;
  text-transform: uppercase; color: var(--color-text-tertiary, rgba(127,127,127,.9));
  padding: 6px 10px; border-bottom: 1px solid var(--color-border, rgba(127,127,127,.22));
}
.dpc_tableRow:hover { background: var(--color-surface-container, rgba(127,127,127,.06)); }
.dpc_tableCell {
  padding: 8px 10px; border-bottom: 1px solid var(--color-border, rgba(127,127,127,.12));
  color: var(--color-text-secondary, inherit);
}
.dpc_dash { color: var(--color-text-tertiary, rgba(127,127,127,.7)); }
.dpc_mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
`;
		/** Inject once; the tag id is namespaced so two plugins cannot collide. */
		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-phanthy-connect";
			tag.dataset.pluginCss = STYLE_TAG_ID;
			tag.textContent = STYLESHEET;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/status-paths.ts
		/** 插件页与宿主之间的数据契约，两端共用同一份形状。 */
		const STATUS_PATH = "/plugins/dsh-phanthy-connect/status";
		const CLAIM_PATH = "/plugins/dsh-phanthy-connect/claim";
		//#endregion
		//#region src/client/use-phanthy-status.ts
		/** 与宿主状态路由通信：读状态、触发签到、触发同步。 */
		/** 只发同源请求；DSH 的 web 界面与插件路由同源，所以不带凭据也能读。 */
		async function request(path, method = "GET", body) {
			const response = await fetch(path, {
				method,
				...body === void 0 ? {} : {
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body)
				}
			});
			const text = await response.text();
			let payload = null;
			try {
				payload = JSON.parse(text);
			} catch {
				payload = null;
			}
			if (!response.ok) {
				const message = payload?.error;
				throw new Error(message ?? `HTTP ${response.status}`);
			}
			return payload;
		}
		function usePhanthyStatus(options = {}) {
			const { pollMs } = options;
			const [status, setStatus] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)({
				claim: false,
				sync: false,
				refresh: false
			});
			const mounted = (0, react.useRef)(true);
			const load = (0, react.useCallback)(async (kind = "silent") => {
				if (kind === "refresh") setBusy((current) => ({
					...current,
					refresh: true
				}));
				try {
					const next = await request(STATUS_PATH);
					if (!mounted.current) return;
					setStatus(next);
					setError(null);
				} catch (failure) {
					if (!mounted.current) return;
					setError(failure instanceof Error ? failure.message : String(failure));
				} finally {
					if (!mounted.current) return;
					setLoading(false);
					if (kind === "refresh") setBusy((current) => ({
						...current,
						refresh: false
					}));
				}
			}, []);
			/** 对外只暴露 `refresh(force?)`，`force` 保留只为与页面里旧调用点兼容。 */
			const refresh = (0, react.useCallback)((force) => load(force === true ? "refresh" : "silent"), [load]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				load("silent");
				if (pollMs === void 0) return () => {
					mounted.current = false;
				};
				const timer = window.setInterval(() => {
					load("silent");
				}, pollMs);
				return () => {
					mounted.current = false;
					window.clearInterval(timer);
				};
			}, [load, pollMs]);
			return {
				status,
				loading,
				error,
				busy,
				refresh,
				claim: (0, react.useCallback)(async () => {
					setBusy((current) => ({
						...current,
						claim: true
					}));
					try {
						const result = await request(CLAIM_PATH, "POST", {});
						await load("silent");
						return result;
					} catch (failure) {
						setError(failure instanceof Error ? failure.message : String(failure));
						return null;
					} finally {
						if (mounted.current) setBusy((current) => ({
							...current,
							claim: false
						}));
					}
				}, [load]),
				sync: (0, react.useCallback)(async () => {
					setBusy((current) => ({
						...current,
						sync: true
					}));
					try {
						const next = await request(STATUS_PATH);
						if (mounted.current) {
							setStatus(next);
							setError(null);
						}
						return next.models.length;
					} catch (failure) {
						setError(failure instanceof Error ? failure.message : String(failure));
						return null;
					} finally {
						if (mounted.current) setBusy((current) => ({
							...current,
							sync: false
						}));
					}
				}, [])
			};
		}
		/** 把毫秒时间戳格式化成界面上好读的本地时间。 */
		function formatTime(ms) {
			if (!ms) return "—";
			try {
				return new Date(ms).toLocaleString("zh-CN", {
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit"
				});
			} catch {
				return String(ms);
			}
		}
		/** 大数字加千分位，积分动辄上万。 */
		function formatPoints(value) {
			if (value === void 0 || value === null || Number.isNaN(value)) return "—";
			return value.toLocaleString("zh-CN");
		}
		//#endregion
		//#region src/client/PhanthyPluginPage.tsx
		/** 一个统计块。`tone` 只在有明确好坏时用，别为好看而染色。 */
		function Tile({ label, value, hint, tone }) {
			const toneClass = tone === "good" ? CSS.tileGood : tone === "warn" ? CSS.tileWarn : tone === "bad" ? CSS.tileBad : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: [CSS.tile, toneClass].filter(Boolean).join(" "),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.tileLabel,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.tileValue,
						children: value
					}),
					hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.tileHint,
						children: hint
					})
				]
			});
		}
		function PhanthyPluginPage({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PhanthyPageBody, {
				t,
				controller: usePhanthy()
			});
		}
		function usePhanthy() {
			return usePhanthyStatus({ pollMs: 6e4 });
		}
		function PhanthyPageBody({ t, controller }) {
			const { status, loading, error, busy, refresh, claim, sync } = controller;
			if (loading && status === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CSS.panel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: CSS.hint,
					children: t("loading")
				})
			});
			if (status === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CSS.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: CSS.error,
					children: [t("loadFailed"), error === null ? "" : `：${error}`]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CSS.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: CSS.button,
						onClick: () => void refresh(true),
						children: t("refreshButton")
					})
				})]
			});
			const points = status.credits?.available;
			const daily = status.daily;
			const claimedToday = daily?.status === "granted_today";
			const loginLabel = status.login.source === "plugin" ? t("loginPlugin") : status.login.source === "official" ? t("loginOfficial") : t("loginNone");
			const loginHint = status.login.expiresAt ? status.login.valid ? t("validUntil", { time: formatTime(status.login.expiresAt) }) : t("expired") : status.login.source === "none" ? t("needLogin") : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CSS.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: CSS.text,
						children: t("intro")
					}),
					error !== null || status.upstreamError !== void 0 || status.lastError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: CSS.error,
							children: [
								t("errorHeading"),
								"：",
								error ?? status.upstreamError ?? status.lastError
							]
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: CSS.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CSS.heading,
									children: t("pointsHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CSS.tiles,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
											label: t("pointsAvailable"),
											value: formatPoints(points),
											hint: t("pointsHint"),
											tone: "good"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
											label: t("dailyPoints"),
											value: daily === null ? "—" : claimedToday ? `+${formatPoints(daily.points)}` : t("dailyEligible"),
											hint: daily === null ? void 0 : t("dailyGranted"),
											tone: daily === null ? void 0 : claimedToday ? "good" : "warn"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
											label: t("dailyStreak"),
											value: daily === null || !daily.streakDay ? "—" : `${daily.streakDay}`,
											hint: daily === null || !daily.streakDay ? void 0 : t("streakUnit")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CSS.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: CSS.hint,
										children: daily === null ? t("dailyUnknown") : claimedToday ? t("dailyGranted") : t("dailyEligible")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: CSS.actions,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `${CSS.button} ${CSS.buttonPrimary}`,
											disabled: busy.claim || claimedToday || daily === null,
											onClick: () => void claim(),
											children: busy.claim ? t("claimBusy") : claimedToday ? t("claimAlready") : t("claimButton")
										})
									})]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: CSS.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CSS.heading,
									children: t("accountHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CSS.tiles,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
										label: t("accountHeading"),
										value: loginLabel,
										hint: loginHint,
										tone: status.login.valid ? "good" : "bad"
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: CSS.hint,
									children: status.login.source === "plugin" ? t("autoRefresh") : status.login.source === "official" ? t("officialWeak") : t("needLogin")
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: CSS.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS.section,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CSS.heading,
								children: t("installHeading")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CSS.tiles,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
									label: t("installId"),
									value: status.installationId === null ? "—" : "已生成",
									hint: status.installationId === null ? void 0 : status.installationId
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
									label: t("installRegistered"),
									value: status.installationRegistered ? t("installRegistered") : t("installPending"),
									hint: status.registeredAt ? t("registeredAt", { time: formatTime(status.registeredAt) }) : t("never"),
									tone: status.installationRegistered ? "good" : "warn"
								})]
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: CSS.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CSS.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: CSS.heading,
										children: [
											t("modelsHeading"),
											" · ",
											t("modelsCount", { count: status.models.length })
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CSS.actions,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CSS.button,
											disabled: busy.sync,
											onClick: () => void sync(),
											children: busy.sync ? t("syncBusy") : t("syncButton")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CSS.button,
											disabled: busy.refresh,
											onClick: () => void refresh(true),
											children: busy.refresh ? t("refreshBusy") : t("refreshButton")
										})]
									})]
								}),
								status.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: CSS.hint,
									children: t("modelEmpty")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									className: CSS.table,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: CSS.tableHeader,
										children: t("modelName")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										className: CSS.tableHeader,
										children: t("modelContext")
									})] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: status.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
										className: CSS.tableRow,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: `${CSS.tableCell} ${CSS.mono}`,
											children: model.id
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: `${CSS.tableCell} ${CSS.dash}`,
											children: model.contextWindow === void 0 ? "—" : model.contextWindow.toLocaleString("zh-CN")
										})]
									}, model.id)) })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: CSS.hint,
									children: t("lastSync", { time: status.lastSyncAt ? formatTime(status.lastSyncAt) : t("never") })
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** 插件页的文案。中英双语，跟随 DSH 界面语言。 */
		const zh = {
			intro: "PhanthyCode 账号概览。模型已注册到「Phanthy」提供方，在会话的模型选择器里即可切换。",
			pointsHeading: "积分",
			pointsAvailable: "可用积分",
			pointsHint: "签到后即时到账",
			dailyPoints: "今日签到",
			dailyStreak: "连续天数",
			streakUnit: "天",
			dailyStatusHeading: "每日签到",
			dailyEligible: "今天可以签到",
			dailyGranted: "今天已签到",
			dailyUnknown: "签到状态未知",
			claimButton: "立即签到",
			claimBusy: "签到中…",
			claimSuccess: "已签到，+{points} 积分",
			claimAlready: "今天已经签过了",
			claimFailed: "签到失败",
			accountHeading: "账号",
			loginPlugin: "插件授权",
			loginOfficial: "复用官方客户端",
			loginNone: "未登录",
			validUntil: "有效至 {time}",
			expired: "已过期",
			autoRefresh: "插件会自行续期",
			needLogin: "跑 /phanthy login 授权",
			officialWeak: "官方客户端那份不会由插件续期",
			installHeading: "安装",
			installId: "安装 ID",
			installRegistered: "已注册",
			installPending: "未注册",
			registeredAt: "注册于 {time}",
			modelsHeading: "模型",
			modelsCount: "{count} 个可用",
			modelName: "模型",
			modelContext: "上下文",
			modelEmpty: "还没有同步到模型",
			actionsHeading: "操作",
			syncButton: "重新同步模型",
			syncBusy: "同步中…",
			syncSuccess: "已同步 {count} 个模型",
			refreshButton: "刷新",
			refreshBusy: "刷新中…",
			loading: "读取中…",
			loadFailed: "读取失败",
			lastSync: "上次同步 {time}",
			never: "从未",
			errorHeading: "错误"
		};
		const en = {
			intro: "PhanthyCode account overview. Its models are registered under the \"Phanthy\" provider — pick one in the session model selector.",
			pointsHeading: "Points",
			pointsAvailable: "Available",
			pointsHint: "credited right after check-in",
			dailyPoints: "Today",
			dailyStreak: "Streak",
			streakUnit: "days",
			dailyStatusHeading: "Daily check-in",
			dailyEligible: "Available today",
			dailyGranted: "Already claimed today",
			dailyUnknown: "Status unknown",
			claimButton: "Claim now",
			claimBusy: "Claiming…",
			claimSuccess: "Claimed, +{points} points",
			claimAlready: "Already claimed today",
			claimFailed: "Check-in failed",
			accountHeading: "Account",
			loginPlugin: "Plugin sign-in",
			loginOfficial: "Reusing the official client",
			loginNone: "Not signed in",
			validUntil: "valid until {time}",
			expired: "expired",
			autoRefresh: "the plugin renews this itself",
			needLogin: "run /phanthy login",
			officialWeak: "the official client owns renewal of this one",
			installHeading: "Installation",
			installId: "Installation ID",
			installRegistered: "registered",
			installPending: "not registered",
			registeredAt: "registered {time}",
			modelsHeading: "Models",
			modelsCount: "{count} available",
			modelName: "Model",
			modelContext: "Context",
			modelEmpty: "No models synced yet",
			actionsHeading: "Actions",
			syncButton: "Re-sync models",
			syncBusy: "Syncing…",
			syncSuccess: "Synced {count} models",
			refreshButton: "Refresh",
			refreshBusy: "Refreshing…",
			loading: "Loading…",
			loadFailed: "Failed to load",
			lastSync: "Last sync {time}",
			never: "never",
			errorHeading: "Error"
		};
		//#endregion
		//#region src/client/index.tsx
		/** 浏览器插件的稳定名字。 */
		const name = "dsh-phanthy-connect-client";
		/** 需要的客户端服务；`slots` 由 dsh.client.inject 提前准备好。 */
		const inject = ["slots", "locale"];
		const LOCALE_NAMESPACE = "settings.phanthy";
		/** 与 cordis.patch.yml 里的 entry id 一致：DSH 用它在插件列表里定位这张卡片。 */
		const PACKAGE = "dsh-phanthy-connect";
		function apply(ctx) {
			ensureStyles();
			ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, {
				zh,
				en
			}), "dsh-phanthy-connect: page copy");
			const t = ctx.locale.bind(LOCALE_NAMESPACE);
			const injected = () => ({ t });
			try {
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: PACKAGE,
					locale: LOCALE_NAMESPACE,
					inject: injected
				}, PhanthyPluginPage));
			} catch (error) {
				console.error("[dsh-phanthy-connect] 插件页挂载失败:", error);
			}
		}
		//#endregion
		exports.CSS = CSS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
