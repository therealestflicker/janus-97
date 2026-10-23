---
doc: prd
status: approved
---

# JANUS-97 — Product Requirements

A client-side firewall dashboard for engineers who give AI agents money-moving tools; it scans documents and gates actions.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
1. Open `index.html` in a browser; see the dark dashboard, logo, tagline.
2. Click a sample invoice (or paste any text) into the input area.
3. As text changes, the live risk meter updates (0–100) and dangerous spans are highlighted.
4. Click **Scan** to commit the result to the log; click **Run full analysis** to let the naive agent extract proposed actions.
5. The Action Gate evaluates each proposed action and shows ALLOWED, HELD, NEEDS HUMAN APPROVAL, or BLOCKED with the rule that fired.
6. For approval-needed actions, the user clicks Approve or Reject; the decision is logged.
7. Click **Red-Team** to see a bypass payload pass a naive filter but not JANUS-97.
8. Click **Run Guided Demo** for a narrated end-to-end banking workflow (1–3 minutes).
9. Open the audit log and **Export CSV**.
Success: a stranger can see the problem and the fix in under three minutes.

## Screens and Layout
Single-page dashboard, no routing. Header (logo, tagline, Gemini toggle). Left column: input area, sample chips, Scan / Run full analysis buttons. Centre: live risk meter and highlighted-span view. Right: Face 1 findings and Face 2 Action Gate results. Below: Red-Team panel and Audit Log with Export CSV. Guided Demo is an overlay with step cards. Footer: "Made with Devpost Learn Skill Pack".

## Look and Feel
Black background; neon cyan (#00F0FF) for scanner, neon magenta (#FF2BD6) for gate; green/amber/red for allow/hold/block. Monospace for document and log, clean sans for UI. Glow on active elements, subtle scanline accent. Avoid light mode, stock-template look, and clutter. Visible focus rings.

## Features and Behavior

### Batch Invoice Screening
- Import CSV files up to 20 MB / 10,000 invoices; parse quoted fields and multiline cells without a backend.
- Scan all text columns with the local deterministic scanner. Show invoice/vendor, heuristic points, matched signal labels, and queue status.
- Flag repeated invoice numbers for the same vendor within the current batch.
- Triage bands: 0–24 low signal, 25–49 review recommended, 50–100 priority review. These are not fraud probabilities or payment decisions.
- Search/filter results, inspect the source text in the existing single-document scanner, load a demo batch, download a CSV template, and export screening results.
- Screen in the browser only; do not persist imported invoice contents. Audit only batch counts and completion.

### Face 1 — Scanner
Detects: zero-width / invisible Unicode, HTML comments, hidden styling (display:none, white-on-white, font-size:0), Base64 blobs (decoded and re-scanned), override phrases ("ignore previous instructions", "system:", role-play), bank-detail change language, urgency/authority pressure, script/code snippets. Each finding has a type, weight, and span. Score = capped weighted sum, 0–100, with labels Low / Medium / High / Critical.
- As a developer, I want a live score so that I see risk while pasting.
  - [ ] Score updates within 150 ms of typing
  - [ ] Each hit is highlighted and listed with its type
  - [ ] Decoded Base64 content is scanned and flagged

### Naive Agent Parser
Regex-based extraction of proposed actions (pay X to account Y, update bank details, send email, approve invoice) from the *entire* text, deliberately obeying hidden or embedded instructions. It represents a vulnerable agent. Each action carries its **origin** (user-typed vs. external document).

### Face 2 — Action Gate
Pure deterministic rules, independent of the scanner score:
- Bank-detail change from external document → always BLOCKED
- Payment whose beneficiary/account differs from vendor record, from external document → HELD
- Payment above threshold (default 5,000) → NEEDS HUMAN APPROVAL
- Any action when scanner score ≥ 70 → HELD
- Otherwise ALLOWED
- As an operator, I want bank changes never to pass so that a missed injection can't move money.
  - [ ] With scanner artificially set to 0, a bank-change action is still blocked
  - [ ] Each verdict displays the rule ID that fired
  - [ ] Approve/Reject on human-approval items is logged

### Samples, Guided Demo, Red-Team
4–5 samples: clean invoice, hidden-comment bank swap, zero-width override, Base64 payload, high-value payment. Guided Demo auto-loads samples in sequence with captions. Red-Team shows side-by-side: "Typical keyword firewall" (simple string match) vs. JANUS-97.

### Audit Log and Export
Every scan, action verdict, approval, and demo step is logged with ISO timestamp, event, risk score, verdict, rule. CSV export of the full log; Clear log button with confirmation.

### Optional Gemini Mode
Toggle and paste an API key; Gemini returns a second-opinion risk assessment and extracted actions as JSON. The local Action Gate always makes the final decision.

## States and Boundaries
- **First use** — empty input, sample chips prominent, meter at 0.
- **Empty log** — "No events yet" message; Export disabled.
- **Persistence** — audit log and last input persist in localStorage; the Gemini key never persists.
- **Gemini error** — banner explains, falls back to local mode.
- **Boundaries** — nothing leaves the browser except Gemini calls the user explicitly enables.

## Product Decisions
- 100% client-side, no backend — speed, trivial deployment, no data custody.
- Vite + vanilla JS, Tailwind via CDN — fastest iteration, per requirements.
- Gate independent of scanner — the core claim of the project.
- Gemini advisory-only — a cloud model must not be able to weaken the deterministic guarantee.

## What We're Building
Everything under Features and Behavior, plus keyboard operability, responsive desktop layout, README with MIT license at the top, and the docs.

## Deferred From the POC
Uploads/OCR, rule editor, SDK/extension, multi-user approvals — each needs infrastructure or time beyond the hackathon.

## Possible Later Enhancements
Signed audit entries; policy-as-code import; per-vendor bank whitelist management UI.

## Non-Goals
- Not a production security product — it is a heuristic POC.
- No real payment execution — simulation only.
- No LLM-based gating — would break determinism.

## Open Questions
- Exact approval threshold default (5,000 proposed) — can wait until build.
- Gemini model name and endpoint — verify early in the build.
