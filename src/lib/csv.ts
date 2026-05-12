/** RFC 4180–style CSV cell escaping for export. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((c) => escapeCsvCell(c)).join(',')).join('\r\n');
}
