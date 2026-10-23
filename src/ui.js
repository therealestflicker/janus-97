import { scan, riskLabel, ZW_RE } from './scanner.js';
import { parseActions, describe } from './agent.js';
import { evaluate, THRESHOLD } from './gate.js';
import { SAMPLES, getSample } from './samples.js';
import { runRedTeam } from './redteam.js';
import { llmAnalyze, PROVIDERS } from './llm.js';
import * as audit from './audit.js';
import { analyzeBatch, batchToCsv, BATCH_TEMPLATE_CSV, DEMO_BATCH_CSV, parseCsv } from './batch.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const VLABEL = { ALLOWED: 'ALLOWED', HELD: 'HELD', HUMAN: 'NEEDS HUMAN APPROVAL', BLOCKED: 'BLOCKED' };
const LEVEL = [[25, '#22c55e'], [50, '#f59e0b'], [75, '#fb7185'], [101, '#ff3355']];
const INPUT_KEY = 'janus97.input';
const state = { llmOn: false, batchResults: [] };
let liveTimer = null;

function banner(msg, level = '') {
  const b = $('banner');
  if (!msg) { b.hidden = true; return; }
  b.textContent = msg; b.className = `banner mx-auto mt-4 max-w-7xl ${level}`; b.hidden = false;
}

/* ---------- Face 1 rendering ---------- */
function renderMeter(res) {
  const color = (LEVEL.find(([max]) => res.score < max) || LEVEL[3])[1];
  $('meterNum').textContent = res.score; $('meterNum').style.color = color;
  $('meterLabel').textContent = res.label; $('meterLabel').style.color = color;
  const bar = $('meterBar'); bar.style.width = res.score + '%'; bar.style.background = color; bar.style.color = color;
  $('meterWrap').setAttribute('aria-valuenow', String(res.score));
}

