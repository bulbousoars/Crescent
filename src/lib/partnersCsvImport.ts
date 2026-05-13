export type PartnerCsvRecord = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  linkedAddress: string;
};

function getCell(row: string[], idx: number): string {
  if (idx < 0) return '';
  return idx < row.length ? row[idx] ?? '' : '';
}

/**
 * Maps Crescent partner export rows (or compatible CSV) into import records.
 * First row must be headers; includes a `name` column (case-insensitive).
 */
export function interpretPartnerCsvRows(matrix: string[][]): {
  records: PartnerCsvRecord[];
  headerError: string | null;
} {
  if (matrix.length === 0) {
    return { records: [], headerError: 'Empty CSV' };
  }
  const headers = matrix[0]!.map((h) => h.trim().toLowerCase());
  const col = (key: string) => headers.indexOf(key.toLowerCase());
  const iName = col('name');
  if (iName < 0) {
    return { records: [], headerError: 'Missing required column: name' };
  }
  const iRole = col('role');
  const iCompany = col('company');
  const iEmail = col('email');
  const iPhone = col('phone');
  const iNotes = col('notes');
  const iLinked = col('linkedaddress');

  const records: PartnerCsvRecord[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r]!;
    const name = getCell(row, iName).trim();
    if (!name) continue;
    records.push({
      name,
      role: getCell(row, iRole).trim(),
      company: getCell(row, iCompany).trim(),
      email: getCell(row, iEmail).trim(),
      phone: getCell(row, iPhone).trim(),
      notes: getCell(row, iNotes).trim(),
      linkedAddress: getCell(row, iLinked).trim(),
    });
  }
  return { records, headerError: null };
}
