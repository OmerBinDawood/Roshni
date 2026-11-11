# Roshni: User Guide (how to guide people through it)

Use this to train staff, write help text, or walk a household through the platform. Every journey below says who it is for, what to do, what the person gets, and what to tell them.

**The one-sentence pitch:** "Roshni is an independent second opinion on a solar quote. It sells nothing and earns no commission. It checks the quote against your own bill, your backup needs and the 2026 net-billing rules, and tells you what to ask before you pay."

## Which door should this person use?

| The person says | Send them to |
|---|---|
| "I have a quote from an installer" | **Check a quote** (`/audit`) |
| "I am buying panels and an inverter myself" | **Parts check** (`/audit?mode=parts`) |
| "I don't have a quote yet, what do I need?" | **Size my solar** (`/size`) |
| "Is solar even right for me?" | **Readiness** (`/readiness`) |
| "I don't understand my electricity bill" | **Bill decoder** (`/bill`) |
| "I already have solar and want a battery" | **Battery advisor** (`/battery`) |
| "My solar doesn't seem to produce enough" | **System health check** (`/health`) |
| "I have 2 or 3 quotes" | Check each one, then **Compare** (`/compare`) |
| "The bank will give me a loan" | **Loan vs savings** (`/financing`) |
| "Is this brand genuine? What does it cost?" | **Brand guide** (`/brands`) |
| "I don't know the words" | **Learn** (`/learn`) and the glossary |
| Anything else, in Urdu or English | The **Roshni Madadgar** assistant (bottom-right button) |

## Before you start (say this to everyone)

1. No account is needed for the first check. Signing in (email code) only keeps reports and the home profile across devices.
2. When they upload a photo or PDF, they tick a consent box: the document is read by an AI service (Google Gemini). Roshni asks the AI not to copy names, addresses or reference numbers, and does not store the images.
3. Roshni's numbers come from a calculation engine, not from the AI. The AI only reads documents and explains.
4. Prices and rules carry dates. Re-verify with the seller before paying.
5. The language switch is in the top bar (English or Urdu). Reports, lessons, bill explanations and the assistant work in both.

## Journey 1: Check a quote (`/audit`)

**For:** a household holding one to three installer quotes. **Time:** about 5 minutes.

1. **Quote.** Upload a photo or PDF, or paste the text of a chat message or email (English, Urdu or Roman Urdu is fine). Tick consent. Press Next.
2. **Bill.** Upload the latest electricity bill, or fetch it with the 14-digit reference number (all PITC companies; Karachi users upload a photo), or press "Use my decoded bill" if they already decoded one. This gives their real price per unit.
3. **Home.** Appliances, hours of use, load-shedding hours, backup needs, and whether they have a net-metering agreement. They can type "Ghar mein 2 AC hain, ek 1.5 ton inverter wala..." and press "Fill the form for me". Answers are saved for next time.
4. **Confirm.** The AI's reading of the quote is shown line by line. They must correct anything wrong. Roshni never guesses model numbers. Warnings appear if quantity times price does not match the line total.
5. **Report.** The result has a verdict (red, amber or green), critical findings, questions to ask the installer, expected savings (low, expected, high), payback, what runs in load-shedding, the brands in the quote with official check links, and a size and price check against Roshni's own sizing.

**What to tell them about the verdict**
- **Red:** do not pay yet. At least one critical issue, such as a string voltage that can damage the inverter, or a savings claim based on the old net-metering rules.
- **Amber:** ask the installer the listed questions first. Each question is tied to a rule.
- **Green:** nothing wrong on what Roshni could check. It is not a design certificate.
- A missing datasheet value shows as "cannot verify", never as "pass".

**After the report:** Share link, Save as PDF, Urdu translation, "Ask about this report" (the assistant knows the report), Compare with another quote, Loan vs savings, "Should I add a battery?", and an optional "what did you decide?" survey.

## Journey 2: Size my solar (`/size`)

**For:** someone who has no quote yet and wants to know what size and budget to expect. **Time:** about 3 minutes.

1. Enter the home (same form as above), the bill (decoded earlier, or type 12 months of units), and optionally budget in lakh, roof area and what matters most (lower bill, backup, or both).
2. Roshni shows the load (average units, share used in daytime, bill without solar) and up to three options: on-grid, hybrid with 5 kWh battery, hybrid with 10 kWh battery. Each shows a cost range, savings, simple payback and backup hours, and why that size was chosen.
3. **Brands.** Alphabetical lists of panel, inverter and battery brands with origin, what the product is, official checks and, where one exists, a dated public price listing. Filters: international or Pakistan-market, and "has an official check".
4. **Build your own estimate with brands.** Pick the option and the brands they are considering; Roshni prices it from public listings and market ranges and compares it with the budget.
5. The result is saved automatically. They can copy the share link, save it as PDF, save it to their account or delete it.

