---
doc: spec
status: approved
---

# JANUS-97 — Technical Spec

## How This Works, In Plain Language
A web page with five small parts. The **Scanner** reads text and finds tricks. The **Agent Parser** pretends to be a gullible AI agent and lists what it would do. The **Action Gate** is a rulebook that checks each of those actions and says allow, hold, ask a human, or block — it never trusts the scanner. The **Audit Log** records everything. The **UI** shows it all. No server: everything runs in your browser, which is why it's instant and easy to demo. Gemini is an optional extra opinion, never the decider.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
User types or picks a sample → `ui` calls `scanner.scan(text)` → returns `{score, label, findings[]}` → meter and highlights render → on Run full analysis, `agent.parse(text)` returns `actions[]` tagged `origin: "document"` → `gate.evaluate(action, scan, vendorRecord)` returns `{verdict, ruleId, reason}` → `ui` renders verdicts → `audit.add()` writes to localStorage → Export CSV builds a Blob download.

## Stack
- Vite (already in package.json, ^8.x) + vanilla JavaScript ES modules — docs: https://vite.dev
- Tailwind CSS via CDN script tag in `index.html` — https://tailwindcss.com/docs/installation/play-cdn (dev-grade, chosen for zero build; tradeoff: not for production)
- No other runtime dependencies.
- Unverified: Tailwind CDN version behavior with Vite 8 dev server — check in slice 1.

## Where It Runs and How Someone Tries It
Browser only (Chrome/Edge/Safari). Node 18+ for dev.
`npm install` then `npm run dev`, open the printed localhost URL. Record the demo video from this page. `npm run build` outputs static `dist/`, deployable to GitHub Pages or Netlify (optional; not a substitute for repo + video). Gemini key optional, pasted in the UI.

## Look and Feel
Black (#05060A) base, cyan #00F0FF and magenta #FF2BD6 accents, status colors green/amber/red. Mono for content, sans for chrome. Dense but breathable, cinematic security-console tone, short punchy copy. Tailwind CDN handles utilities; custom glow/animation CSS lives in `src/style.css`.

## Components

### batch.js
Parses bounded CSV input (quoted commas/newlines, UTF-8 BOM), normalizes headers, rejects malformed row widths, and screens each row with `scanner.scan()`. It also flags invoice-number duplicates within a vendor's current batch (not across prior imports). Results use explainable rule labels and score bands for review triage; they are not probability estimates. Batch processing yields to the event loop periodically and exports formula-safe CSV.

### scanner.js
Deterministic, offline rule table for hidden content, injection phrases, suspicious payment pressure, approval bypasses, authority claims, vague billing, remittance mismatches, and known lookalike-vendor examples. Concealment detection composes negation, communication-action, and recipient vocabularies with bounded phrase gaps; tests exercise over 2,500 generated combinations. It improves variation coverage but is not semantic understanding and cannot guarantee every paraphrase or language. Base64 detector decodes candidates and recursively scans (depth 2). Returns findings with `start/end` offsets. Score = min(100, Σ weights, with diminishing returns); it is a heuristic evidence score, not a trained or calibrated probability. The scanner receives extracted text only and does not inspect PDF/image layers or metadata itself.
PRD ref: `prd.md > Features and Behavior` (Face 1).

### agent.js
Regex extraction of actions: `{type, amount, currency, account, payee, origin, source}`. Deliberately naive.
PRD ref: `prd.md > Features and Behavior` (Naive Agent Parser).

### gate.js
Pure function, ordered rules G1–G5 from the PRD; no dependence on scanner score except G4. Fully unit-checkable in console.
PRD ref: `prd.md > Features and Behavior` (Face 2).

### naiveFirewall.js
Simple keyword blocklist used only for Red-Team contrast.

### audit.js
Append, load, clear, `toCSV()` (with quote escaping and formula-injection prefixing for cells starting `= + - @`).

### gemini.js
`fetch` to Gemini `generateContent` REST endpoint with user key, JSON-only prompt, strict parse, timeout.

### ui.js / demo.js / samples.js
Rendering, event wiring, keyboard handling, guided demo sequencer, sample data.
PRD ref: `prd.md > Screens and Layout`.

## Data Model
- `audit` (localStorage `janus97.audit`): array of `{ts, event, score, verdict, ruleId, detail}`; survives reload; capped at 1000 entries.
- `input` (localStorage `janus97.input`): last text.
- `vendors` (in code): vendor → known account, used by gate G2.
- Gemini key: JS variable only; gone on reload.

## File Structure
```
janus97/
├── index.html        # Tailwind CDN, layout
├── src/
│   ├── main.js       # bootstrap
│   ├── ui.js
│   ├── scanner.js
│   ├── agent.js
│   ├── gate.js
│   ├── naiveFirewall.js
│   ├── audit.js
│   ├── gemini.js
│   ├── demo.js
│   ├── samples.js
│   └── style.css
├── docs/             # scope.md, prd.md, spec.md, checklist.md
├── devpost/          # Devpost learning workspace
├── agent/skills/     # Learn Skill Pack
├── LICENSE           # MIT
└── README.md         # license noted at top
```

## External Services and Dependencies
- Tailwind Play CDN: `https://cdn.tailwindcss.com`; no key; needs internet at load (fallback: system fonts and minimal CSS in style.css).
- Gemini (optional): `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<KEY>`, body `{contents:[{parts:[{text}]}]}`; model name unverified — check docs at https://ai.google.dev/gemini-api/docs early; free-tier rate limits apply.

## Important Failure Modes
- **Tailwind CDN fails offline** → page remains usable via fallback CSS in style.css.
- **Gemini error/rate limit/bad JSON** → banner and automatic local-only result.
- **localStorage full or disabled** → in-memory log with a warning; CSV export still works.

## What Was Simplified and Why
- **Regex agent parser** instead of an LLM agent — deterministic, demoable offline. A real agent would call tools through a framework.
- **Heuristic scanner** instead of an ML classifier — fast and explainable. Production would add model-based detection.
- **Simulated payments** instead of bank APIs — safety and scope.

## Decisions and Open Issues
- Gate independent of scanner (chosen by learner) — tradeoff: more false holds.
- Gemini advisory-only (implementation detail derived from the determinism requirement).
- Learner uncertainty: whether "Gemini runs scanner + gate in the cloud" conflicts with a deterministic gate; resolved by making Gemini a second opinion while the local gate stays final.
- Open: approval threshold value; Gemini model name; Tailwind CDN behavior under Vite 8.
