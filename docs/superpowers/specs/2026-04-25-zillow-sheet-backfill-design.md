# Zillow Sheet Backfill Design

## Goal
Backfill existing rows from the live Zillow `Listings_Input` Google Sheet into the real estate app's Postgres database.

## Approach
Use the existing app ingestion endpoint instead of direct SQL. A local script reads rows from Google Sheets, maps each row into the same payload shape used by n8n, and posts to `/api/ingestion/zillow-email`.

## Data Flow
`Google Sheets Listings_Input` -> row mapper -> app ingestion endpoint -> Prisma upsert -> `Listing`, `ListingPipeline`, `ListingEvent`, and optional `ListingAnalysis`.

## Error Handling
Rows missing required fields are skipped with a reason. Endpoint failures are recorded in the import summary and do not hide the row index. Dry-run mode performs all mapping and validation without posting to the app.

## Security
Google OAuth credentials and the app ingestion token are read from environment variables. No secrets are committed or written into the script.
