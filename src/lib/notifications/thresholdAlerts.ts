import type { NotificationRule, PrismaClient } from '@prisma/client';
import { sendSmtpEmail } from './smtpMail';

function ruleMatches(
  rule: Pick<
    NotificationRule,
    'minMonthlyCf' | 'maxMonthlyCf' | 'minCapRate' | 'maxCapRate' | 'minPricePerSqft' | 'maxPricePerSqft'
  >,
  monthlyCf: number,
  capRate: number,
  pricePerSqft: number | null,
): boolean {
  if (rule.minMonthlyCf != null && monthlyCf < rule.minMonthlyCf) return false;
  if (rule.maxMonthlyCf != null && monthlyCf > rule.maxMonthlyCf) return false;
  if (rule.minCapRate != null && capRate < rule.minCapRate) return false;
  if (rule.maxCapRate != null && capRate > rule.maxCapRate) return false;
  if (pricePerSqft != null) {
    if (rule.minPricePerSqft != null && pricePerSqft < rule.minPricePerSqft) return false;
    if (rule.maxPricePerSqft != null && pricePerSqft > rule.maxPricePerSqft) return false;
  } else if (rule.minPricePerSqft != null || rule.maxPricePerSqft != null) {
    return false;
  }
  return true;
}

/** After a new ListingAnalysis row is saved, email any matching threshold rules (requires SMTP_URL). */
export async function runThresholdNotifications(
  prisma: PrismaClient,
  listingId: string,
  analysisId: string,
): Promise<void> {
  if (!process.env.SMTP_URL?.trim()) return;

  const [listing, analysis, rules] = await Promise.all([
    prisma.listing.findUnique({ where: { id: listingId } }),
    prisma.listingAnalysis.findUnique({ where: { id: analysisId } }),
    prisma.notificationRule.findMany({ where: { enabled: true } }),
  ]);
  if (!listing || !analysis || rules.length === 0) return;

  const pricePerSqft = listing.sqft > 0 ? listing.price / listing.sqft : null;
  const monthlyCf = analysis.monthlyCf;
  const capRate = analysis.capRate;

  const appBase = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') || 'http://localhost:3000';

  for (const rule of rules) {
    if (!ruleMatches(rule, monthlyCf, capRate, pricePerSqft)) continue;
    const existing = await prisma.notificationLog.findUnique({
      where: {
        ruleId_listingId_analysisId: { ruleId: rule.id, listingId, analysisId },
      },
    });
    if (existing) continue;

    const subject = `[Crescent] ${rule.name || 'Listing alert'} — ${listing.address}`;
    const lines = [
      `Rule: ${rule.name || rule.id}`,
      `Address: ${listing.address}`,
      `List price: $${listing.price.toLocaleString()}`,
      listing.sqft ? `Price / sqft: $${(pricePerSqft ?? 0).toFixed(0)}` : 'Sqft: unknown',
      `Monthly CF (underwriting): $${monthlyCf.toLocaleString()}`,
      `Cap rate: ${(capRate * 100).toFixed(2)}%`,
      `Open: ${appBase}/listings/${listing.id}`,
    ];
    try {
      await sendSmtpEmail({
        to: rule.recipientEmail,
        subject,
        text: lines.join('\n'),
      });
      await prisma.notificationLog.create({
        data: { ruleId: rule.id, listingId, analysisId },
      });
    } catch (e) {
      console.warn('[notifications] send failed:', e instanceof Error ? e.message : e);
    }
  }
}
