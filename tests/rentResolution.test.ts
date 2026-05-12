import { describe, expect, it } from 'vitest';
import { resolveUnderwritingMonthlyRent } from '@/lib/rentResolution';

describe('resolveUnderwritingMonthlyRent', () => {
  it('returns min when both HUD and Rentcast are positive', () => {
    expect(resolveUnderwritingMonthlyRent(2000, 'Metro', 1800)).toMatchObject({ rentUsed: 1800 });
    expect(resolveUnderwritingMonthlyRent(1500, 'Metro', 1900)).toMatchObject({ rentUsed: 1500 });
  });

  it('returns HUD only when Rentcast missing', () => {
    expect(resolveUnderwritingMonthlyRent(2000, 'M', 0)).toMatchObject({ rentUsed: 2000 });
  });

  it('returns Rentcast only when HUD missing', () => {
    expect(resolveUnderwritingMonthlyRent(0, '', 1750)).toMatchObject({ rentUsed: 1750 });
  });
});
