const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createDemo(api) {
  const steps = [
    { dwell: 5000, caption: 'Meet JANUS-97: Face 1 scans documents, Face 2 gates what an AI agent may actually do. Let’s run a real accounts-payable workflow.', run: async () => api.reset() },
    { dwell: 6000, caption: 'A normal invoice. Risk stays low, and the payment matches the verified vendor record → ALLOWED.', run: async () => { api.load('clean'); await sleep(500); await api.analyze(); } },
    { dwell: 7500, caption: 'Now an attacker hides an HTML comment telling the agent to swap bank details. Face 1 lights up CRITICAL — and Face 2 BLOCKS the bank change outright.', run: async () => { api.load('comment'); await sleep(500); await api.analyze(); } },
    { dwell: 7500, caption: 'Zero-width characters split the attack phrase so keyword filters miss it. JANUS-97 sees through them (magenta “ZW” markers), and the payment to an unknown account is HELD.', run: async () => { api.load('zerowidth'); await sleep(500); await api.analyze(); } },
    { dwell: 8000, caption: 'Instructions smuggled in Base64. Now we BLIND the scanner (score forced to 0) to simulate a total miss — the deterministic Action Gate still blocks the bank change.', run: async () => { api.load('base64'); await sleep(500); await api.analyze({ blind: true }); } },
    { dwell: 6500, caption: 'A clean-looking $18,500 payment exceeds the threshold, so a human must approve it. Click Approve or Reject — the decision is logged.', run: async () => { api.load('highvalue'); await sleep(500); await api.analyze(); } },
    { dwell: 8000, caption: 'Red-Team: four classic bypasses all PASS a typical keyword firewall. JANUS-97 flags them — and even with the scanner blinded, the gate blocks every bank change.', run: async () => api.redteam() },
    { dwell: 6000, caption: 'Every decision is timestamped in the audit log with its risk score and rule. Export the whole thing as CSV. That’s JANUS-97: detect aggressively, gate deterministically.', run: async () => api.focusLog() },
  ];
  let i = -1, timer = null, paused = false, active = false, token = 0;

  const show = (n) => { $('demoStep').textContent = `${n + 1}/${steps.length}`; $('demoCaption').textContent = steps[n].caption; };

  async function go(n) {
    clearTimeout(timer);
    if (n >= steps.length) return stop();
    const my = ++token; i = n; show(n);
    try { await steps[n].run(); } catch (e) { console.error(e); }
    if (my !== token || !active) return;
    if (!paused) timer = setTimeout(() => go(n + 1), steps[n].dwell);
  }
  function start() { active = true; paused = false; $('demoPause').textContent = '⏸ Pause'; $('demoBar').hidden = false; go(0); }
  function stop() { active = false; token++; clearTimeout(timer); $('demoBar').hidden = true; }
  function togglePause() {
    paused = !paused; $('demoPause').textContent = paused ? '▶ Resume' : '⏸ Pause';
    clearTimeout(timer);
    if (!paused && active) timer = setTimeout(() => go(i + 1), 1200);
  }

  $('btnDemo').onclick = start;
  $('demoNext').onclick = () => go(i + 1);
  $('demoPause').onclick = togglePause;
  $('demoExit').onclick = stop;
  document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') stop();
    else if (e.key === 'ArrowRight') go(i + 1);
  });
}
