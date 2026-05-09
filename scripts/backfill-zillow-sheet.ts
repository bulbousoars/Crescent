import { mapZillowSheetRow, rowsToObjects } from '../src/lib/zillowSheetBackfill';

const DEFAULT_SPREADSHEET_ID = process.env.ZILLOW_SHEET_ID ?? '';
const DEFAULT_SHEET_NAME = process.env.ZILLOW_SHEET_NAME ?? 'Listings_Input';
const DEFAULT_APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

type ImportError = {
  rowNumber: number;
  reason: string;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;

  const body = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: requiredEnv('GOOGLE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error('Google token refresh did not return access_token');
  return json.access_token;
}

async function googleFetch<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function fetchSheetRows(token: string, spreadsheetId: string, sheetName: string) {
  const range = encodeURIComponent(`${sheetName}!A:AZ`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const json = await googleFetch<{ values?: unknown[][] }>(token, url);
  const values = json.values ?? [];
  const headers = (values[0] ?? []).map((header) => String(header ?? '').trim());
  const rows = values.slice(1);
  return rowsToObjects(headers, rows).map((row, index) => ({
    row,
    rowNumber: index + 2,
  }));
}

function cellValue(cell: { value?: Record<string, unknown> }) {
  const value = cell.value ?? {};
  return value.stringValue ?? value.numberValue ?? value.boolValue ?? value.formulaValue ?? '';
}

function fetchSnapshotRows(snapshotPath: string, sheetName: string) {
  const snapshot = JSON.parse(require('node:fs').readFileSync(snapshotPath, 'utf8')) as {
    sheets?: Array<{
      title?: string;
      rows?: Array<{
        row: number;
        values?: Array<{ col: number; value?: Record<string, unknown> }>;
      }>;
    }>;
  };
  const sheet = snapshot.sheets?.find((candidate) => candidate.title === sheetName);
  if (!sheet?.rows?.length) throw new Error(`Snapshot sheet not found or empty: ${sheetName}`);

  const headerRow = sheet.rows.find((row) => row.row === 1);
  if (!headerRow?.values?.length) throw new Error(`Snapshot sheet is missing header row: ${sheetName}`);

  const headers = new Map<number, string>();
  for (const cell of headerRow.values) {
    const header = String(cellValue(cell)).trim();
    if (header) headers.set(cell.col, header);
  }

  return sheet.rows
    .filter((row) => row.row > 1)
    .map((snapshotRow) => {
      const row: Record<string, unknown> = {};
      for (const cell of snapshotRow.values ?? []) {
        const header = headers.get(cell.col);
        if (header) row[header] = cellValue(cell);
      }
      return {
        row,
        rowNumber: snapshotRow.row,
      };
    });
}

async function postPayload(appUrl: string, token: string, payload: unknown) {
  const response = await fetch(`${appUrl.replace(/\/$/, '')}/api/ingestion/zillow-email`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status}: ${body}`);
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const spreadsheetId = argValue('--spreadsheet-id') || process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const sheetName = argValue('--sheet') || process.env.SHEET_NAME || DEFAULT_SHEET_NAME;
  const appUrl = argValue('--app-url') || process.env.APP_URL || DEFAULT_APP_URL;
  const snapshotPath = argValue('--snapshot') || process.env.SNAPSHOT_PATH || '';
  const rows = snapshotPath
    ? fetchSnapshotRows(snapshotPath, sheetName)
    : await fetchSheetRows(await getAccessToken(), spreadsheetId, sheetName);
  const ingestionToken = apply ? requiredEnv('INGESTION_API_TOKEN') : process.env.INGESTION_API_TOKEN || '';

  const skipped: ImportError[] = [];
  const failed: ImportError[] = [];
  let valid = 0;
  let imported = 0;

  for (const { row, rowNumber } of rows) {
    const mapped = mapZillowSheetRow(row, rowNumber);
    if (!mapped.ok) {
      skipped.push({ rowNumber, reason: mapped.reason });
      continue;
    }

    valid += 1;
    if (!apply) continue;

    try {
      await postPayload(appUrl, ingestionToken, mapped.payload);
      imported += 1;
    } catch (error) {
      failed.push({
        rowNumber,
        reason: error instanceof Error ? error.message : 'Unknown import error',
      });
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    source: snapshotPath ? 'snapshot' : 'google-sheets',
    spreadsheetId,
    sheetName,
    rowsRead: rows.length,
    valid,
    imported,
    skipped: skipped.length,
    failed: failed.length,
    skippedSamples: skipped.slice(0, 10),
    failedSamples: failed.slice(0, 10),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
