# Roshni · روشنی

**The independent solar second opinion for Pakistan — "Before you pay, let Roshni check it."**

Upload an installer's quote (photo, screenshot, PDF or pasted WhatsApp text) and your electricity bill. Roshni reads them,
simulates your home hour by hour for a full year, runs an engineering rule catalogue on the quote, and models savings under
the rules that actually apply to you (legacy net metering vs. 2026 net billing, fixed charges, the 200-unit protected limit).
You get a plain-language report in English or Urdu with critical issues, real savings ranges, backup hours and a
copy-paste list of questions for your installer.

## What's in this MVP (PRD v2.1 P0 scope)

| Feature | Where |
| --- | --- |
| Quote intake from photos / PDFs / pasted text, with a confirm-and-edit step | `/audit` |
| Bill intake + **Bill Decoder** (every line explained, distance to 200 units) | `/audit`, `/bill` |
| Lean household profile (also fill it by describing your home in Urdu/Roman Urdu/English) | `/audit`, `/battery` |
| Hourly (8,760 h) PV + load + battery dispatch simulation using **pvlib** and **PVGIS** weather | `backend/app/engine` |
| Quote audit rule catalogue R01–R25 (string voltage, MPPT limits, battery compatibility, backup, protection, warranty, savings claim vs regime, price…) | `backend/app/engine/rules.py` |
| Financial model: regime selection, fixed charges, buyback, scenarios, "rules change again" stress test, 25-yr cash flow | `backend/app/engine/finance.py` |
| Report with share link, Save-as-PDF (print), Urdu translation | `/report/[id]` |
| Quote validator (qty × price, line totals vs grand total, missing model numbers) | confirm step, report |
| Parts-list safety check for self-assemblers (Journey 3, no savings maths) | `/audit?mode=parts` |
| Datasheet catalogue: fuzzy model matching, web lookups saved as *unverified*, admin review queue | `/admin` |
| Bill-vs-answers reconciliation prompts; "what runs in load-shedding" per appliance | report |
| Installer conversation kit (personal questions, checklist, red flags), outcome survey (north-star), report deletion | report |
| Bill lookup by 14-digit reference number from the official PITC portal (all PITC DISCOs; K-Electric by photo). Never bypasses a CAPTCHA | `/bill`, audit bill step |
| Optional sign-in (Supabase email code / magic link) to keep report history; anonymous creators keep a private ownership token | `/account` |
| Compare 2-4 checked quotes on a normalised basis (Rs/W, Rs per usable battery kWh, savings, issues) | `/compare` |
| Existing-system health check: actual vs expected monthly generation, likely causes, inverter settings checklist | `/health` |
| Loan instalment vs savings (financing check) | `/financing` |
| Guides: net-billing paperwork, genuine panels, safety basics | `/guides` |
| Brand guide: 38 panel, inverter and battery brands (who makes them, technology, official verification links, what to check); neutral, no rankings; brand notes on every report; known to the assistant | `/brands` |
| "Should I add a battery?" advisor | `/battery` |
| Solar readiness check ("not now" is a valid answer) | `/readiness` |
| On-grid vs hybrid explainer, "which type fits me" quiz, backup simulator, 10 lessons with audio, glossary | `/learn` |
| Independence policy, evidence standards, public rule list, privacy | `/about` |
| **Roshni Madadgar** assistant — Urdu/Roman Urdu/English, voice input, read-aloud, photo/PDF attachments | every page |

No WhatsApp integration (by design, PRD §20). Users paste copied chat text instead.

### Reused, not rebuilt

- **Gemini** (`google-genai`) — quote and bill reading via JSON-schema output, datasheet lookup with Google Search grounding,
  the assistant, profile-from-text and Urdu translation. Gemini never produces a number shown in a report.
- **pvlib** — solar position, transposition, cell temperature, PVWatts DC and inverter models.
- **PVGIS** (EU JRC) — typical-meteorological-year hourly weather for each city (fetched via pvlib, cached).
- **Browser Web Speech API** — Urdu/English voice input and read-aloud.
- **Browser print** — PDF export from the same report page.

## Architecture

```
frontend/  Next.js 16 + Tailwind (mobile-first, RTL Urdu)  --/api/* rewrite-->  backend/  FastAPI
                                                                                 ├─ app/gemini.py      (all LLM calls)
                                                                                 ├─ app/engine/        (deterministic, versioned)
                                                                                 │   weather · pv · load · dispatch · finance · rules · audit
                                                                                 ├─ app/data/          (versioned regulatory, appliance, city data, knowledge base)
                                                                                 └─ app/db.py          (Supabase Postgres via DATABASE_URL, else local SQLite)
```

Tables: `reports`, `datasheets` (catalogue + review queue), `decision_outcomes`. On Postgres, Row-Level Security is
enabled with no policies, so Supabase's public REST API cannot read them; only the backend (postgres role) can.
Sign-in uses Supabase Auth (email one-time code or magic link). The backend verifies the session JWT against the
project's public signing keys (`SUPABASE_JWKS_URL`). In the Supabase dashboard, add your site URL
(e.g. `http://localhost:3000`) under Authentication → URL Configuration, and include `{{ .Token }}` in the
Magic Link email template if you want users to type a 6-digit code.

### Tariff data
`backend/app/data/regulatory.json` holds the official domestic slab tariff from NEPRA S.R.O. 279(I)/2026
(12 Feb 2026): lifeline, protected and unprotected rates, and fixed charges per kW of sanctioned load. Unprotected
bills are priced single-slab (every unit at the slab rate); protected bills get the one-previous-slab benefit.
Taxes and adjustments (GST, ED, FPA/QTA) are calibrated from the user's own bill. Buyback and market prices
carry dated sources.

## Run locally

Requirements: Python 3.11+, Node 20+, a Gemini API key.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                              # then fill GEMINI_API_KEY, DATABASE_URL, ADMIN_TOKEN
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                                       # http://localhost:3000
```

Set `BACKEND_URL` for the frontend if the API is not on `http://127.0.0.1:8000`.

Tests: `cd backend && .venv/Scripts/python -m pytest -q` (41 tests; always on a throwaway SQLite database). They cover the
official slab tariff maths, every audit rule path, engine edge cases (long outages, expired agreements, odd bills, cold cities,
orientation), API input limits, auth/ownership, the bill-portal client (mocked) and the extra journeys.

For Supabase, use the **session pooler** connection string (IPv4), e.g.
`postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
The direct `db.<ref>.supabase.co` host is IPv6-only and fails on many networks.

## Important caveats

- Domestic tariffs and fixed charges are verified against NEPRA S.R.O. 279(I)/2026. The net-billing buyback (~Rs 10-11,
  NAEPP) and the April 2026 amendment for existing contracts come from news sources; re-check them when NEPRA
  publishes changes. Market prices are dated dealer listings (Nov 2026).
- Specs found by web search are labelled **unverified** in the UI and report; users should check them against the datasheet.
  Missing datasheet values give "cannot verify", never "pass".
- PV losses (soiling 7%, ~15% total) are a first guess for Pakistani conditions; validate against real inverter logs (PRD §15.3).
- Roshni provides decision support, not a design certificate.
