import { describe, expect, it } from 'vitest';
import { escapeCsvCell, parseCsv, rowsToCsv } from '@/lib/csv';

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

  it('parseCsv splits simple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('parseCsv handles CRLF and quoted commas', () => {
    expect(parseCsv('a,"b,c"\r\n1,2')).toEqual([
      ['a', 'b,c'],
      ['1', '2'],
    ]);
  });

  it('parseCsv handles doubled quotes and newlines inside quotes', () => {
    expect(parseCsv('x,"line1\nline2""q"')).toEqual([['x', 'line1\nline2"q']]);
  });

  it('parseCsv drops trailing all-empty row after final newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
  });
});
