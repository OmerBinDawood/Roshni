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
| "Should I add a battery?" advisor | `/battery` |
| On-grid vs hybrid explainer, backup simulator, learning cards | `/learn` |
| **Roshni Madadgar** assistant — Urdu/Roman Urdu/English, voice input and read-aloud | every page |

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
                                                                                 └─ roshni.db          (SQLite: saved reports for share links)
```

Supabase (auth, RLS, storage) from the PRD is not wired in yet; SQLite keeps the MVP to two processes.

## Run locally

Requirements: Python 3.11+, Node 20+, a Gemini API key.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                              # then put your GEMINI_API_KEY in .env
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                                       # http://localhost:3000
```

Set `BACKEND_URL` for the frontend if the API is not on `http://127.0.0.1:8000`.

Tests: `cd backend && .venv/Scripts/python -m pytest -q`

## Important caveats

- Tariff, buyback, fixed-charge and price figures in `backend/app/data/regulatory.json` come from the PRD's secondary sources
  and are marked *verify*. Confirm against official NEPRA / DISCO / FBR notifications before relying on them.
- Specs found by web search are labelled **unverified** in the UI and report; users should check them against the datasheet.
  Missing datasheet values give "cannot verify", never "pass".
- PV losses (soiling 7%, ~15% total) are a first guess for Pakistani conditions; validate against real inverter logs (PRD §15.3).
- Roshni provides decision support, not a design certificate.
