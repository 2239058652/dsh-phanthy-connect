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

const STYLE_TAG_ID = 'dsh-phanthy-connect/Page.module.css'

export const CSS = {
  page: 'dpc_page',
  panel: 'dpc_panel',
  section: 'dpc_section',
  heading: 'dpc_heading',
  tiles: 'dpc_tiles',
  tile: 'dpc_tile',
  tileLabel: 'dpc_tileLabel',
  tileValue: 'dpc_tileValue',
  tileHint: 'dpc_tileHint',
  tileGood: 'dpc_tileGood',
  tileWarn: 'dpc_tileWarn',
  tileBad: 'dpc_tileBad',
  row: 'dpc_row',
  text: 'dpc_text',
  hint: 'dpc_hint',
  error: 'dpc_error',
  actions: 'dpc_actions',
  button: 'dpc_button',
  buttonPrimary: 'dpc_buttonPrimary',
  buttonBusy: 'dpc_buttonBusy',
  table: 'dpc_table',
  tableHeader: 'dpc_tableHeader',
  tableRow: 'dpc_tableRow',
  tableCell: 'dpc_tableCell',
  dash: 'dpc_dash',
  mono: 'dpc_mono',
} as const

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
`

/** Inject once; the tag id is namespaced so two plugins cannot collide. */
export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-phanthy-connect'
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = STYLESHEET
  document.head.appendChild(tag)
}
