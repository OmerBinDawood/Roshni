# Roshni: Presentation Pack

A ready outline for presenting Roshni: the story, the live demo, how it was built, every library and resource used, and answers to likely questions. About 20 minutes plus questions.

## 1. The problem (2 minutes)
- Pakistani households spend Rs 6.5 to 11.5 lakh on a 5 kW solar system (more with batteries), usually from one to three installer quotes they cannot judge.
- Rules changed in 2026: net billing replaced net metering for new users (exports earn about Rs 10 to 11 a unit, not the full tariff), and fixed charges are per kW of sanctioned load. Many quotes still promise "zero bill".
- Free tools do calculators and price lists. None reviews a specific quote against the buyer's own bill, backup needs and the 2026 rules.

## 2. The idea (1 minute)
**Roshni (روشنی) gives an independent second opinion on a solar or battery quote before people pay.** It sells nothing and earns no commission. Three users: households with quotes, the roughly 7 million homes with solar deciding on a battery, and self-assemblers buying parts.

## 3. What it does (3 minutes)
| Journey | One line |
|---|---|
| Check a quote | Reads the quote, confirms every line with the user, runs 27 rules and a year-long hourly simulation, returns verdict, questions for the installer, savings, backup |
| Size my solar | From appliances, bill, budget and roof to on-grid and hybrid options with costs, then brands, dated prices and an estimate builder |
| Bill decoder | Every bill line explained in English and Urdu; fetch the bill by reference number |
| Battery advisor, Readiness, Health check, Compare, Loan | The neighbouring decisions |
| Brand guide | 37 brands: who makes them, how to verify, what to check, public prices with dates |
| Assistant | English, Urdu and Roman Urdu; voice; runs the calculators |

**By the numbers:** 16 pages, 40 API endpoints, 27 audit rules, 35 cities with hourly weather, 37 brand profiles (about 30 with price listings), 59 automated tests, 10 lessons and a 21-term glossary.

## 4. Live demo (6 minutes)
Follow the "10-minute guided demo" in [USER_GUIDE.md](USER_GUIDE.md); cut steps 1 and 6 for time.

## 5. The five rules that shape the product (2 minutes)
1. **The AI never produces a number you see.** Gemini reads and explains; a deterministic Python engine calculates.
2. **Missing data means "cannot verify", never "pass".**
3. **Regulatory regime first:** net metering or net billing is decided before any savings figure.
4. **Rules over scores:** every finding is a specific, testable statement with evidence. No brand rankings, no forum ratings.
5. **Independence:** no commission or referral; the policy is public.

## 6. Architecture (2 minutes)
```
Browser ─► Next.js web app (port 3000) ─ /api rewrite ─► FastAPI service (port 8000)
                                                          ├─ solar engine (pvlib + PVGIS weather)
                                                          ├─ Gemini (documents, chat, translation)
                                                          ├─ Supabase Postgres (reports, sizings, datasheets, profiles)
                                                          └─ PITC bill portal (bill by reference number)
Browser ─► Supabase Auth (email sign-in only; the API verifies the token)
```
The browser never talks to Gemini or the database. The API is the only place with secrets.

## 7. How the code works (3 minutes)
| Step | What happens | Code |
|---|---|---|
| Read | Gemini turns a quote or bill photo into a strict JSON schema; the user confirms | `backend/app/gemini.py` |
| Check arithmetic | quantity x price = line total (0.5%); lines = grand total (0.2%) | `engine/validate.py` |
| Simulate | PVGIS weather, pvlib solar model with 15% losses, hourly load from appliances scaled to the bill, battery and grid dispatch with load-shedding | `engine/pv.py`, `load.py`, `dispatch.py` |
| Price | Official 2026 slab tariff, fixed charge per kW, taxes calibrated from the user's own bill, both regimes, 25-year cash flow | `engine/finance.py` |
| Judge | 27 rules, each CRITICAL, CLARIFY, INFO or OK with evidence and a question | `engine/rules.py` |
| Size | Candidate systems, grow while each step pays back within 6 years | `engine/sizing.py` |
| Explain | Report, Urdu translation, assistant with tools | `gemini.py`, `assistant_tools.py`, `frontend/src/app/report` |

How it was built (see [HOW_WE_BUILT_IT.md](HOW_WE_BUILT_IT.md)): one day, from the product document; reuse instead of build (pvlib, PVGIS, Gemini, browser speech and print); tested at six layers from tariff arithmetic to live runs with real AI and database; 20+ bugs found and fixed along the way.

## 8. Libraries and resources used

