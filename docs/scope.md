---
doc: scope
status: approved
---

# JANUS-97

The Two-Faced Firewall for Autonomous AI Agents — a browser-only tool that scans documents for prompt injection and deterministically blocks risky agent actions.

## The Unique Kernel
Two faces, two guarantees. Face 1 (Scanner) is aggressive and heuristic and may miss things. Face 2 (Action Gate) is deterministic and context-aware: money or bank-detail actions that originate from *external document content* are always held or blocked, even when the scanner scores the document as clean. Safety does not depend on detection.

## Who It's For
A developer or ops engineer wiring a CrewAI / LangGraph / AutoGPT-style agent to an accounts-payable inbox. Today they rely on a prompt filter that scans the user's message but lets a pasted invoice quietly say "change the bank account to IBAN …" and trigger a payment.

## The Core Loop
Paste or load a document → watch the live risk meter and highlighted spans → click Scan (or Run full analysis) → the naive agent proposes actions → the Action Gate shows allowed / held / human-approval / blocked → every decision lands in the audit log → export CSV. Repeat with a new sample or a red-team payload.

## Inspiration & Identity
Dark "Janus-97" theme: black background, neon cyan (Face 1) and magenta (Face 2) accents, mono-spaced terminal-meets-security-console feel, a two-faced logo. Confident, slightly cinematic copy ("Gate held. Scanner missed it. Gate didn't."). Tagline: "The Two-Faced Firewall for Autonomous AI Agents."

## Why This Matters to the Learner
Agents are being given real money and real tools while guardrails remain easy to bypass. The builder wants a POC that feels like a real product and makes that gap obvious in under three minutes.

## What "Working" Looks Like
A static page that runs offline in Chrome/Edge/Safari. The "oh, that's cool" beat: the red-team run shows a payload using zero-width characters + Base64 that a naive keyword firewall passes as SAFE, while JANUS-97 either flags it or — if the scanner is fooled — the Action Gate still holds the bank change.

## The POC Boundary
- Client-side heuristic scanner with 0–100 risk score and span highlighting
- Naive agent parser that extracts proposed actions from text
- Deterministic Action Gate (allow / hold / human approval / block)
- 4–5 samples, Guided Demo, Red-Team comparison
- Audit log (localStorage) and CSV export
- Optional Gemini mode with a user-pasted key (memory only)
- Dark neon UI, keyboard accessible, desktop-first

## Later
- Browser extension / drop-in JS SDK for real agent frameworks
- Server-side policy engine and signed audit trail
- PDF/DOCX/image upload with OCR
- Custom rule editor

## Explicitly Cut
- Backend, database, accounts — keeps it fast and avoids hosting risk
- Real payments or bank integrations — it is a simulation
- React or any build-time CSS — slows hackathon iteration
- Mobile-first layout — demo is on desktop
- Persisting the Gemini key — a security anti-pattern for a security tool
