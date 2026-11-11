# Roshni: Platform Reference

*Verified against the code on 11 November 2026 (engine 0.1.0, regulatory data version 2026-11-11b). Companion to [HOW_WE_BUILT_IT.md](HOW_WE_BUILT_IT.md), which tells the build story and holds the full business-rule catalogue (section 5.7).*

Roshni is an independent second opinion on a solar or battery quote for Pakistani households. It sells nothing and earns no commission. Gemini reads documents and explains; a deterministic Python engine produces every number.

---

## 1. What exists

**16 page routes** (14 feature pages plus the home page and the report page), **35 API endpoints**, **26 audit rules**, **35 cities**, **37 brand profiles**, **52 backend tests**.

| Route | Purpose | Backend endpoints used |
|---|---|---|
| `/` | Home: entry cards for every journey | `/meta` |
| `/size` | **Size my solar**: appliances + bill + budget + roof to 2 or 3 system options with cost ranges, savings, payback and backup hours, then brand facts and checks for each part (no scores) | `/size` |
| `/audit` | 4-step wizard: quote, bill, home, confirm. `?mode=parts` skips the bill and savings | `/extract/quote`, `/extract/bill`, `/bill/lookup`, `/profile/parse`, `/specs/lookup`, `/validate/quote`, `/audit` |
| `/report/[id]` | The audit report: verdict, findings, savings, backup, brands, installer kit, share, PDF, Urdu | `/report/{id}`, `/report/{id}/access`, `/report/{id}/urdu`, `/report/{id}/claim`, `/report/{id}/outcome` |
| `/bill` | Bill Decoder: every bill line explained in English and Urdu; lookup by reference number | `/extract/bill`, `/bill/lookup`, `/bill/companies` |
| `/battery` | Battery advisor: 0, 5, 10, 15 kWh compared. `?report=id` pre-fills system, home and bill from a report | `/battery`, `/report/{id}` |
| `/readiness` | "Ready, check first, or not now" for people with no quote yet | `/readiness` |
| `/compare` | 2 to 4 saved reports side by side | `/compare` |
| `/health` | Is my existing system producing enough? Type monthly readings or upload an inverter-app screenshot | `/health-check`, `/extract/readings` |
| `/financing` | Loan instalment against monthly saving | `/financing` |
| `/learn` | 10 lessons, 21-term glossary, system-type quiz, backup simulator (read aloud, English and Urdu) | none (static) |
| `/guides` | Net-billing paperwork, genuine panels, safety | none (static) |
| `/brands` | Neutral, alphabetical guide to 37 brands | `/brands`, `/brands/{id}` |
| `/account` | Sign in (email code or link), saved reports, delete all | `/me/reports` |
| `/about` | Independence policy, privacy, public rule list (`#rules`, `#privacy`) | none |
| `/admin` | Datasheet review queue, north-star metric, and what users decide after each finding (needs `ADMIN_TOKEN`) | `/admin/datasheets`, `/admin/datasheets/{id}/verify`, `/admin/stats`, `/admin/insights` |

