/**
 * Underwriting rent: when both HUD FMR and Rentcast estimates exist, use the
 * lower (more conservative) monthly figure.
 */
export function resolveUnderwritingMonthlyRent(
  hudFmr: number,
  hudMetro: string,
  rentcastEst: number,
): { rentUsed: number; rentSource: string } {
  const h = Math.round(Number(hudFmr) || 0);
  const r = Math.round(Number(rentcastEst) || 0);
  if (h > 0 && r > 0) {
    const rentUsed = Math.min(h, r);
    const which = rentUsed === h ? 'HUD FMR' : 'Rentcast';
    return {
      rentUsed,
      rentSource: `Conservative min(HUD, Rentcast) → ${which} ($${rentUsed.toLocaleString('en-US')}/mo; HUD $${h.toLocaleString('en-US')}, Rentcast $${r.toLocaleString('en-US')}; ${hudMetro || 'metro'})`,
    };
  }
  if (h > 0) {
    return { rentUsed: h, rentSource: `HUD FMR (${hudMetro || 'selected geography'})` };
  }
  if (r > 0) {
    return { rentUsed: r, rentSource: 'Rentcast long-term rent estimate' };
  }
  return { rentUsed: 0, rentSource: '' };
}
