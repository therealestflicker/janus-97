**License: MIT** — see [LICENSE](./LICENSE)

# JANUS-97 — Invoice Risk Operations

JANUS-97 is a client-side invoice screening prototype. Import a CSV batch, get a prioritized review queue with explainable rule matches, inspect invoice text, and export results. No account or server is required for local screening.

AI agents (CrewAI, LangGraph, AutoGPT…) read invoices, emails and uploads, then act. A pasted document can quietly say *"change the bank account"* and trigger a payment. JANUS-97 has two faces:

| Face | Job | Guarantee |
|---|---|---|
| **1 · Scanner** | Aggressive heuristics: zero-width chars, homoglyphs, HTML comments, hidden CSS, Base64 (decoded + re-scanned), override phrases, concealment, bank-change language, embedded code. Live 0–100 risk score with highlighted spans. | May miss things. |
| **2 · Action Gate** | Deterministic rules G1–G5 on what the agent *wants to do*. Bank changes from documents are always **BLOCKED**; unknown payee/account → **HELD**; payments over 5,000 → **human approval**; scanner ≥ 70 → everything **HELD**. | Never depends on the scanner. |

Batch screening runs entirely in the browser: the invoice CSV is not uploaded. The audit log is stored in `localStorage`. An optional LLM judge is available for single-document analysis only; enabling it sends that document to the selected provider.

## Run it
```bash
npm install
npm run dev      # open the printed localhost URL
npm test         # unit checks for scanner, agent, gate, red-team, CSV
npm run build    # static site in dist/
```
Tailwind loads from its CDN (internet needed once at load; `src/style.css` keeps the page usable if it fails).

## Deploy to GitHub Pages
The live app is built from the project-root `index.html` and `src/` by GitHub Actions. The build runs Vite, which bundles `src/style.css` (imported by `src/main.js`) and the JavaScript into `dist/`; use this deployment rather than the older standalone snapshot in `docs/`.

1. Create an empty GitHub repository (for example, `janus97`) without adding a README or other starter files.
2. From this project folder, run the following in PowerShell, replacing `YOUR-USERNAME` with your GitHub username:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/janus97.git
   git push -u origin main
   ```
   If Git is already initialized, skip `git init`; if a remote named `origin` already exists, update it with `git remote set-url origin https://github.com/YOUR-USERNAME/janus97.git`.
3. On GitHub, open **Settings -> Pages**, set **Build and deployment -> Source** to **GitHub Actions**.
4. Open the repository's **Actions** tab and wait for the **Deploy to GitHub Pages** workflow to finish. The published URL appears in the workflow's deployment step and under **Settings -> Pages**; it will usually be `https://YOUR-USERNAME.github.io/janus97/`.

Every push to `main` runs the tests, builds the site, and deploys it. For local development, use `npm install` and `npm run dev`; run `npm test` and `npm run build` before pushing if you want to check the same steps locally.

## 1–3 minute demo
Click **Load hackathon demo batch** to populate the screening queue, filter to priority items, and inspect an invoice. To screen your own invoices, click **Download CSV template**, fill it, then import it. The file needs a header row; suggested columns are `invoice number`, `vendor`, `total due`, `currency`, `description`, `remittance`, and `payment terms`. All columns are included in text screening; invoice number and vendor are also shown in the results. Up to 10,000 rows and 20 MB per CSV are supported. Export review results to share the scores and matched rule names.

For the single-document action-gate demo, load *Hidden comment swap* → **Run full analysis** → observe the bank-change block. **Red-Team** compares the heuristic scanner to a keyword filter.

## Offline invoice screening
Face 1 is deterministic and runs locally without a model or API key. It checks hidden text, encoding, prompt-injection patterns, extreme payment deadlines, approval bypasses, unverified authority claims, out-of-office pressure, vague line items, remittance mismatches, and selected lookalike-vendor examples. Concealment detection composes sets of negations, communication verbs, and recipients rather than enumerating complete sentences; regression tests exercise more than 2,500 generated combinations. This increases phrase coverage but cannot guarantee detection of every paraphrase, language, or context. Batch mode also detects repeated invoice numbers for the same vendor within the imported batch. Findings are explainable, but the 0–100 score is a heuristic evidence score—not a trained model, calibrated probability, or payment decision. Batch triage uses score bands: 0–24 low signal, 25–49 review, and 50+ priority. A clean score cannot prove an invoice is safe.

Batch import accepts CSV text only. It does not inspect PDF layers, image pixels, or document metadata. Extracted document text can be provided in CSV columns. Rules can miss paraphrases, unseen brands, and other languages; the queue is intended to help prioritize human review, not replace vendor verification or approval controls.

## LLM judge (optional)
Tick **LLM judge**, paste an API key — the provider (Gemini / Claude / OpenAI) and a working model are auto-detected from the key (memory only, never stored). A real model then reads the document (invisible characters and decoded Base64 are made visible to it), returns a risk score + quoted techniques + the actions the document tries to cause. The meter shows `max(heuristics, LLM)`, LLM-found actions go through the gate, and a high-risk document with no parsed action is still held. The LLM can only make things stricter — the deterministic gate decides. Document text is sent to the provider you choose.

## Layout
`src/batch.js` CSV parsing, local batch triage, and safe result export · `src/scanner.js` Face 1 · `src/agent.js` naive agent · `src/gate.js` Face 2 · `src/naiveFirewall.js` + `src/redteam.js` contrast · `src/audit.js` log + CSV · `src/llm.js` · `src/ui.js` / `src/demo.js` · `docs/` scope, prd, spec, checklist.

## Honest limits
Heuristic POC, simulated payments only, vendor record is hard-coded in `src/gate.js`. See `docs/spec.md > What Was Simplified and Why`.
