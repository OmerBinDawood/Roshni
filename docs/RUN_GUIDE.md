# Roshni: Run, Admin and Deploy Guide

How to install, configure, run, test, administer and deploy Roshni. Written for someone who has only this repository.

## 1. What you need

| Item | Version | Why |
|---|---|---|
| Python | 3.11 or newer (built and tested on 3.13) | Backend API, solar engine |
| Node.js | 20 or newer (built on 22) | Next.js web app |
| Gemini API key | any Google AI Studio key | Reads quotes and bills, assistant, translation |
| Supabase project (optional) | free tier is fine | Postgres database and email sign-in. Without it the backend uses a local SQLite file and sign-in is unavailable |
| Internet | | PVGIS weather is downloaded once per city, then cached |

## 2. Run the backend (API, port 8000)

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # macOS / Linux: .venv/bin/pip
cp .env.example .env                               # then edit .env (section 4)
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Check it: open `http://127.0.0.1:8000/api/health`. You should see `{"ok":true,"model":"gemini-3.5-flash","db":"postgresql"}` (or `"db":"sqlite"`). Interactive API docs are at `http://127.0.0.1:8000/docs`.

The backend does **not** reload on code changes. Stop it (Ctrl+C) and start it again after pulling updates.

## 3. Run the frontend (web app, port 3000)

```bash
cd frontend
npm install
cp .env.example .env.local                         # then edit .env.local (section 4)
npm run dev                                        # http://localhost:3000
```

The web app forwards every `/api/...` request to the backend (`BACKEND_URL`, default `http://127.0.0.1:8000`). Start the backend first. For a production build: `npm run build` then `npm start`.

## 4. Configuration

`backend/.env` (never commit this file; it is git-ignored):

| Variable | Needed | What it is |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini access |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash` |
| `DATABASE_URL` | no | Supabase **session pooler** URL (IPv4), password URL-encoded. Empty means local SQLite (`backend/roshni.db`) |
| `SUPABASE_JWKS_URL` | for sign-in | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` (or set `SUPABASE_URL` and it is derived) |
| `ADMIN_TOKEN` | for `/admin` | The admin password (section 6) |
| `CORS_ORIGINS` | no | Allowed web origins when the site is not on localhost |

`frontend/.env.local`:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (public) |
| `BACKEND_URL` | Where the API runs |

Supabase dashboard (for sign-in): Authentication, URL Configuration: add `http://localhost:3000` (and later your live domain). Optionally put `{{ .Token }}` in the Magic Link email template so users can type a 6-digit code.

## 5. Tests and checks

```bash
cd backend && .venv/Scripts/python -m pytest -q        # 59 tests, about 1.5 minutes, uses a throwaway SQLite file
cd frontend && npx tsc --noEmit && npx eslint src      # type check and lint
```

Tests never touch your real database and never call Gemini (the AI features are checked by hand with real documents; the engine, rules, API limits, ownership and sign-in are checked by the automated tests).

## 6. Admin: credentials and endpoints

**There are no admin usernames.** Admin access is a single shared secret, the `ADMIN_TOKEN` value in `backend/.env`. It is not stored in the repository. To read it on your machine:

```bash
grep ADMIN_TOKEN backend/.env
```

If it is still `change-me`, set a long random value (for example 32 random characters) and restart the backend. Treat it like a password: do not share it in chat or commit it. If `ADMIN_TOKEN` is empty, every admin call is refused.

**Admin web page:** `http://localhost:3000/admin`. Paste the token, enter your name as reviewer, press Load.

**Admin API** (send the token in the `x-admin-token` header):

| Method and path | Purpose |
|---|---|
| `GET /api/admin/datasheets?only_unverified=true` | Datasheets found by Gemini web lookup that still need human verification |
| `POST /api/admin/datasheets/{id}/verify` with `{"specs": {...}, "verified_by": "Name"}` | Mark a datasheet verified (you may correct the specs in the same call) |
| `GET /api/admin/stats` | North-star metric: reports, responses, decisions improved |
| `GET /api/admin/insights` | Per triggered rule: how many users renegotiated, walked away, proceeded; willingness to pay |

Example:

```bash
curl -H "x-admin-token: YOUR_TOKEN" http://127.0.0.1:8000/api/admin/stats
```

**Other admin surfaces you own:** the Supabase dashboard (tables, auth users, logs), the Google AI Studio key page, and the GitHub repository. Those use your own accounts, not Roshni credentials.

**Routine admin jobs**
1. Weekly: open `/admin`, verify new datasheets.
2. Monthly: refresh `backend/app/data/brand_prices.json` (prices and their dates) and re-check `regulatory.json` against NEPRA notices.
3. After each NEPRA change: update `regulatory.json`, its `version` and `as_of`, then run the tests.

## 7. Every backend endpoint

| Group | Endpoints |
|---|---|
| Health and meta | `GET /api/health`, `GET /api/meta` |
| Reading documents | `POST /api/extract/quote`, `POST /api/extract/bill`, `POST /api/extract/readings`, `POST /api/bill/lookup`, `GET /api/bill/companies`, `POST /api/specs/lookup`, `POST /api/profile/parse`, `POST /api/validate/quote` |
| Audit and reports | `POST /api/audit`, `GET /api/report/{id}`, `GET /api/report/{id}/access`, `DELETE /api/report/{id}`, `POST /api/report/{id}/claim`, `POST /api/report/{id}/urdu`, `POST /api/report/{id}/outcome` |
| Sizing | `POST /api/size`, `GET /api/sizing/{id}`, `DELETE /api/sizing/{id}`, `POST /api/sizing/{id}/claim`, `GET /api/me/sizings`, `POST /api/size/estimate` |
| Other journeys | `POST /api/battery`, `POST /api/readiness`, `POST /api/compare`, `POST /api/health-check`, `POST /api/financing` |
| Brands | `GET /api/brands`, `GET /api/brands/{id}` |
| Assistant | `POST /api/chat`, `POST /api/chat/upload` |
| Accounts | `GET|DELETE /api/me/reports`, `GET|PUT /api/me/profile` (sign-in token required) |
| Admin | see section 6 |

## 8. Deploying

1. **Backend:** any Python host (Render, Railway, Fly, a VM). Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set the variables in section 4 as host secrets. Use a persistent disk or keep `backend/.cache` writable (weather cache refills itself).
2. **Frontend:** any Node host (Vercel, a VM). Set `BACKEND_URL` to the API address **at build time** (the rewrite is read when the app is built), plus the two Supabase public variables.
3. Set `CORS_ORIGINS` on the backend to your site address.
4. In Supabase, add the live site URL under Authentication, URL Configuration, and send yourself a test sign-in email.
5. Before launch: add rate limits to the AI endpoints (a known gap), add error monitoring, rotate `ADMIN_TOKEN`, and re-check prices and tariffs.

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Pages load but actions fail with 404 or "Failed to fetch" | The backend is not running, or is an old copy. Start or restart it on port 8000 |
| `Address already in use` on 8000 or 3000 | Another copy is running. Stop it, or use another port and set `BACKEND_URL` |
| `GEMINI_API_KEY is not set` | Add it to `backend/.env` and restart the backend |
| Database connection error | Use the Supabase **session pooler** URL, not the direct `db.<ref>.supabase.co` host (IPv6 only) |
| "Your session is invalid or expired" right after signing in | Fixed (60 seconds clock-skew allowance); restart an old backend |
| First request for a city is slow | PVGIS weather is downloaded once, then cached in `backend/.cache` |
| Admin page says "Admin token required" | Wrong or empty `ADMIN_TOKEN`, or the backend was not restarted after you changed it |
