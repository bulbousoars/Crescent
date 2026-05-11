import { describe, it, expect } from 'vitest';
import { mergeMailRules } from '../../src/lib/mail/legacyRules';

const defaults = {
  fromAllowlist: ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
  processedLabel: 'Real-Estate',
};

describe('mergeMailRules', () => {
  it('returns defaults when prev is missing', () => {
    expect(mergeMailRules(undefined, defaults)).toEqual(defaults);
  });

  it('rewrites Crescent/Processed to Real-Estate', () => {
    expect(
      mergeMailRules(
        { fromAllowlist: ['a@b.com'], processedLabel: 'Crescent/Processed' },
        defaults,
      ),
    ).toEqual({
      fromAllowlist: ['a@b.com'],
      processedLabel: 'Real-Estate',
    });
  });

  it('preserves Real-Estate and custom allowlist', () => {
    expect(
      mergeMailRules({ fromAllowlist: ['x@y.com'], processedLabel: 'Real-Estate' }, defaults),
    ).toEqual({ fromAllowlist: ['x@y.com'], processedLabel: 'Real-Estate' });
  });
});