function renderHighlight(text, findings) {
  const cap = Math.min(text.length, 20000);
  const marks = new Array(cap).fill(null);
  for (const f of findings) {
    if (f.start < 0) continue;
    for (let i = f.start; i < Math.min(f.end, cap); i++) marks[i] = marks[i] || f.type;
  }
  const frag = document.createDocumentFragment();
  let buf = '', cur = null;
  const flush = () => {
    if (!buf) return;
    if (cur) frag.append(h('mark', `hl hl-${cur}`, buf)); else frag.append(document.createTextNode(buf));
    buf = '';
  };
  for (let i = 0; i < cap; i++) {
    const ch = text[i];
    if (ZW_RE.test(ch)) { flush(); const z = h('span', 'zw', 'ZW'); z.title = 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'); frag.append(z); continue; }
    if (marks[i] !== cur) { flush(); cur = marks[i]; }
    buf += ch;
  }
  flush();
  if (text.length > cap) frag.append(document.createTextNode('\n… (display truncated)'));
  $('highlight').replaceChildren(frag);
}

function renderFindings(res, extra = []) {
  const ul = $('findings'); ul.replaceChildren();
  if (!res.findings.length && !extra.length) { ul.append(h('li', 'none', '✓ No suspicious patterns detected by the heuristics.')); return; }
  for (const f of res.findings) {
    const li = h('li', 'find');
    li.append(h('b', null, f.label));
    if (f.snippet) li.append(h('code', null, '“' + f.snippet + '”'));
    li.append(h('span', 'w', '+' + f.weight));
    ul.append(li);
  }
  for (const t of extra) {
    const li = h('li', 'find'); li.style.borderLeftColor = '#00f0ff';
    li.append(h('b', null, '🤖 LLM: ' + t.name));
    if (t.quote) li.append(h('code', null, '“' + t.quote + '”'));
    ul.append(li);
  }
}

function renderScan(res, text, extra = []) { renderMeter(res); renderHighlight(text, res.findings); renderFindings(res, extra); }
function liveScan() { const t = $('input').value; const r = scan(t); renderScan(r, t); return r; }

/* ---------- Face 2 rendering ---------- */
function gatePlaceholder(msg) { $('gate').replaceChildren(h('p', 'text-sm text-slate-500', msg)); }

function renderGate(items, score) {
  const box = $('gate'); box.replaceChildren();
  if (!items.length) { box.append(h('p', 'text-sm text-slate-400', 'The agent found no money-moving or data-sending instructions in this document.')); return; }
  for (const { action, result } of items) {
    const card = h('div', `card v-${result.verdict}`);
    const row = h('div', 'row');
    row.append(h('div', 'font-semibold text-sm', describe(action)));
    row.append(h('span', `badge b-${result.verdict}`, VLABEL[result.verdict]));
    card.append(row);
    card.append(h('div', 'sub', `Rule ${result.ruleId} — ${result.reason}`));
    card.append(h('div', 'sub', `Origin: ${action.origin} · parsed by ${action.source}`));
    if (result.verdict === 'HUMAN') {
      const act = h('div', 'mt-2 flex gap-2');
      const mk = (label, cls, decision) => {
        const b = h('button', `btn ${cls}`, label);
        b.onclick = () => {
          audit.add({ event: 'human_decision', score, verdict: decision, ruleId: 'G3', detail: describe(action) });
          act.replaceChildren(h('span', 'text-sm font-bold ' + (decision === 'APPROVED' ? 'text-green-400' : 'text-rose-400'), `Human decision: ${decision}`));
          renderAudit();
        };
        return b;
      };
      act.append(mk('✔ Approve', 'btn-cy', 'APPROVED'), mk('✖ Reject', 'btn-red', 'REJECTED'));
      card.append(act);
    }
    box.append(card);
  }
}

/* ---------- actions ---------- */
async function llmPass(text) {
  $('llmOut').hidden = true;
  if (!state.llmOn) return null;
  const key = $('llmKey').value.trim();
  if (!key) { banner('LLM judge is on but no API key was entered — local scanner + gate only.'); return null; }
  banner('🤖 Asking the LLM judge… (up to 60 s)', 'info');
  for (const id of ['btnScan', 'btnFull']) $(id).disabled = true;
  try {
    const g = await llmAnalyze(text, { key });
    banner('');
    const out = $('llmOut'); out.textContent = `🤖 LLM verdict (${PROVIDERS[g.provider]?.label || g.provider} · ${g.model}) — risk ${g.risk}/100. ${g.summary}`; out.hidden = false;
    return g;
  } catch (e) { banner(`LLM judge unavailable (${e.message}). Fell back to local scanner + gate.`, 'err'); return null; }
  finally { for (const id of ['btnScan', 'btnFull']) $(id).disabled = false; }
}

async function scanOnly() {
  banner('');
  const t = $('input').value; const r = scan(t); renderScan(r, t);
  const g = await llmPass(t);
  let eff = r.score;
  if (g) { eff = Math.max(eff, g.risk); renderScan({ score: eff, label: riskLabel(eff), findings: r.findings }, t, g.techniques); }
  audit.add({ event: 'scan', score: eff, verdict: riskLabel(eff), detail: `${r.findings.length} heuristic finding(s)${g ? `, LLM risk ${g.risk}` : ''}` });
  renderAudit(); return r;
}

async function analyze({ blind = false } = {}) {
  banner('');
  const t = $('input').value; const res = scan(t); renderScan(res, t);
  const actions = parseActions(t);
  let eff = res.score;
  const g = await llmPass(t);
  if (g) {
    eff = Math.max(eff, g.risk);
    renderScan({ score: eff, label: riskLabel(eff), findings: res.findings }, t, g.techniques);
    const seen = new Set(actions.map((a) => [a.type, a.amount, a.account].join('|')));
    for (const a of g.actions) if (!seen.has([a.type, a.amount, a.account].join('|'))) actions.push(a);
  }
  if (blind) { eff = 0; banner('Simulation: scanner BLINDED (score forced to 0). Watch the Action Gate hold the line.', 'info'); }
  if (!actions.length && eff >= 70) actions.push({ type: 'ingest', origin: 'document', source: 'gate', amount: null, account: null, payee: null, text: 'document' });

  audit.add({ event: 'analysis', score: eff, verdict: blind ? 'BLIND' : riskLabel(eff), detail: `${actions.length} action(s) proposed${g ? `; LLM risk ${g.risk}` : ''}` });
  const items = actions.map((action) => ({ action, result: evaluate(action, { score: eff }) }));
  for (const { action, result } of items) audit.add({ event: 'gate', score: eff, verdict: result.verdict, ruleId: result.ruleId, detail: describe(action) });
  renderGate(items, eff); renderAudit();
  $('gate').scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  return items;
}

function loadText(text) {
  const el = $('input'); el.value = text;
  try { localStorage.setItem(INPUT_KEY, text); } catch { /* ignore */ }
  liveScan(); gatePlaceholder('Click “Run full analysis” to see what the agent would do — and what the gate allows.');
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/* ---------- batch screening ---------- */
function setBatchStatus(message, isError = false) {
  const status = $('batchStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function renderBatch() {
  const results = state.batchResults;
  const counts = results.reduce((acc, result) => {
    acc[result.queue] += 1;
    return acc;
  }, { PRIORITY: 0, REVIEW: 0, 'LOW SIGNAL': 0 });
  $('batchTotal').textContent = results.length ? results.length.toLocaleString() : '—';
  $('batchPriority').textContent = results.length ? counts.PRIORITY.toLocaleString() : '—';
  $('batchReview').textContent = results.length ? counts.REVIEW.toLocaleString() : '—';
  $('batchLow').textContent = results.length ? counts['LOW SIGNAL'].toLocaleString() : '—';
  $('batchExport').disabled = !results.length;

  const query = $('batchSearch').value.trim().toLowerCase();
  const filter = $('batchFilter').value;
  const filtered = results
    .filter((item) => filter === 'ALL' || item.queue === filter)
    .filter((item) => !query || `${item.invoice} ${item.vendor}`.toLowerCase().includes(query))
    .sort((a, b) => b.score - a.score || a.vendor.localeCompare(b.vendor));
  const visible = filtered.slice(0, 300);
  const body = $('batchBody');
  body.replaceChildren();
  for (const item of visible) {
    const tr = h('tr', 'batch-row');
    tr.append(
      h('td', 'font-mono text-cyan-200', item.invoice),
      h('td', 'font-semibold', item.vendor),
      h('td', `batch-score score-${item.queue.toLowerCase().replace(' ', '-')}`, `${item.score} / 100`),
      h('td', `queue-cell queue-${item.queue.toLowerCase().replace(' ', '-')}`, item.queue),
      h('td', 'signal-cell', item.findings.length ? [...new Set(item.findings.map((finding) => finding.label))].slice(0, 3).join(' · ') : 'No configured signals'),
    );
    const action = h('td');
    const inspect = h('button', 'btn btn-small', 'Inspect');
    inspect.type = 'button';
    inspect.setAttribute('aria-label', `Inspect ${item.invoice} from ${item.vendor}`);
    inspect.onclick = () => {
      loadText(item.text);
      $('input').scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    };
    action.append(inspect);
    tr.append(action);
    body.append(tr);
  }
  $('batchEmpty').hidden = visible.length > 0;
  $('batchEmpty').textContent = results.length
    ? 'No invoices match the current search and queue filter.'
    : 'Your screened invoices will appear here.';
  const truncated = $('batchTruncated');
  truncated.hidden = filtered.length <= visible.length;
  truncated.textContent = `Showing ${visible.length.toLocaleString()} of ${filtered.length.toLocaleString()} matching invoices. Use search or filters to narrow the queue.`;
}

async function screenBatch(records, sourceName) {
  $('batchDemo').disabled = true;
  $('batchFile').disabled = true;
  setBatchStatus(`${sourceName} · screening ${records.length.toLocaleString()} invoices locally…`);
  try {
    const result = await analyzeBatch(records, (processed) => {
      setBatchStatus(`${sourceName} · screening ${processed.toLocaleString()} of ${records.length.toLocaleString()} invoices locally…`);
    });
    state.batchResults = result;
    renderBatch();
    const flagged = result.filter((item) => item.score >= 25).length;
    setBatchStatus(`${sourceName} · ${result.length.toLocaleString()} invoices screened locally · ${flagged.toLocaleString()} with review signals.`);
    audit.add({
      event: 'batch_screen',
      score: '',
      verdict: 'COMPLETE',
      detail: `${result.length} invoices screened; ${flagged} with review signals.`,
    });
    renderAudit();
  } finally {
    $('batchDemo').disabled = false;
    $('batchFile').disabled = false;
  }
}

async function readBatchFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    setBatchStatus('Please choose a .csv file. PDF and image ingestion are not supported yet.', true);
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setBatchStatus('This CSV is larger than the 20 MB import limit.', true);
    return;
  }
  setBatchStatus(`Reading ${file.name}…`);
  try {
    const records = parseCsv(await file.text());
    await screenBatch(records, file.name);
  } catch (error) {
    setBatchStatus(`Could not screen this CSV: ${error.message}`, true);
  }
}

function exportBatch() {
  if (!state.batchResults.length) return;
  const blob = new Blob([batchToCsv(state.batchResults)], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `janus97-screening-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function downloadBatchTemplate() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([BATCH_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }));
  link.download = 'janus97-invoice-template.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

/* ---------- red team ---------- */
function openRedTeam() {
  const rows = runRedTeam();
  const body = $('redBody'); body.replaceChildren();
  for (const r of rows) {
    const tr = h('tr');
    const c1 = h('td'); c1.append(h('b', null, r.name), h('div', 'sub', r.technique));
    const c2 = h('td'); c2.append(h('span', `badge ${r.naive.verdict === 'PASS' ? 'b-PASS' : 'b-ALLOWED'}`, r.naive.verdict === 'PASS' ? 'PASSED (fooled)' : 'BLOCKED'));
    const c3 = h('td', null, `${r.scan.score}/100 · ${r.scan.label}`);
    const c4 = h('td'); c4.append(h('span', `badge b-${r.blindVerdict}`, VLABEL[r.blindVerdict]), h('div', 'sub', 'Rule ' + r.blindRule));
    const c5 = h('td'); const b = h('button', 'btn', 'Load'); b.onclick = () => loadText(r.text); c5.append(b);
    tr.append(c1, c2, c3, c4, c5); body.append(tr);
    audit.add({ event: 'red_team', score: r.scan.score, verdict: r.blindVerdict, ruleId: r.blindRule, detail: `${r.name}: keyword firewall=${r.naive.verdict}` });
  }
  $('redteamPanel').hidden = false; renderAudit();
  $('redteamPanel').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

/* ---------- audit ---------- */
function renderAudit() {
  const rows = audit.all();
  const body = $('auditBody'); body.replaceChildren();
  for (const r of rows.slice(-60).reverse()) {
    const tr = h('tr');
    tr.append(h('td', 'whitespace-nowrap text-slate-400', r.ts.replace('T', ' ').slice(0, 19)), h('td', null, r.event), h('td', null, String(r.score)),
      h('td', 'font-semibold', r.verdict), h('td', null, r.ruleId), h('td', 'text-slate-300', r.detail));
    body.append(tr);
  }
  $('auditEmpty').hidden = rows.length > 0;
  $('btnCsv').disabled = rows.length === 0;
}

function exportCSV() {
  const blob = new Blob([audit.toCSV()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `janus97-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- init ---------- */
export function initUI() {
  const batchFile = $('batchFile');
  const uploadCard = document.querySelector('.upload-card');
  batchFile.addEventListener('change', () => {
    readBatchFile(batchFile.files[0]);
    batchFile.value = '';
  });
  $('batchDemo').onclick = async () => {
    try { await screenBatch(parseCsv(DEMO_BATCH_CSV), 'Hackathon demo batch'); }
    catch (error) { setBatchStatus(`Demo batch failed: ${error.message}`, true); }
  };
  $('batchExport').onclick = exportBatch;
  $('batchTemplate').onclick = downloadBatchTemplate;
  $('batchSearch').addEventListener('input', renderBatch);
  $('batchFilter').addEventListener('change', renderBatch);
  uploadCard.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadCard.classList.add('dragging');
  });
  uploadCard.addEventListener('dragleave', () => uploadCard.classList.remove('dragging'));
  uploadCard.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadCard.classList.remove('dragging');
    readBatchFile(event.dataTransfer.files[0]);
  });

  const chips = $('samples');
  for (const s of SAMPLES) {
    const b = h('button', 'chip'); b.type = 'button';
    b.append(h('b', null, s.name), h('span', null, s.blurb));
    b.onclick = () => loadText(s.text);
    chips.append(b);
  }
  try { const saved = localStorage.getItem(INPUT_KEY); if (saved) $('input').value = saved; } catch { /* ignore */ }

  $('input').addEventListener('input', () => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      liveScan();
      try { localStorage.setItem(INPUT_KEY, $('input').value); } catch { /* ignore */ }
      gatePlaceholder('Input changed — run full analysis to evaluate agent actions.');
    }, 80);
  });
  $('input').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); analyze(); } });
  $('btnScan').onclick = scanOnly;
  $('btnFull').onclick = () => analyze();
  $('btnClear').onclick = () => { $('input').value = ''; try { localStorage.removeItem(INPUT_KEY); } catch { /* ignore */ } liveScan(); gatePlaceholder('Nothing analysed yet.'); banner(''); $('input').focus(); };
  $('btnRed').onclick = openRedTeam;
  $('btnCsv').onclick = exportCSV;
  $('btnLogClear').onclick = () => { if (confirm('Clear the entire audit log?')) { audit.clear(); renderAudit(); } };
    $('llmToggle').onchange = (e) => { state.llmOn = e.target.checked; $('llmPanel').hidden = !state.llmOn; if (state.llmOn) $('llmKey').focus(); };

  liveScan(); gatePlaceholder('Load a sample and click “Run full analysis”.'); renderAudit();

  return {
    load: (id) => { const s = getSample(id); if (s) loadText(s.text); },
    analyze,
    redteam: openRedTeam,
    reset: () => { $('redteamPanel').hidden = true; $('input').value = ''; liveScan(); gatePlaceholder('Nothing analysed yet.'); banner(''); window.scrollTo?.({ top: 0, behavior: 'smooth' }); },
    focusLog: () => $('auditPanel').scrollIntoView?.({ behavior: 'smooth', block: 'center' }),
    threshold: THRESHOLD,
  };
}
