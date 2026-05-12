# Crescent

Self-hosted real estate listing pipeline. Ingests Zillow alert emails, runs underwriting against a configurable assumption set, and tracks each listing through a personal review pipeline (review → keep → declined → offer → under contract → closed).

> **Status:** early — single-tenant, single-mailbox today. Mail-provider abstraction is in progress; see `docs/` for design notes.

## What it does

- Pulls listing data out of Zillow alert emails (single-listing alerts, digests, price-cut notifications).
- Stores listings, price history, and per-listing events.
- Computes financials per listing using your assumption set: P&I, taxes, insurance, NOI, cap rate, cash-on-cash, equity-5yr, after-tax cash flow, and a pass/fail tag against your criteria.
- After each Zillow email ingest, optionally **enriches** listings with HUD county FMR, Rentcast long-term rent, and (with `CENSUS_API_KEY`) ACS median household income + an income-based neighborhood context score — then writes a `ListingAnalysis` snapshot using **conservative min(HUD, Rentcast)** rent when both are available.
- Renders a sortable list view, an editable data view, a per-listing detail page with timeline and price history, and an **Insights** hub with eight acquisition dashboards.

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

## Ingestion endpoint

Today, the app accepts already-parsed listing payloads at:

```http
POST /api/ingestion/zillow-email
Authorization: Bearer <INGESTION_API_TOKEN>
Content-Type: application/json
```

The mail-provider work in progress will move parsing inside the app so external callers (n8n, custom scripts) become optional rather than required.

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

See `docs/` for current design notes. **Buy-side product direction** (deal math lab, market context, partner Rolodex, dashboard cues): [`docs/PRODUCT_BUY_SIDE.md`](docs/PRODUCT_BUY_SIDE.md). Shipped in-repo: listing **What-if lab** (ephemeral; optional timeline snapshot), **Market context** panel + DB overrides, **Partners** directory at `/partners`, Insights **capital in play** by pipeline stage. Near-term:

- Mail-provider abstraction (Gmail OAuth + IMAP fallback) so the app pulls listings directly.
- Port n8n parsing/criteria/financials rules into the app.
- OpenBao/Vault integration for secret storage.
- Microsoft Graph provider for Outlook/365 mailboxes.

## License

[AGPL-3.0-or-later](LICENSE). If you run a modified version of Crescent as a network service, you must make the source of your modifications available to its users.
