# Roshni: Platform Reference

*Verified against the code on 11 November 2026 (engine 0.1.0, regulatory data version 2026-11-11b). Companion to [HOW_WE_BUILT_IT.md](HOW_WE_BUILT_IT.md), which tells the build story and holds the full business-rule catalogue (section 5.7).*

Roshni is an independent second opinion on a solar or battery quote for Pakistani households. It sells nothing and earns no commission. Gemini reads documents and explains; a deterministic Python engine produces every number.

---

## 1. What exists

**16 page routes** (14 feature pages plus the home page and the report page), **40 API endpoints**, **27 audit rules**, **35 cities**, **37 brand profiles**, **59 backend tests**.

| Route | Purpose | Backend endpoints used |
|---|---|---|
| `/` | Home: entry cards for every journey | `/meta` |
| `/size` | **Size my solar** (result saved automatically; `?id=` opens a saved one; share link, PDF, save to account, delete): appliances + bill + budget + roof to 2 or 3 system options with cost ranges, savings, payback and backup hours, then brand facts, dated public price listings and checks for each part (no scores), and an estimate builder using the brands the user picks | `/size`, `/size/estimate` |
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
| `/brands` | Neutral, alphabetical guide to 37 brands, with dated public price listings and a re-verify warning | `/brands`, `/brands/{id}` |
| `/account` | Sign in (email code or link), saved reports and sizings, delete all | `/me/reports`, `/me/sizings` |
| `/about` | Independence policy, privacy, public rule list (`#rules`, `#privacy`) | none |
| `/admin` | Datasheet review queue, north-star metric, and what users decide after each finding (needs `ADMIN_TOKEN`) | `/admin/datasheets`, `/admin/datasheets/{id}/verify`, `/admin/stats`, `/admin/insights` |

Also on every page: the **Roshni Madadgar assistant** (English, Urdu, Roman Urdu; voice in and read-aloud; photo or PDF attachments; knows the user's open report) using `/chat` and `/chat/upload`. It can **run the calculators itself** through Gemini function calling (`backend/app/assistant_tools.py`): battery sizes for an existing system or a stored report, loan vs savings, solar readiness, comparing reports, and sizing a system. Gemini only passes inputs; the engine returns the numbers.

### Complete API list

`GET /api/health`, `GET /api/meta`, `POST /api/extract/quote`, `POST /api/validate/quote`, `POST /api/extract/bill`, `GET /api/bill/companies`, `POST /api/bill/lookup`, `POST /api/specs/lookup`, `POST /api/profile/parse`, `POST /api/audit`, `GET|DELETE /api/report/{id}`, `GET /api/report/{id}/access`, `POST /api/report/{id}/claim`, `POST /api/report/{id}/urdu`, `POST /api/report/{id}/outcome`, `GET|DELETE /api/me/reports`, `GET|PUT /api/me/profile`, `POST /api/size` (saves the result), `GET|DELETE /api/sizing/{id}`, `POST /api/sizing/{id}/claim`, `GET /api/me/sizings`, `POST /api/size/estimate`, `POST /api/extract/readings`, `GET /api/admin/insights`, `POST /api/battery`, `POST /api/readiness`, `POST /api/chat`, `POST /api/chat/upload`, `GET /api/admin/datasheets`, `POST /api/admin/datasheets/{id}/verify`, `GET /api/admin/stats`, `POST /api/compare`, `POST /api/health-check`, `POST /api/financing`, `GET /api/brands`, `GET /api/brands/{id}`.

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
        Engine: weather ► PV ► load ► dispatch ► bills ► 27 rules ► cash flow
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
| 27 audit rules | `backend/app/engine/rules.py` |
| Tariff, regimes, bills, 25-year cash flow | `backend/app/engine/finance.py` |
| PV simulation (pvlib) | `backend/app/engine/pv.py` |
| Household load profile, bill scaling | `backend/app/engine/load.py` |
| Hourly battery and grid dispatch | `backend/app/engine/dispatch.py` |
| Quote arithmetic checks | `backend/app/engine/validate.py` |
| Readiness check | `backend/app/engine/readiness.py` |
| Size my solar (options, costs, brand lists, brand estimate) | `backend/app/engine/sizing.py` |
| Quote vs sizing cross-check (R27) | `engine/audit.py` `sizing_context`, `engine/rules.py` |
| Per-brand price listings with source, date and confidence | `backend/app/data/brand_prices.json` |
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
| Household profile and bill | Audit R27 | The audit runs Roshni's own sizing for the same household and compares the quote's size and price with it |
| Size | Account | Saved sizings are listed under My reports and sizings |
| Report | Outcome survey | Feeds the `/admin` north-star metric |
| Readiness | Audit | "Next: get quotes, then check them" |
| Health check | Battery advisor | Link at the bottom |
| Learn | Audit | Link from the backup simulator |
| Brand guide | Assistant | The same data, including price listings, is in the assistant's knowledge base |
| Brand guide | Size my solar | `/brands` links to `/size`; `/size` links brand names back to `/brands#id` |

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
5. Per-brand prices cover about 30 brands from public listings and guides; Deye, Felicity inverter and several others had no usable listing. Prices must be refreshed regularly (see section 8).

**Brand options, prices and ratings (decided).** `/size` lists brands per part alphabetically with origin, what the product is, Pakistan notes, official verification links, the category checks and, where one exists, the public price listing with its date, confidence and source link. Every price carries a "re-verify before you pay" warning. It does not score or rank, and it does not use Reddit or forum ratings: they are anonymous, easy to game and cannot be verified. A brand-estimate builder prices a chosen system from the picked brands' listings and market ranges for everything else, and compares the total with the user's budget.

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
| Backend tests | 59 / 59 pass |
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

- **Per-brand prices (added later the same day):** `brand_prices.json` holds, per brand, the product, a price (Rs per watt for panels; Rs per listed unit with its kW or kWh for inverters and batteries), the listing date when known, a confidence label (dated listing, undated listing, price guide, price tracker, retailer brand page) and the source URL. Where sources disagree the entry says so (for example Risen and Inverex). `/size/estimate` uses a picked brand's listing for panels (per watt), hybrid inverters (the listed model's price, scaled up only when the system needs a larger inverter) and lithium batteries (per kWh), and market ranges for everything else, including installation and any brand with no listing. Total is compared with the budget: within, maybe (low end fits) or over.
- **What is covered:** panels for 10 brands; hybrid inverters for 12 brands (Huawei and Ziewnic are display-only because no model size was stated); lithium batteries for 6 brands. No usable public listing was found for Deye, Felicity, Crown inverters, Sunwoda, Hithium, Sacred Sun, Leoch, Soluna, and the lead-acid brands, and the page says so rather than guessing.
- **Refreshing:** prices are dealer listings from 11 November 2026 and age quickly; refresh `brand_prices.json` and its `as_of` at least monthly, and prefer dated retailer pages over guides.