**Backend (Python 3.13)**
| Library | Version | Used for |
|---|---|---|
| FastAPI | 0.162.4 | The API, request validation (with Pydantic 2) |
| Uvicorn | 0.54.0 | Runs the API |
| pvlib | 0.16.1 | Solar position, irradiance, cell temperature, PV and inverter models; downloads PVGIS weather |
| NumPy and pandas | installed with pvlib | 8,760-hour arrays |
| google-genai | 3.1.0 | Gemini: JSON-schema reading, Google Search grounding, chat, function calling |
| SQLAlchemy | 2.1.8 | One database code path for Postgres and SQLite |
| psycopg | 3.3.8 | Postgres driver |
| PyJWT and cryptography | 2.15.1 and 50.0.2 | Verify Supabase sign-in tokens against public keys |
| RapidFuzz | 3.14.6 | Fuzzy match model names to the datasheet catalogue and brands |
| httpx | 0.28.1 | Official bill-portal client |
| python-dotenv, python-multipart | 1.2.4, 0.0.33 | Settings and file uploads |
| Pillow | 13.0.0 | Builds the synthetic test documents |
| pytest | 9.2.0 | 59 automated tests |

**Frontend**
| Library | Version | Used for |
|---|---|---|
| Next.js | 16.4.6 | Web app (app router), API rewrite |
| React | 19.3.0 | UI |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4.3.3 | Styling, mobile first, right-to-left Urdu |
| @supabase/ssr and supabase-js | 0.12.7, 2.119 | Email sign-in in the browser |
| ESLint | 9 | Lint, including React hooks rules |
| Fonts | Inter, Noto Nastaliq Urdu | Via next/font |

**Browser features reused:** Web Speech API (voice in, read-aloud), print to PDF.

**Services and data**
| Resource | Use |
|---|---|
| Google Gemini (`gemini-3.5-flash`) | Reads quotes and bills, finds datasheets, assistant, Urdu translation |
| PVGIS (EU JRC) | Typical meteorological year, hourly, for 35 cities |
| Supabase | Postgres database with row-level security, email sign-in |
| PITC bill portal (`bill.pitc.com.pk`) | Official duplicate bill by reference number |
| NEPRA S.R.O. 279(I)/2026 | Domestic slab tariff and fixed charges |
| Dawn, Profit, ProPakistani, Daily Times | Net billing, buyback, tax context |
| W11stop, Powerhouse Express, Zell, PhoneWorld, SolarApp, MaxPower, ToolsFluent, Bolnews | Public price listings and guides (URLs in `brand_prices.json`) |
| Manufacturer pages (LONGi, JA Solar, Trina, Deye, Knox, Daewoo and others) | Brand facts and official verification links |
| GitHub | Code hosting |

## 9. Safety, privacy and independence (1 minute)
- Consent before any document goes to the AI; uploaded images are not stored; bill reference numbers are not stored or logged.
- Documents are treated as untrusted data: planted instructions in a quote image, pasted text and chat were all ignored in tests.
- Database tables are locked from Supabase's public API (row-level security); only the backend reads or writes.
- Reports and sizings are viewable by link; only the creator can delete.
- No CAPTCHA is ever bypassed; bill lookups are rate limited.

## 10. Honest limits and what is next (2 minutes)
- **Not yet proven on real data:** a real bill reference lookup, real inverter logs, a licensed engineer's review of findings. Plan: concierge pilot with 30 to 50 real quotes.
- **Before public launch:** rate limits on AI endpoints, deployment, error monitoring.
- **Prices are public listings** that age within weeks; refresh monthly; some brands have none.
- **Urdu is partial** (reports, lessons, bill explanations, assistant are bilingual; many form labels are English).
- **Later:** load-shifting coach, roof estimator, monitoring APIs, engineer review queue.

## 11. Likely questions
| Question | Answer |
|---|---|
| How do you make money? | You do not. Independence is the product. Sustainable options that keep it: grants, a paid engineer-review tier, or a public-interest sponsor, never installer or brand commissions. |
| Can the AI be wrong? | It only reads documents, and the user confirms every line before any calculation. Numbers come from the engine. |
| How accurate is the solar estimate? | Built on PVGIS typical-year data and pvlib with about 15% losses; Lahore comes out near 1,630 kWh per kWp a year. Real inverter logs from 10 to 20 homes are the planned validation. |
| Why not rank brands? | Rankings need verified, comparable evidence; public forum ratings are anonymous and easy to fake. We give facts, official checks and dated prices instead. |
| What if tariffs change? | Rates live in `regulatory.json` with sources and dates; changing them and the tests is a one-day job. |
| Is a quote check a design certificate? | No. It is decision support. Safety questions go to a PEC-registered engineer. |
| Why is the size smaller than the installer's? | Under net billing, extra panels export cheaply; Roshni stops where each extra step no longer pays back within 6 years, and flags bigger quotes (rule R27). |
| What about K-Electric customers? | They upload a bill photo; the reference-number lookup covers the PITC companies. |

## 12. One-slide summary
**Roshni:** independent solar second opinion for Pakistani households. 27 rules, hourly simulation, 2026 net-billing aware, English and Urdu, no commissions. Built in a day from existing tools (Gemini, pvlib, PVGIS, Supabase, Next.js). Next: real-data pilot, public launch.
