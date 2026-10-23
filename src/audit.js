const KEY = 'janus97.audit';
const MAX = 1000;
let mem = null;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(mem)) mem = []; } catch { mem = []; }
  return mem;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage full/disabled: keep in memory */ } }

export function add({ event, score = '', verdict = 'n/a', ruleId = '', detail = '' }) {
  const log = load();
  const row = { ts: new Date().toISOString(), event, score, verdict, ruleId, detail: String(detail).slice(0, 300) };
  log.push(row);
  if (log.length > MAX) log.splice(0, log.length - MAX);
  save();
  return row;
}
export const all = () => load();
export function clear() { mem = []; save(); }

const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function toCSV() {
  const head = ['timestamp', 'event', 'risk_score', 'verdict', 'rule', 'detail'];
  const rows = load().map((r) => [r.ts, r.event, r.score, r.verdict, r.ruleId, r.detail].map(cell).join(','));
  return '\ufeff' + [head.join(','), ...rows].join('\r\n');
}
