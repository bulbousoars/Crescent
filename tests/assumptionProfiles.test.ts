import { describe, expect, it } from 'vitest';
import { chooseAssumptionProfile } from '@/lib/assumptionProfiles';

describe('chooseAssumptionProfile', () => {
  const profiles = [
    { id: 'conservative', name: 'Conservative', isDefault: false },
    { id: 'base', name: 'Base', isDefault: true },
    { id: 'aggressive', name: 'Aggressive', isDefault: false },
  ];

  it('uses the requested profile when it exists', () => {
    expect(chooseAssumptionProfile(profiles, 'aggressive')?.id).toBe('aggressive');
  });

  it('falls back to the default profile when no request is supplied', () => {
    expect(chooseAssumptionProfile(profiles)?.id).toBe('base');
  });

  it('falls back to the first profile when there is no default', () => {
    expect(chooseAssumptionProfile([{ id: 'only', name: 'Only', isDefault: false }])?.id).toBe('only');
  });
});
