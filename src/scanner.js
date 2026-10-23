// FACE 1 — heuristic scanner. Aggressive, explainable, may miss things (Face 2 covers that).
export const ZW_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;
const ZW_RUN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]+/g;
const HOMO_CLASS = '\\u0430\\u0435\\u043E\\u0440\\u0441\\u0445\\u0456\\u0455\\u0458';
const HOMO_RE = new RegExp(`[A-Za-z][${HOMO_CLASS}]|[${HOMO_CLASS}][A-Za-z]`, 'g');
const HOMO = { '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0445': 'x', '\u0456': 'i', '\u0455': 's', '\u0458': 'j' };

// Strip invisible chars + fold look-alike letters. map[i] = index in original text.
export function normalize(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ZW_RE.test(ch)) continue;
    out += HOMO[ch] || (ch === '\u2019' || ch === '\u02BC' ? "'" : ch);
    map.push(i);
  }
  return { out, map };
}

const RULES = [
  { type: 'override', label: 'Instruction-override phrase', weight: 35,
    re: /\b(?:ignore|disregard|forget|override)\b[^\n.]{0,25}\b(?:previous|prior|above|earlier|all|any|your)\b[^\n.]{0,25}\b(?:instructions?|rules?|prompts?|polic(?:y|ies)|guidelines?)\b/gi },
  { type: 'override', label: 'Role / system-prompt injection', weight: 25,
    re: /(?:^|\n)\s*(?:system|assistant|developer)\s*:|\byou are now\b|\bdeveloper mode\b|\bjailbreak\b|\bnew instructions?\s*:/gi },
  { type: 'bank', label: 'Bank-detail change language', weight: 30,
    re: /\b(?:change(?:d|s|ing)?|updat(?:e|ed|es|ing)|replac(?:e|ed|es|ing)|switch(?:ed|es|ing)?|modif(?:y|ied|ies|ying)|redirect(?:ed|s|ing)?|set)\b[^\n]{0,80}?\b(?:bank|account|iban|beneficiary|routing)\b/gi },
  { type: 'urgency', label: 'Urgency / authority pressure', weight: 10,
    re: /\b(?:urgent(?:ly)?|immediately|asap|do not delay|wire (?:the )?funds|confidential|ceo (?:approved|request))\b/gi },
  { type: 'urgency-threat', label: 'Threat or extreme payment deadline', weight: 20,
    re: /\b(?:final disconnect notice|within\s+\d+\s*(?:minutes?|hours?)|immediate termination|without further warning|process today)\b/gi },
  { type: 'approval-bypass', label: 'Request to bypass normal approval controls', weight: 30,
    re: /\b(?:bypass|circumvent|skip|do not route through|avoid)\b[^\n.]{0,80}\b(?:standard|verification|approval|portal|protocol|accounts payable|ap)\b/gi },
  { type: 'authority-claim', label: 'Unverified authority or pre-approval claim', weight: 20,
    re: /\b(?:per|by)\s+(?:the\s+)?(?:ceo|chief executive|department head|internal audit|compliance committee)\b|\b(?:pre[- ]cleared|pre[- ]approved)\b/gi },
  { type: 'out-of-office', label: 'Out-of-office or verbal-approval pressure', weight: 20,
    re: /\b(?:out of office|verbal(?:ly)? authori[sz]ed|gave verbal approval)\b/gi },
  { type: 'hidden-instruction', label: 'Hidden or metadata instruction', weight: 30,
    re: /\b(?:white[- ]on[- ]white|white text|hidden (?:block|text|instruction)|metadata.{0,30}(?:instruction|prompt|command))\b/gi },
  { type: 'financial-mismatch', label: 'Remittance country or account-holder mismatch', weight: 25,
    re: /\b(?:uk|united kingdom|london|manchester)\b[\s\S]{0,180}\b(?:swiss|switzerland)\b|\b(?:swiss|switzerland)\b[\s\S]{0,180}\b(?:uk|united kingdom|london|manchester)\b|\b(?:swiss|switzerland)\b[\s\S]{0,100}\b(?:different corporate name|different account holder|unrelated account holder)\b|\b(?:account holder|account name)\b[\s\S]{0,60}\b(?:different|unrelated|another company)\b/gi },
  { type: 'vague-billing', label: 'Vague or non-specific invoice line items', weight: 15,
    re: /\b(?:general consulting deliverables|administrative overhead adjustment|internal support services|miscellaneous services)\b/gi },
  { type: 'threshold-evasion', label: 'Amount positioned just below approval threshold', weight: 15,
    re: /\b(?:strategically|deliberately|just|kept)\b[^\n.]{0,35}\b(?:under|below)\b[^\n.]{0,20}\b(?:\$?\s*5,?000|approval threshold|approval limit)\b/gi },
  { type: 'lookalike-vendor', label: 'Vendor name resembles a well-known brand', weight: 20,
    re: /\bmicrosoff\b/gi },
  { type: 'fake-payment-link', label: 'Unverified payment destination', weight: 20,
    re: /\b(?:random|unverified)\b[^\n.]{0,35}\b(?:digital wallet|bank account|payment link)\b/gi },
  { type: 'comment', label: 'Hidden HTML comment', weight: 30, re: /<!--[\s\S]*?(?:-->|$)/g },
  { type: 'hidden-style', label: 'Hidden styling (invisible text)', weight: 25,
    re: /(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?:px|pt|em|rem)?(?![.\d])|opacity\s*:\s*0(?![.\d])|color\s*:\s*(?:#fff(?:fff)?|white)\b|text-indent\s*:\s*-\d{3,})/gi },
  { type: 'script', label: 'Embedded code / script', weight: 35,
    re: /<script\b[\s\S]*?(?:<\/script>|$)|javascript\s*:|\beval\s*\(|\brm\s+-rf\b|\bcurl\b[^\n]*\|\s*(?:sh|bash)\b|\bpowershell\b[^\n]*-enc/gi },
];

const RECIPIENT = String.raw`(?:(?:the|this|that|any|our|your|all)\s+)*(?:end\s+user|user|human|operator|admin(?:istrator)?|customer|client|recipient|accounts\s+payable|ap\s+team|finance\s+team|auditors?|staff|employees?|anyone|anybody|everyone|any\s+person|no\s+one|nobody|public|vendor)`;
const GAP = String.raw`(?:[\s,;:()[\]—-]+[\w'-]+){0,7}[\s,;:()[\]—-]*`;
const NEGATION = String.raw`(?:do\s+not|don't|dont|never|must\s+(?:not|never)|mustn't|mustnt|should\s+(?:not|never)|shouldn't|shouldnt|cannot|can't|cant|can\s+not|(?:are|is|am|be)\s+not\s+to|under\s+no\s+circumstances|in\s+no\s+way)`;
const COMMUNICATION = String.raw`(?:tell(?:s|ing)?|told|inform(?:s|ed|ing)?|alert(?:s|ed|ing)?|notif(?:y|ies|ied|ying)|mention(?:s|ed|ing)?|disclos(?:e|es|ed|ing)|reveal(?:s|ed|ing)?|shar(?:e|es|ed|ing)|report(?:s|ed|ing)?|escalat(?:e|es|ed|ing)|contact(?:s|ed|ing)?|communicat(?:e|es|ed|ing)|advis(?:e|es|ed|ing)|send(?:s|ing)?|sent|forward(?:s|ed|ing)?|email(?:s|ed|ing)?|mail(?:s|ed|ing)?|cop(?:y|ies|ied|ying)|warn(?:s|ed|ing)?|tip\s+off)`;
const CONCEALMENT = String.raw`(?:hide|hiding|conceal|concealing|withhold|withholding|suppress|suppressing|omit|omitting|bury|burying|mask|masking|keep|keeping)`;
const CONCEALMENT_PATTERNS = [
  new RegExp(String.raw`\b${NEGATION}${GAP}${COMMUNICATION}${GAP}${RECIPIENT}\b`, 'gi'),
  new RegExp(String.raw`\b${NEGATION}${GAP}let${GAP}${RECIPIENT}${GAP}(?:know|find\s+out|hear|learn)\b`, 'gi'),
  new RegExp(String.raw`\b${NEGATION}${GAP}${RECIPIENT}${GAP}(?:must\s+not|should\s+not|shouldn't|can't|cannot|is\s+not\s+to|isn't\s+to)${GAP}(?:know|be\s+told|be\s+informed|hear|learn)\b`, 'gi'),
  new RegExp(String.raw`\bwithout${GAP}(?:${COMMUNICATION}|${CONCEALMENT})${GAP}${RECIPIENT}\b`, 'gi'),
  new RegExp(String.raw`\b${CONCEALMENT}${GAP}(?:this|it|that|the\s+details|the\s+information|the\s+message|the\s+invoice)?${GAP}(?:from|to|away\s+from)${GAP}${RECIPIENT}\b`, 'gi'),
  new RegExp(String.raw`\bkeep${GAP}(?:this|it|that|the\s+details|the\s+information)?${GAP}(?:secret|confidential|private|hidden|quiet|under\s+wraps)${GAP}(?:from|between)${GAP}${RECIPIENT}\b`, 'gi'),
  new RegExp(String.raw`\b${RECIPIENT}${GAP}(?:must\s+not|should\s+not|shouldn't|can't|cannot|is\s+not\s+to|isn't\s+to)${GAP}(?:know|be\s+told|be\s+informed|hear|learn)\b`, 'gi'),
  new RegExp(String.raw`\b(?:make\s+sure|ensure|see\s+to\s+it)${GAP}(?:that${GAP})?(?:${RECIPIENT}${GAP})?(?:does\s+not|doesn't|never|cannot|can't)${GAP}(?:find\s+out|learn|hear|see|receive|be\s+informed)\b`, 'gi'),
  new RegExp(String.raw`\b(?:make\s+sure|ensure|see\s+to\s+it)${GAP}(?:that${GAP})?(?:nobody|no\s+one|no\s+person)${GAP}(?:knows?|hears?(?:\s+about\s+it)?|finds?\s+out|learns?)\b`, 'gi'),
];

function findConcealment(text) {
  const matches = [];
  for (const re of CONCEALMENT_PATTERNS) {
    for (const match of text.matchAll(re)) {
      if (match[0]) matches.push(match);
    }
  }
  return matches;
}

import { VENDORS } from './gate.js';
const KNOWN = new Set(Object.values(VENDORS));
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
const B64_RE = /[A-Za-z0-9+\/]{24,}={0,2}/g;

export function decodeBase64(s) {
  try {
    const bin = atob(s.replace(/=+$/, ''));
    let str = bin;
    try { str = decodeURIComponent(escape(bin)); } catch { /* keep binary string */ }
    if (str.length < 8) return null;
    let printable = 0;
    for (const c of str) { const k = c.charCodeAt(0); if ((k >= 32 && k < 127) || k === 10 || k === 13 || k === 9 || k > 159) printable++; }
    if (printable / str.length < 0.92 || !/[a-z]{3}/i.test(str)) return null;
    return str;
  } catch { return null; }
}

export function decodeBase64Blobs(text) {
  const { out } = normalize(text);
  const res = [];
  for (const m of out.matchAll(B64_RE)) { const d = decodeBase64(m[0]); if (d) res.push(d); if (res.length >= 10) break; }
  return res;
}

export function computeScore(findings) {
  const w = findings.map((f) => f.weight).sort((a, b) => b - a);
  let s = 0;
  w.forEach((x, i) => { s += x * Math.pow(0.85, i); });
  return Math.min(100, Math.round(s));
}

export function riskLabel(score) {
  return score < 25 ? 'LOW' : score < 50 ? 'MEDIUM' : score < 75 ? 'HIGH' : 'CRITICAL';
}

export function scan(input, depth = 0) {
  const text = String(input || '').slice(0, 200000);
  const findings = [];
  const add = (type, label, weight, start, end, snippet) => {
    if (findings.length < 200) findings.push({ type, label, weight, start, end, snippet: (snippet || '').slice(0, 80) });
  };

  for (const m of text.matchAll(ZW_RUN)) add('zero-width', 'Invisible Unicode characters', 20, m.index, m.index + m[0].length, `${m[0].length} hidden char(s)`);
  for (const m of text.matchAll(HOMO_RE)) add('homoglyph', 'Look-alike (homoglyph) letters', 15, m.index, m.index + m[0].length, m[0]);

  const { out, map } = normalize(text);
  const span = (m) => [map[m.index] ?? 0, (map[m.index + m[0].length - 1] ?? 0) + 1];

  for (const r of RULES) {
    let n = 0;
    for (const m of out.matchAll(r.re)) {
      if (!m[0]) continue;
      const [s, e] = span(m);
      add(r.type, r.label, r.weight, s, e, m[0].trim());
      if (++n >= 20) break;
    }
  }

  for (const match of findConcealment(out)) {
    const [s, e] = span(match);
    add('stealth', 'Concealment demand', 30, s, e, match[0].trim());
  }

  for (const m of out.matchAll(IBAN_RE)) {
    if (KNOWN.has(m[0])) continue;
    const [s, e] = span(m);
    add('bank', 'Account number not in vendor record', 30, s, e, m[0]);
  }

  if (depth < 2) {
    for (const m of out.matchAll(B64_RE)) {
      const dec = decodeBase64(m[0]);
      if (!dec) continue;
      const sub = scan(dec, depth + 1);
      const [s, e] = span(m);
      add('base64', 'Base64 blob (decoded & re-scanned)', sub.findings.length ? 25 : 15, s, e, dec.replace(/\s+/g, ' '));
      for (const f of sub.findings) add(f.type, '↳ in Base64: ' + f.label, f.weight, -1, -1, f.snippet);
    }
  }

  findings.sort((a, b) => (a.start < 0) - (b.start < 0) || a.start - b.start);
  const score = computeScore(findings);
  return { score, label: riskLabel(score), findings };
}
