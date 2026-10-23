---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. You can open a dark JANUS-97 dashboard and paste text**
  Becomes usable: Running Vite app with Tailwind CDN, logo, tagline, input area, footer.
  Why now: Proves the scaffold end to end.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`
  Build: Clean template files, replace index.html and style.css, add MIT LICENSE and README header.
  Verify (mechanical): `npm run dev` starts cleanly; page renders styled.
  Learner check: Open the page and say whether the look matches the vision.
  Commit: `Scaffold dark dashboard`

- [x] **2. Pasted text gets a live risk score with highlighted spans**
  Becomes usable: Face 1 scanner with meter and highlights.
  Why now: Delivers the first half of the kernel.
  PRD ref: `prd.md > Features and Behavior` (Face 1)
  Spec ref: `spec.md > Components` (scanner.js)
  Build: scanner.js rules incl. zero-width, comments, hidden styling, override phrases, Base64 decode; meter and highlight rendering.
  Verify (mechanical): Console scan of a zero-width and Base64 string returns findings and score > 50.
  Learner check: Paste a trick string and watch the meter react.
  Commit: `Add scanner and live risk meter`

- [x] **3. Samples load with one click**
  Becomes usable: 5 sample documents as chips.
  Why now: Makes every later slice demoable.
  PRD ref: `prd.md > Features and Behavior` (Samples)
  Spec ref: `spec.md > Components` (samples.js)
  Build: samples.js and chip UI.
  Verify (mechanical): Each sample loads and produces the expected score band.
  Learner check: Click each sample and confirm they feel distinct.
  Commit: `Add sample documents`

- [x] **4. Run full analysis shows what a naive agent would do**
  Becomes usable: Agent parser listing proposed actions.
  Why now: Gate needs actions to judge.
  PRD ref: `prd.md > Features and Behavior` (Naive Agent Parser)
  Spec ref: `spec.md > Components` (agent.js)
  Build: agent.js extraction and action cards.
  Verify (mechanical): Hidden-comment sample yields a bank-change action tagged origin document.
  Learner check: Run analysis on the bank-swap sample and read the actions.
  Commit: `Add naive agent parser`

- [x] **5. The Action Gate holds or blocks dangerous actions**
  Becomes usable: Deterministic gate with verdicts and rule IDs, plus approve/reject.
  Why now: The kernel — safety independent of the scanner.
  PRD ref: `prd.md > Features and Behavior` (Face 2)
  Spec ref: `spec.md > Components` (gate.js)
  Build: gate.js rules G1–G5, verdict UI, approval buttons.
  Verify (mechanical): With forced score 0, bank change still BLOCKED; 12,000 payment needs approval.
  Learner check: Try to sneak a bank change past it.
  Commit: `Add deterministic action gate`

- [x] **6. Every action is logged and exportable**
  Becomes usable: Audit log with localStorage and CSV export.
  Why now: Completes the loop and persistence.
  PRD ref: `prd.md > Features and Behavior` (Audit Log), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Data Model`
  Build: audit.js, log table, export, clear with confirm, CSV formula-safe escaping.
  Verify (mechanical): Reload keeps log; exported CSV opens with correct columns.
  Learner check: Run two samples, reload, export.
  Commit: `Add audit log and CSV export`

- [x] **7. Red-Team shows a bypass fooling a normal firewall but not JANUS-97**
  Becomes usable: Side-by-side comparison panel.
  Why now: The "oh, cool" demo beat.
  PRD ref: `prd.md > Features and Behavior` (Red-Team)
  Spec ref: `spec.md > Components` (naiveFirewall.js)
  Build: naiveFirewall.js, 3–4 bypass payloads, comparison UI.
  Verify (mechanical): Each payload passes naive filter and is flagged or gated by JANUS-97.
  Learner check: Run all payloads and read the contrast.
  Commit: `Add red-team comparison`

- [x] **8. Guided Demo walks through a banking workflow**
  Becomes usable: Narrated overlay, 1–3 minutes.
  Why now: Needed for the submission video.
  PRD ref: `prd.md > Core Journey` (step 8)
  Spec ref: `spec.md > Components` (demo.js)
  Build: step sequencer with captions, skip and pause, keyboard control.
  Verify (mechanical): Demo runs start to finish without errors in under 3 minutes.
  Learner check: Watch the full demo once.
  Commit: `Add guided demo`

- [x] **9. Optional Gemini mode gives a second opinion**
  Becomes usable: Key field, toggle, cloud assessment merged into UI; gate still local.
  Why now: Optional feature, built after the core is safe.
  PRD ref: `prd.md > Features and Behavior` (Optional Gemini Mode)
  Spec ref: `spec.md > External Services and Dependencies`
  Build: gemini.js with timeout and strict JSON parse, failure banner and fallback.
  Verify (mechanical): With a bad key, banner shows and local mode continues.
  Learner check: Paste a key (if available) and run a sample.
  Commit: `Add optional Gemini mode`

- [ ] **10. Polish, accessibility, README, and ship**
  Becomes usable: Keyboard focus, aria labels, final styling, README with license on top, public repo, demo video.
  Why now: Submission requirements.
  PRD ref: `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: tab order, focus rings, README (MIT first), push to public GitHub, record video under 3 minutes.
  Verify (mechanical): `npm run build` succeeds; Tab reaches every control.
  Learner check: Do a full run-through as a stranger would.
  Commit: `Polish and prepare submission`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 5 (scanner + gate working)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — brief recap
- [ ] Optional edit and transfer reflection addressed
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: 
Route and stops: 
Edit outcome: 
Reflection: 
Activity mode: 

## Revisions

