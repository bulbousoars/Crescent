import { describe, expect, it } from 'vitest';
import { escapeCsvCell, rowsToCsv } from '@/lib/csv';

describe('csv', () => {
  it('escapeCsvCell leaves simple values unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('escapeCsvCell quotes fields with commas or quotes', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('rowsToCsv joins rows with CRLF', () => {
    expect(rowsToCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2');
  });
});
