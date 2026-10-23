// The "typical" keyword firewall — used only for the Red-Team contrast.
const BLOCKLIST = ['ignore previous instructions', 'ignore all previous', 'disregard previous', 'ignore the above', 'system prompt', 'jailbreak', 'developer mode'];
export function naiveCheck(text) {
  const t = String(text || '').toLowerCase();
  const hit = BLOCKLIST.find((k) => t.includes(k));
  return hit ? { verdict: 'BLOCKED', hit } : { verdict: 'PASS', hit: null };
}
