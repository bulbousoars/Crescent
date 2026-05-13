import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

const assumptionUpdateSchema = z.object({
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const row = await prisma.assumptionSet.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ assumption: row });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const payload = assumptionUpdateSchema.parse(await request.json());
  const { isDefault, ...data } = payload;

  const assumptions = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.assumptionSet.updateMany({ data: { isDefault: false } });
    return tx.assumptionSet.update({
      where: { id },
      data: { ...data, ...(isDefault !== undefined ? { isDefault } : {}) },
    });
  });

  return NextResponse.json({ ok: true, assumptions });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const count = await prisma.assumptionSet.count();
  if (count <= 1) {
    return NextResponse.json({ error: 'cannot delete the only assumption set' }, { status: 400 });
  }
  try {
    await prisma.assumptionSet.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
