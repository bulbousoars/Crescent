# Crescent

Self-hosted real estate listing pipeline. Ingests Zillow alert emails, runs underwriting against a configurable assumption set, and tracks each listing through a personal review pipeline (review → keep → declined → offer → under contract → closed).

> **Status:** early — single-tenant. **Mail:** Gmail (OAuth), **Microsoft 365 / Outlook (Graph OAuth)**, and **IMAP**. The worker polls inboxes, parses Zillow HTML in-process, and ingests. HTTP ingestion remains for automation or legacy flows.

## What it does

- Pulls listing data out of Zillow alert emails (single-listing alerts, digests, price-cut notifications). Parsing prefers the **homedetails** link closest to the detected address (not the first marketing URL in HTML), widens the text slice around that link, and can **fall back to the home Zestimate** when the scraped list price is wildly inconsistent — mitigating wrong prices (e.g. down-payment lines mis-read as list price).
- Stores listings, price history, and per-listing events.
- Computes financials per listing using your assumption set: P&I, taxes, insurance, NOI, cap rate, cash-on-cash, equity-5yr, after-tax cash flow, and a pass/fail tag against your criteria.
- After each Zillow email ingest, optionally **enriches** listings with HUD county FMR, Rentcast long-term rent, and (with `CENSUS_API_KEY`) ACS median household income + an income-based neighborhood context score — then writes a `ListingAnalysis` snapshot using **conservative min(HUD, Rentcast)** rent when both are available.
- Renders a sortable list view, an editable data view, a per-listing detail page with timeline and price history, an **Insights** hub with eight acquisition dashboards, and a **Partners** Rolodex (`/partners`) with CSV export/import.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma · PostgreSQL 16 · Zod · Vitest.

## Quick start

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, INGESTION_API_TOKEN
docker compose up -d --build
```

The app listens on `http://localhost:3000` by default. Override via `APP_BIND` / `APP_PORT` in `.env`.

## Local development

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Run the test suite:

```bash
npm test
```

## Ingestion

**Primary:** connect a mailbox under **Admin → Mail** (Gmail OAuth, **Microsoft 365 OAuth**, or IMAP). The `mail-poll` worker fetches new messages, parses Zillow alert HTML in-process, and runs the same enrichment pipeline as HTTP ingest.

**Optional HTTP API** (n8n, scripts, or tools that already emit JSON payloads):

