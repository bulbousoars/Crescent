import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

const assumptionUpdateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  isDefault: z.boolean().optional(),
  downPaymentPct: z.number(),
  interestRate: z.number(),
  loanTermYears: z.number().int(),
  vacancyPct: z.number(),
  maintenancePct: z.number(),
  propertyMgmtPct: z.number(),
  insuranceRate: z.number(),
  closingCostPct: z.number(),
  rentMultiplier: z.number(),
  appreciationRate: z.number(),
  maxHoa: z.number().int(),
  minPrice: z.number().int(),
  minBeds: z.number(),
  minBaths: z.number(),
  minSqft: z.number().int(),
});

export async function GET(request: NextRequest) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const assumptions = await prisma.assumptionSet.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ assumptions });
}

export async function POST(request: NextRequest) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const payload = assumptionUpdateSchema.parse(await request.json());
  const { id: _id, isDefault, ...data } = payload;

  const assumptions = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.assumptionSet.updateMany({ data: { isDefault: false } });
    return tx.assumptionSet.create({ data: { ...data, isDefault: Boolean(isDefault) } });
  });

  return NextResponse.json({ ok: true, assumptions });
}
