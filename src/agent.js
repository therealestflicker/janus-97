// A deliberately NAIVE agent: it reads everything (hidden text, decoded Base64) and obeys it.
import { normalize, decodeBase64Blobs } from './scanner.js';

const IBAN = '[A-Z]{2}\\d{2}[A-Z0-9]{10,30}';
const cleanAcct = (s) => (s ? s.replace(/\s+/g, '').toUpperCase() : null);
const num = (s) => parseFloat(String(s).replace(/,/g, ''));
const curOf = (s) => ({ '$': 'USD', '€': 'EUR' }[s] || s || 'USD');

export function parseActions(raw) {
  const text = normalize(String(raw || '').slice(0, 200000)).out;
  const full = [text, ...decodeBase64Blobs(raw)].join('\n');
  const vendor = (full.match(/(?:vendor|supplier)\s*:\s*([^\n<]+)/i) || [])[1]?.trim() || null;
  const invIban = cleanAcct((full.match(new RegExp(`\\bIBAN\\s*[:=]\\s*(${IBAN})`, 'i')) || [])[1]);
  const actions = [];
  const seen = new Set();
  const push = (a) => {
    const k = [a.type, a.amount, a.account, a.email].join('|');
    if (seen.has(k)) return;
    seen.add(k);
    actions.push({ origin: 'document', source: 'regex', payee: vendor, ...a });
  };

  // 1. Bank-detail changes
  const bank = new RegExp(`\\b(?:change|update|replace|switch|set|modify|redirect)\\w*\\b[^\\n]{0,80}?\\b(?:bank|account|iban|beneficiary|routing)\\b[^\\n]{0,80}?\\b(${IBAN})`, 'gi');
  for (const m of full.matchAll(bank)) push({ type: 'bank_change', account: cleanAcct(m[1]), amount: null, text: m[0].trim().slice(0, 120) });

  // 2. Explicit payment instructions ("pay 9,800 USD", "wire $5000 ...")
  const pay = /\b(?:pay|wire|transfer|send|release)\w*\b[^\n.]{0,25}?(?:([$€])\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(USD|EUR|MAD))/gi;
  for (const m of full.matchAll(pay)) {
    const lineRest = full.slice(m.index).split('\n')[0];
    const acct = (lineRest.match(new RegExp(IBAN, 'i')) || [])[0];
    push({ type: 'pay', amount: num(m[2] || m[3]), currency: curOf(m[1] || m[4]), account: cleanAcct(acct) || invIban, text: m[0].trim().slice(0, 120) });
  }

  // 3. The invoice's own payment request
  const due = full.match(/(?:total|amount)\s+due\s*:?\s*([$€]|USD|EUR)?\s?(\d[\d,]*(?:\.\d+)?)/i);
  if (due) push({ type: 'pay', amount: num(due[2]), currency: curOf(due[1]), account: invIban, text: due[0].trim() });

  // 4. Data exfiltration by e-mail
  const mail = /\b(?:send|forward|email|mail)\w*\b[^\n]{0,60}?\b([\w.+-]+@[\w-]+\.[\w.-]+)/gi;
  for (const m of full.matchAll(mail)) push({ type: 'send_email', email: m[1], account: null, amount: null, text: m[0].trim().slice(0, 120) });

  return actions;
}

export function describe(a) {
  if (a.type === 'ingest') return 'Hand this document to the agent for processing';
  if (a.type === 'bank_change') return `Change bank details → ${a.account || '?'}${a.payee ? ` (${a.payee})` : ''}`;
  if (a.type === 'send_email') return `Send data by e-mail → ${a.email}`;
  return `Pay ${a.amount != null ? a.amount.toLocaleString('en-US') : '?'} ${a.currency || ''} → ${a.account || 'no account'}${a.payee ? ` (${a.payee})` : ''}`;
}