```http
POST /api/ingestion/zillow-email
Authorization: Bearer <INGESTION_API_TOKEN>
Content-Type: application/json
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | yes (compose) | Used by the bundled Postgres service and to build `DATABASE_URL` |
| `INGESTION_API_TOKEN` | yes | Bearer token guarding `POST /api/ingestion/*` |
| `ADMIN_API_TOKEN` | no | Bearer token for `/admin/*`. Falls back to `INGESTION_API_TOKEN` if unset. |
| `ADMIN_FORWARD_AUTH_HEADER` | no | Header set by an upstream reverse proxy (Authentik, oauth2-proxy, Tailscale Serve, etc.) that proves the user is authenticated. When set, requests carrying this header are treated as admin-authorized without needing `ADMIN_API_TOKEN`. Example: `x-authentik-email`. |
| `ADMIN_FORWARD_AUTH_ALLOWLIST` | no | Comma-separated allowlist of accepted values for `ADMIN_FORWARD_AUTH_HEADER`. If empty (and the header var is set), any non-empty value is accepted — only safe when the upstream proxy is the only way to reach the app. |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL of the app (used in links) |
| `APP_BIND` | no | Bind address for the Compose port mapping (default `0.0.0.0`) |
| `HUD_API_TOKEN` | no | Bearer token from [HUD USER API](https://www.huduser.gov/hudapi/public/login). Used to fetch county FMR (`/fmr/statedata/{state}`) after ingest. Without it, underwriting falls back to Rentcast-only or the price multiplier. |
| `HUD_FMR_YEAR` | no | FMR dataset year for HUD calls (default `2025`). |
| `RENTCAST_API_KEY` | no | `X-Api-Key` for [Rentcast](https://developers.rentcast.io/) long-term rent estimates. |
| `CENSUS_API_KEY` | no | U.S. Census Bureau API key for ACS median household income by ZCTA (neighborhood context on listings + scatter on Insights). |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | no | Gmail OAuth (see Admin → Mail). |
| `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` | no | Microsoft 365 / Outlook via Graph (redirect `/api/admin/mail/callback/microsoft`). |
| `MICROSOFT_OAUTH_TENANT` | no | Entra tenant: `common` (default), `organizations`, `consumers`, or a tenant GUID. |
| `DATA_API_TOKEN` | no | When set, enables **`/api/v1/*`** bearer automation API (listings, assumptions, notification rules, reanalyze). If unset, those routes return 503. |
| `SMTP_URL` | no | Threshold alert delivery, e.g. `smtp://user:pass@host:587` or `smtps://user:pass@host:465`. |
| `NOTIFICATION_FROM` | no | From header for alert emails (defaults to `crescent@localhost` if unset). |

## Data API (v1)

Single-tenant REST surface guarded by **`Authorization: Bearer <DATA_API_TOKEN>`** (set `DATA_API_TOKEN` in the environment).

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/v1/whoami` | Sanity check that the token is accepted. |
| GET | `/api/v1/listings` | List listings (same query params as `/api/listings`, optional `limit`). |
| GET | `/api/v1/listings/:id` | Listing detail with pipeline, market context, recent analyses, price history. |
| PATCH | `/api/v1/listings/:id` | Update numeric listing fields (same shape as UI API). |
| PATCH | `/api/v1/listings/:id/pipeline` | Update pipeline status / notes. |
| POST | `/api/v1/listings/:id/reanalyze` | Re-run HUD/Rentcast/Census enrichment and append a `ListingAnalysis`. |
| GET / POST | `/api/v1/assumption-sets` | List or create assumption sets. |
| GET / PUT / DELETE | `/api/v1/assumption-sets/:id` | Read, replace, or delete an assumption set (cannot delete the last set). |
| GET / POST | `/api/v1/notification-rules` | List or create threshold alert rules. |
| GET / PATCH / DELETE | `/api/v1/notification-rules/:id` | Read, update, or delete a rule. |

There is no separate “users” table yet: access is **one bearer token per deployment**. Multi-tenant accounts would be a future schema change.

**Microsoft 365 app registration:** create an Entra ID “app registration”, add delegated API permissions **`Mail.ReadWrite`**, **`User.Read`**, and **`offline_access`**, then add the redirect URI shown on **Admin → Mail**.

## Threshold email alerts

When `SMTP_URL` is set and you define rows via **`/api/v1/notification-rules`**, Crescent emails **`recipientEmail`** after each successful listing **re-analysis** (the same path as **Reanalyze** / post-ingest enrich) whenever **all** configured bounds match:

- `minMonthlyCf` / `maxMonthlyCf` — dollars per month (`ListingAnalysis.monthlyCf`).
- `minCapRate` / `maxCapRate` — **decimal** fractions (e.g. `0.08` = 8% cap rate, matching stored analysis).
- `minPricePerSqft` / `maxPricePerSqft` — list price ÷ sqft (skipped if sqft is 0).

One email per `(rule, listing, analysis row)` is logged in `NotificationLog` to avoid duplicates for the same analysis snapshot.

```text
prisma/                 # schema, migrations, seed
src/app/                # Next.js routes (App Router)
src/app/api/            # API routes (listings, ingestion, health, workflows)
src/lib/                # ingestion, analysis, parsing helpers
src/components/         # shared UI
tests/                  # vitest suites
docs/                   # design notes and plans
```

## Roadmap

See `docs/` for current design notes. **Buy-side product direction** (deal math lab, market context, partner Rolodex, dashboard cues): [`docs/PRODUCT_BUY_SIDE.md`](docs/PRODUCT_BUY_SIDE.md). Shipped in-repo: listing **What-if lab** (ephemeral; optional timeline snapshot), **Market context** panel + DB overrides, **Partners** directory at `/partners` (CSV export + import), Insights **capital in play** by pipeline stage, **Gmail + Microsoft Graph + IMAP** mail sync with hardened Zillow parsing, **Data API v1**, **SMTP threshold alerts**. Near-term:

- Dashboard scenario overlays and richer acquisition-funnel metrics.
- Tighter n8n parity only where still useful (criteria helpers, extra notification channels).

After pulling, apply DB migrations (includes notification tables):

```bash
npx prisma migrate deploy
```

## License

[AGPL-3.0-or-later](LICENSE). If you run a modified version of Crescent as a network service, you must make the source of your modifications available to its users.
