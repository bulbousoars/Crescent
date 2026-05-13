import { describe, expect, it } from 'vitest';
import { interpretPartnerCsvRows } from '@/lib/partnersCsvImport';

describe('interpretPartnerCsvRows', () => {
  it('requires a name column', () => {
    const r = interpretPartnerCsvRows([['role', 'company'], ['x', 'ACME']]);
    expect(r.headerError).toBe('Missing required column: name');
    expect(r.records).toEqual([]);
  });

  it('maps export-shaped headers and skips blank names', () => {
    const r = interpretPartnerCsvRows([
      ['name', 'role', 'company', 'email', 'phone', 'notes', 'linkedAddress'],
      ['Jane', 'lender', 'ACME', 'j@a.com', '555', 'hi', ''],
      ['', 'x', '', '', '', '', ''],
      ['Bob', '', '', '', '', '', ''],
    ]);
    expect(r.headerError).toBeNull();
    expect(r.records).toEqual([
      {
        name: 'Jane',
        role: 'lender',
        company: 'ACME',
        email: 'j@a.com',
        phone: '555',
        notes: 'hi',
        linkedAddress: '',
      },
      {
        name: 'Bob',
        role: '',
        company: '',
        email: '',
        phone: '',
        notes: '',
        linkedAddress: '',
      },
    ]);
  });

  it('accepts Name header case-insensitively', () => {
    const r = interpretPartnerCsvRows([['NAME', 'Email'], ['A', 'a@b.co']]);
    expect(r.headerError).toBeNull();
    expect(r.records).toHaveLength(1);
    expect(r.records[0]!.email).toBe('a@b.co');
  });
});
