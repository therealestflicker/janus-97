// FACE 2 — deterministic Action Gate. No ML, no scanner trust: rules only.
export const THRESHOLD = 5000;
export const VENDORS = {
  'acme supplies ltd': 'GB29NWBK60161331926819',
  'northwind logistics': 'FR1420041010050500013M02606',
};
export const RANK = { ALLOWED: 0, HUMAN: 1, HELD: 2, BLOCKED: 3 };
const acct = (s) => (s ? String(s).replace(/\s+/g, '').toUpperCase() : null);

export function evaluate(action, { score = 0, threshold = THRESHOLD } = {}) {
  const fired = [];
  const hit = (verdict, ruleId, reason) => fired.push({ verdict, ruleId, reason });
  const fromDoc = action.origin === 'document';

  if (action.type === 'bank_change' && fromDoc)
    hit('BLOCKED', 'G1', 'Bank-detail change requested by external document content is never executed.');

  if (action.type === 'pay' && fromDoc) {
    const rec = VENDORS[String(action.payee || '').trim().toLowerCase()];
    if (!rec) hit('HELD', 'G2', 'Payee is not in the verified vendor record.');
    else if (acct(action.account) !== rec) hit('HELD', 'G2', 'Destination account differs from the verified vendor record.');
  }
  if (action.type === 'pay' && action.amount > threshold)
    hit('HUMAN', 'G3', `Amount exceeds ${threshold.toLocaleString('en-US')} — a human must approve.`);
  if (action.type === 'send_email' && fromDoc)
    hit('HELD', 'G5', 'Document-originated instruction to send data externally.');
  if (score >= 70)
    hit('HELD', 'G4', `Scanner risk ${score} ≥ 70 — all actions from this document are held.`);

  if (!fired.length) {
    return { verdict: 'ALLOWED', ruleId: 'G0', reason: action.type === 'pay' ? 'Payment matches verified vendor record and is under the threshold.' : 'No rule fired.', fired };
  }
  const top = fired.reduce((a, b) => (RANK[b.verdict] > RANK[a.verdict] ? b : a));
  return { verdict: top.verdict, ruleId: fired.map((f) => f.ruleId).join('+'), reason: top.reason, fired };
}

export function worst(verdicts) {
  return verdicts.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ALLOWED');
}
