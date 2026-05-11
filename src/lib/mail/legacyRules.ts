/** Labels we used before standardizing on Real-Estate (DB migration + OAuth reconnect). */
export const LEGACY_PROCESSED_LABELS = new Set(['Crescent/Processed', 'Crescent-Processed']);

export type MailRulesJson = { fromAllowlist?: string[]; processedLabel?: string; query?: string };

export function mergeMailRules(prev: unknown, defaults: MailRulesJson): MailRulesJson {
  if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return { ...defaults };
  const merged: MailRulesJson = { ...defaults, ...(prev as MailRulesJson) };
  if (typeof merged.processedLabel === 'string' && LEGACY_PROCESSED_LABELS.has(merged.processedLabel)) {
    merged.processedLabel = 'Real-Estate';
  }
  return merged;
}
