export type AssumptionProfileSummary = {
  id: string;
  name: string;
  isDefault: boolean;
};

export function chooseAssumptionProfile<T extends AssumptionProfileSummary>(
  profiles: T[],
  requestedId?: string,
) {
  if (profiles.length === 0) return null;
  if (requestedId) {
    const requested = profiles.find((profile) => profile.id === requestedId);
    if (requested) return requested;
  }
  return profiles.find((profile) => profile.isDefault) ?? profiles[0];
}