**Tell them:** the prices are public dealer listings and move weekly; "re-verify before you pay". Roshni does not rank brands and does not use forum ratings, because those are anonymous and easy to fake. Take two or three written quotes with exact models, then check each in Journey 1.

## Journey 3: Parts check (`/audit?mode=parts`)

For self-assemblers. Same steps without the bill, and no savings maths. It answers one question: will these parts work together safely (string voltage, current, battery and inverter match, protection items listed)?

## Journey 4: Bill decoder (`/bill`)

Upload a bill photo or PDF, or type the reference number. Every line is explained in English and Urdu, with "solar can reduce this / cannot remove this", the 12-month chart, and how far they are from the 200-unit protected limit. Buttons then offer a quote check, battery advisor or readiness check with the same bill, with no second upload.

## Journey 5: Battery advisor (`/battery`)

For homes that already have solar. Enter the system (or arrive from a report with it pre-filled) and see 0, 5, 10 and 15 kWh: extra saving, indicative cost, payback and backup hours. An on-grid inverter usually cannot take a battery directly; the page says so.

## Journey 6: Readiness (`/readiness`)

A two-minute check that can honestly answer "not now" (renting without permission, heavy shade, tiny roof, very low use), "check first" or "ready".

## Journey 7: Health check (`/health`)

For existing systems. Type monthly generation from the inverter app or meter, or upload a screenshot of the app and press "Read my screenshot" (check the numbers it fills in). Roshni compares with what a healthy system of that size makes in that city and lists likely causes and settings to check (output priority, grid charging, battery cut-off).

## Journeys 8 and 9: Compare and Loan

**Compare:** two to four checked quotes side by side on one basis (Rs per watt, Rs per usable battery kWh, savings, payback, critical issues). **Loan vs savings:** monthly instalment against monthly saving; pre-filled from a report.

## The assistant (Roshni Madadgar)

Available on every page in English, Urdu and Roman Urdu, with voice input and read-aloud. It knows the open report and can run the battery, loan, readiness, compare and sizing calculators when asked. Good prompts: "Is report ka battery option dikhao", "What does R03 mean?", "Will Pylontech work with Deye?". It will not name a "best brand", will not invent numbers, and tells people to switch off and call a qualified electrician for any safety sign (burning smell, sparking, water).

## Accounts and privacy

- **Account page** (`/account`): sign in with an email code; see saved reports and sizings; "Delete all my reports and sizings".
- Anyone with a report or sizing link can **view** it. Only the creator (account, or the private token in their browser) can delete or save it.
- Uploaded images are not stored. The bill reference number is not stored or logged.

## Common questions

| Question | Answer |
|---|---|
| Why does it say "cannot verify"? | A datasheet value was missing. Roshni will not guess. Ask the installer for the datasheet. |
| Why is my saving lower than the installer said? | Since 9 Feb 2026 new connections get net billing: exports earn about Rs 10 to 11 per unit, not the full tariff. Rule R19 flags 1:1 claims. |
| Is Roshni free? Who pays for it? | Free. No commission, referral, installer or bank revenue. The independence policy is on `/about`. |
| Can it recommend an installer or a brand? | No. It lists facts and checks. Look for AEDB/PPIB-certified installers and verify serial numbers on the maker's own site. |
| Are the prices real? | They are public listings with dates and links, not quotes. Always re-verify. |
| Why is the size smaller than I expected? | Under net billing extra panels export cheaply. Roshni stops where each extra step no longer pays back within 6 years. |

## A 10-minute guided demo

1. Open the home page, switch the language to Urdu and back. (30 seconds)
2. **Bill decoder:** upload a sample bill; show the line explanations. (1.5 minutes)
3. **Size my solar:** use the decoded bill; show the three options, the brand list with prices and the re-verify banner; build an estimate with three brands; show the share link. (3 minutes)
4. **Check a quote:** paste a short quote text; confirm lines; open the report; point to the red or amber findings, the size and price check against the sizing, and the installer questions. (3.5 minutes)
5. **Assistant:** ask in Roman Urdu for a battery comparison; it runs the calculator. (1 minute)
6. **Account:** show saved reports and sizings. (30 seconds)