## 9. Gap review (11 November 2026, after the sizing and price work)

**What the platform has:** 16 page routes, 36 API endpoints, 26 audit rules, 35 cities, 37 brand profiles (about 30 with price listings), 56 backend tests; the quote audit, parts check, bill decoder and bill lookup, size my solar, battery advisor, readiness, compare, health check (typed or screenshot), loan check, learn, guides, brands, account, admin, and the assistant that runs the calculators.

**How it links:** bill to audit, battery and size; report to battery, financing, compare, assistant, account, brand guide and rule list; size to audit and financing; readiness to size and audit; health to battery; brands to size; the household profile is shared by audit, battery and size.

**Gaps, in order of importance**

| # | Gap | Why it matters | Suggested fix |
|---|---|---|---|
| 1 | **No limit on AI endpoints.** Only bill lookup is rate limited; chat, quote, bill and screenshot reading and profile parsing can be called without limit | Cost abuse of the Gemini key once the site is public | Per-IP and per-account limits, daily spend alert |
| 2 | **Not deployed.** Runs locally only; Supabase redirect URLs and the magic-link email are unverified; no error monitoring | Nobody outside the team can use it | Deploy API and web app, set Supabase URLs, add Sentry |
| 3 | ~~A quote is not checked against the sizing.~~ **Closed:** rule R27 compares the quote's size and price with Roshni's own sizing | | |
| 4 | **Prices go stale.** `brand_prices.json` is a manual snapshot with gaps (Deye, Felicity, Sunwoda, Hithium, lead-acid and others); nothing warns when a listing is old | Wrong prices undermine trust | Monthly refresh routine; show a "listing older than 30 days" flag; an admin screen to update prices |
| 5 | ~~Sizing results cannot be saved or shared.~~ **Closed:** results are saved automatically with share link, PDF, account history and delete | | |
| 6 | **Sizing simplifications.** Single-phase only, lithium only, hybrid inverter prices only, fixed 2 to 12 kW steps, ignores shade and orientation | Edge cases give weaker advice | Add phase, lead-acid, on-grid inverter prices, orientation and shade inputs |
| 7 | **Urdu is partial.** `/size`, `/battery`, `/health`, `/financing`, `/readiness` and most form labels are English only | Many target users read Urdu | Translate labels and results; reuse the translation cache pattern |
| 8 | **Real-data validation is missing.** No bill lookup with a real reference number, no inverter-log comparison, no engineer review of findings | Accuracy claims are unproven | The PRD's concierge pilot with 30 to 50 real quotes and a PEC-registered engineer |
| 9 | **Readiness and the health check do not hand data on.** They do not fill the household profile or the audit | Users re-enter facts | Save readiness answers (roof, shade, budget) into the profile |
| 10 | **No front-end automated tests.** Only backend tests and manual browser checks | Regressions in pages go unnoticed | A small Playwright suite for the main journeys |
| 11 | **Load-shedding is one fixed pattern for every city**, and only the first AC type counts toward backup load | Backup estimates can be off | City or feeder specific schedules; count every AC type |
| 12 | **Datasheet catalogue grows only through manual admin review** and there is no reminder | Slow to fill | A review queue badge or email |

**Not built on purpose:** WhatsApp, phone sign-in, government scheme guide, installer directory, brand scores, forum ratings, load-shifting coach and the other PRD P2 and P3 items (reasons in HOW_WE_BUILT_IT.md section 13).