Also on every page: the **Roshni Madadgar assistant** (English, Urdu, Roman Urdu; voice in and read-aloud; photo or PDF attachments; knows the user's open report) using `/chat` and `/chat/upload`. It can **run the calculators itself** through Gemini function calling (`backend/app/assistant_tools.py`): battery sizes for an existing system or a stored report, loan vs savings, solar readiness, comparing reports, and sizing a system. Gemini only passes inputs; the engine returns the numbers.

### Complete API list

`GET /api/health`, `GET /api/meta`, `POST /api/extract/quote`, `POST /api/validate/quote`, `POST /api/extract/bill`, `GET /api/bill/companies`, `POST /api/bill/lookup`, `POST /api/specs/lookup`, `POST /api/profile/parse`, `POST /api/audit`, `GET|DELETE /api/report/{id}`, `GET /api/report/{id}/access`, `POST /api/report/{id}/claim`, `POST /api/report/{id}/urdu`, `POST /api/report/{id}/outcome`, `GET|DELETE /api/me/reports`, `GET|PUT /api/me/profile`, `POST /api/size`, `POST /api/extract/readings`, `GET /api/admin/insights`, `POST /api/battery`, `POST /api/readiness`, `POST /api/chat`, `POST /api/chat/upload`, `GET /api/admin/datasheets`, `POST /api/admin/datasheets/{id}/verify`, `GET /api/admin/stats`, `POST /api/compare`, `POST /api/health-check`, `POST /api/financing`, `GET /api/brands`, `GET /api/brands/{id}`.

---

## 2. How a quote audit flows

```
Quote (photo / PDF / pasted text, English, Urdu, Roman Urdu)
   └─ Gemini extracts line items (JSON schema) ──► user confirms every line
                                                    │
Bill (photo / PDF / 14-digit reference) ──► Gemini reads ──► Bill object ─┐
Home profile (form, or "describe your home" in free text via Gemini) ─────┤
Datasheets: catalogue (fuzzy match) ► else Gemini + Google Search ► "unverified"
                                                    │
                          Validator (arithmetic, missing models)
                                                    │
        Engine: weather ► PV ► load ► dispatch ► bills ► 26 rules ► cash flow
                                                    │
                     Report saved (Supabase) ► share link, PDF, Urdu, compare, loan
```

Before any document reaches Gemini the user must tick the consent box; the API refuses uploads without it.

---

## 3. Where each piece of logic lives

| Concern | File |
|---|---|
| Routes, limits, consent, ownership | `backend/app/main.py` |
| Every Gemini call and prompt | `backend/app/gemini.py` |
| Orchestration, backup list, battery options, reconciliation | `backend/app/engine/audit.py` |
| 26 audit rules | `backend/app/engine/rules.py` |
| Tariff, regimes, bills, 25-year cash flow | `backend/app/engine/finance.py` |
| PV simulation (pvlib) | `backend/app/engine/pv.py` |
| Household load profile, bill scaling | `backend/app/engine/load.py` |
| Hourly battery and grid dispatch | `backend/app/engine/dispatch.py` |
| Quote arithmetic checks | `backend/app/engine/validate.py` |
| Readiness check | `backend/app/engine/readiness.py` |
| Size my solar (options, costs, brand lists) | `backend/app/engine/sizing.py` |
| Compare, health check, financing | `backend/app/engine/extras.py` |
| Brand matching and notes | `backend/app/engine/brands.py` |
| Official bill portal client | `backend/app/billfetch.py` |
| Tables, migration, row-level security, ownership | `backend/app/db.py` |
| Token verification | `backend/app/auth.py` |
| Assistant calculator tools | `backend/app/assistant_tools.py` |
| Persisted bill and household profile (front end) | `frontend/src/lib/shared.ts` |
| Versioned data | `backend/app/data/` (`regulatory.json`, `cities.json`, `appliances.json`, `brands.json`, `knowledge.md`) |

---

## 4. Business rules: quick reference

The full catalogue with thresholds and reasons is section 5.7 of [HOW_WE_BUILT_IT.md](HOW_WE_BUILT_IT.md). The headline rules:

1. The LLM never produces a number shown to the user.
2. A missing datasheet value gives "cannot verify", never "pass".
3. The regulatory regime is decided before any savings figure.
4. Findings are specific rules with evidence; there are no brand scores or rankings.
5. No commission, referral or installer revenue.
6. The verdict is red if any critical finding exists, amber if any "clarify", otherwise green.
7. Uploads need consent; the first audit needs no account.

---

## 5. Feature linkage: what connects to what

**Connected today**

| From | To | How |
|---|---|---|
| Audit bill step | Bill lookup | Reference-number lookup is embedded in the wizard |
| Audit confirm step | Datasheet catalogue and `/admin` | Looked-up specs are saved "unverified"; admin verifies; next quote reuses them |
| Report | Brand guide | "About the brands in this quote" links to `/brands#id` and official check pages |
| Report | Assistant | "Ask about this report" gives the assistant the findings and numbers |
| Report | Compare | `/audit?compare=` starts a second quote; `/compare` lists device and account reports |
| Report | Financing | `/financing?report=id` pre-fills price and savings |
| Report | Account | Save to account, history, delete all |
| Report | Rule list | Each finding links to `/about#rules` |
| Report | Outcome survey | Feeds the `/admin` north-star metric |
| Readiness | Audit | "Next: get quotes, then check them" |
| Health check | Battery advisor | Link at the bottom |
| Learn | Audit | Link from the backup simulator |
| Brand guide | Assistant | The same data is in the assistant's knowledge base |

**Gaps found in the first review, now closed**

| Gap | What changed |
|---|---|
| Bill Decoder was a dead end | The decoded bill is kept for the browser tab. `/audit` offers "Use my decoded bill"; `/battery` uses it; `/bill` has next-step buttons |
| Battery advisor was standalone | The report has "Should I add a battery?"; `/battery?report=id` fills the system, household and bill |
| No saved household profile | The profile is saved on the device automatically and, when signed in, to the account (`user_profiles` table, row-level security on). Audit and battery start from it |
| Assistant could not run the engine | Gemini function calling over five engine tools (see section 1) |
| Health check needed typed readings | Upload an inverter-app screenshot; Gemini reads monthly kWh (never converts daily to monthly); the user checks the numbers before running |
| Outcome survey was never used | `/admin` now shows, per triggered rule, how many users renegotiated, walked away, proceeded, and so on, plus willingness to pay |

**Still open**

1. Readiness and the health check do not yet hand data to the audit.
2. The datasheet catalogue still grows only through manual admin review.
3. Load-shedding hours use one fixed slot order for every city.
4. Urdu is partial: reports, lessons, bill explanations, verdicts and the assistant are bilingual; most form labels are English only.
5. Per-brand prices are not tracked (see the note below).

**Brand options and ratings (decided).** `/size` lists brands per part alphabetically with origin, what the product is, Pakistan notes, official verification links and the category checks, and can filter by international or Pakistan-market and by having an official check or compatibility list. It does not score or rank, and it does not use Reddit or forum ratings: they are anonymous, easy to game and cannot be verified. Per-brand prices are not tracked because dealer prices change weekly; the page shows component price ranges and tells the user to compare written quotes.

---

## 6. Are we using the most out of the tools?

| Tool | Used for | Not yet used |
|---|---|---|
| **Gemini** | Reading quotes and bills, datasheet lookup (Google Search grounding), chat, Urdu translation, profile from free text | Function calling so the assistant can run the engine; reading inverter-app screenshots for the health check; reading a signed installer contract or warranty card; explaining a bill month-by-month against a report |
| **pvlib and PVGIS** | Yearly generation per city, string-voltage extremes | Per-roof shading from a photo; month-by-month "expected vs actual" alerts for signed-in users |
| **Supabase** | Postgres, row-level security, email sign-in | Storing the household profile per user; email notifications when NEPRA data changes; storage for a user's own quote files (deliberately not stored today) |
| **Browser APIs** | Voice input, read aloud, print to PDF | Offline use (PWA) for low-signal areas |

**Highest-value next steps, in order**

1. Run the concierge pilot with real quotes and a PEC-registered engineer, then use the admin insights to tune rules and wording.
2. Hand readiness and health-check data to the audit; translate the remaining form labels into Urdu.

---

## 7. Verification status (11 November 2026)

| Check | Result |
|---|---|
| Backend tests | 52 / 52 pass |
| TypeScript and ESLint | Clean |
| All 15 routes respond | Yes (HTTP 200) |
| Live end-to-end with real Gemini and Supabase, signed in with a test account | 19 / 19 pass: audit, history, ownership, claim, Urdu, compare, assistant with report context, battery, readiness, health, financing, brands, quote extraction, consent refusal, admin protection, delete all |
| Gap-closing work (same day) | Saved profile, screenshot reading with real Gemini (read 3 months correctly), assistant calling the battery tool, outcome insights, and the report-to-battery and decoded-bill-to-audit flows checked in the browser. 14 / 14 live API checks pass |
| Bug found and fixed | A freshly issued sign-in token was rejected for a few seconds because of clock skew; the token check now allows 60 seconds of leeway (regression test added) |

Still unverified: a bill lookup with a real reference number, a real sign-in email delivered to an inbox, generation against real inverter logs, and agreement with a licensed engineer's review.


## 8. Size my solar: how it decides

- **Inputs:** the household profile (appliances, hours, load-shedding), the bill (or typed monthly units), optional budget, roof area and goal (bill, backup or both).
- **Load:** the same hourly load model as the audit, scaled to the bill history; reports average units, share used in daytime, bill without solar and all-in price per unit.
- **Candidates:** panel sizes 2, 3, 4, 5, 6, 8, 10, 12 kW (capped by roof area) in up to three plans: on-grid; hybrid with 5 kWh; hybrid with 10 kWh. Inverter is the panel size divided by 1.2, rounded to 0.5 kW, minimum 3 kW. Each is simulated for a full year under the user's regime.
- **Choosing a size (a rule, not a score):** start at the smallest size and keep growing while each extra step pays for itself within 6 years (`MARGINAL_PAYBACK_YEARS`), within budget; on-grid sizes that would export more than 40% of output are excluded under net billing. If nothing fits the budget the page says so and marks options over budget.
- **Cost:** component ranges from `regulatory.json` `sizing_costs` (panels Rs 40-45/W, inverter per kW, battery Rs 45,000-65,000 per usable kWh, structure and installation Rs 40-65/W). Inverter and installation rates are assumptions reconciled to the dated 5 kW system total; approval and meter fees are extra.
- **Payback:** simple payback = cost midpoint / yearly saving (the report adds inverter and battery replacement).
- **Brands:** alphabetical lists for panels, inverters and (when a battery is in an option) lithium batteries, with the category checks. No ranking, no scores.
