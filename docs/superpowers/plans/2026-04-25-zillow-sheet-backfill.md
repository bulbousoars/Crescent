# Zillow Sheet Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import existing Zillow workbook rows into the real estate app database through the existing ingestion endpoint.

**Architecture:** Add a pure row-mapping module with tests, then add a CLI script that reads Google Sheets data, maps rows, and posts valid payloads to the app endpoint. The import is idempotent through the ingestion upsert behavior.

**Tech Stack:** TypeScript, Vitest, Node `fetch`, Google Sheets REST API, Next.js app ingestion endpoint.

---

### Task 1: Sheet Row Mapper

**Files:**
- Create: `src/lib/zillowSheetBackfill.ts`
- Create: `tests/zillowSheetBackfill.test.ts`

- [ ] Write tests for converting `Listings_Input` rows into ingestion payloads.
- [ ] Verify the tests fail before implementation.
- [ ] Implement mapper helpers for currency, percentages, numbers, and required-field validation.
- [ ] Verify mapper tests pass.

### Task 2: Backfill Script

**Files:**
- Create: `scripts/backfill-zillow-sheet.ts`

- [ ] Read Google OAuth credentials from environment variables.
- [ ] Fetch `Listings_Input` values from the live spreadsheet.
- [ ] Map rows with `mapZillowSheetRow`.
- [ ] In dry-run mode, print counts only.
- [ ] In import mode, POST valid payloads to `/api/ingestion/zillow-email`.

### Task 3: Live Run

- [ ] Run all tests and TypeScript.
- [ ] Run dry-run with live Google credentials and app token.
- [ ] If dry-run is clean enough, run import.
- [ ] Verify app/Postgres row counts.
- [ ] Update notes after production data changes.