**Are we using the tools fully?** Mostly. Gemini now reads documents, finds datasheets, translates, chats and calls the calculators. Not yet used: Gemini reading a signed installer contract or warranty card, Gemini explaining a bill month by month against a report, and pvlib per-roof shading. Supabase is used for Postgres, row-level security, sign-in and saved profiles; email notifications and storage are unused.

## 10. Admin access

There are no admin usernames. Admin is one shared secret, `ADMIN_TOKEN` in `backend/.env` (not in the repository), sent in the `x-admin-token` header. Page: `/admin`. Endpoints: `GET /api/admin/datasheets`, `POST /api/admin/datasheets/{id}/verify`, `GET /api/admin/stats`, `GET /api/admin/insights`. Full detail and examples are in [RUN_GUIDE.md](RUN_GUIDE.md) section 6.

## 11. Language

English mode is fully English (no Urdu text appears unless the user switches language; the switch itself reads "Urdu"). Urdu mode is partial: reports, lessons, bill explanations, verdicts and the assistant are bilingual, while many form labels and the newest pages stay English.

## 12. Design system and homepage (UI redesign, 11 November 2026)

**Direction:** light only (the old dark-mode media query was removed), warm daylight white with deep navy ink, a glowing sun as the brand mark and hero, electric blue and teal as supporting accents. Headings use Manrope, body text Inter, Urdu uses Noto Nastaliq. Reference: the shared design chat (light theme, scroll-driven story, section-specific interactions, shine-sweep buttons) plus our own ideas.

**Tokens (in `frontend/src/app/globals.css`):** `--bg #fffaf0`, `--ink #0f1b2d`, `--sun #ffb020`, `--sun-deep #f58a07`, `--blue #2f6bff`, `--teal #10b5a3`, `--leaf #0f8a63`, `--red #d92d20`. Shared classes: `.btn` (primary with amber gradient and shine sweep, ghost, dark), `.card` and `.card-lift`, `.reveal` (scroll reveal), range sliders with a sun thumb. All animations respect `prefers-reduced-motion`.

**Layout:** the homepage is full width. Every other page lives in the `(app)` route group, which adds the container and a soft sun-glow backdrop (URLs are unchanged). A floating pill header (turns solid on scroll, hamburger below 1280 px) and a four-column footer wrap everything.

**Homepage sections, each with its own interaction** (files in `frontend/src/components/home/`):

| # | Section | Interaction |
|---|---|---|
| 1 | Hero | Glowing sun with breathing rays and orbit, a tilted 3D solar panel and floating product chips that follow the pointer (parallax), animated wave into the next section |
| 2 | Marquee | Endless strip of what Roshni checks |
| 3 | Why Roshni exists | Bars that grow and numbers that count up when scrolled into view; the "quote promise vs real estimate" example |
| 4 | How it works | Sticky scroll story: one quote changes through Upload, Extract, Audit, Decide as you scroll (stacked cards on phones) |
| 5 | Net billing simulator | Slider and battery toggle drive an animated energy-flow diagram (illustration with example numbers, labelled as such) |
| 6 | Audit console | Click any finding to expand its evidence and the question to ask the installer |
| 7 | Everything in one place | Eight feature cards, each with a different hover (scanning line, growing bars, highlighting bill lines, filling battery, drawing chart and so on) plus four compact links |
| 8 | Size my solar preview | Three sized options and real dated price listings with the re-verify warning |
| 9 | Trust | Five principles in a bento grid |
| 10 | Team | Omer Bin Dawood, Hira Baig and Alwaz Islam, COMSATS University Islamabad, with tilt-on-hover cards |
| 11 | FAQ | Animated accordion |
| 12 | Final call to action | The sun rises as the section scrolls into view |

**Content rules for marketing copy:** every figure is real (27 rules, 35 cities, 37 brands, price listings from `brand_prices.json`, tariff facts from the sources) or clearly labelled "Example" or "Illustration". English mode contains no Urdu text.

**Visual QA note:** layout was checked in a real desktop browser, a 375 px phone viewport (no horizontal scroll, header fits) and Urdu right-to-left. A custom CSS layer fix was needed so utility classes such as `hidden` can override `.btn`.

**Second design pass (same day):** the hero was rebuilt in an editorial style inspired by gfx-t.com, in a light theme: huge heavy uppercase headline, mono-type tags, blocky buttons with an arrow square, an interactive particle field (points joined by hairlines, pulled by the pointer and, while scrolling, toward the sun, with amber energy streaks), a glowing sun with hairline rings, and a sample "audit receipt" card. The audit wizard has a new stepper, "what happens here" side panel, drag-and-drop upload, a processing screen and a sticky action bar on phones. The report has a large verdict banner, a sticky section menu, a severity timeline of expandable findings, and load-shedding tiles. Layout was checked for horizontal overflow at 320, 390, 768, 1024, 1280 and 1366 px; the hero call to action stays above the fold on 1280x720 and 1366x768 laptops. Fixed: the brand page crashed on open when the API returned no price list (older backend); pages now tolerate it.
