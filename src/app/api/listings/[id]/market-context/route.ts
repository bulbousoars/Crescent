import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const empty = {
  rentCompSummary: '',
  neighborhoodTags: '',
  floodZoneNote: '',
  schoolTierNote: '',
  rentControlNote: '',
  hoaSpecialAssessmentNote: '',
  macroStressNotes: '',
  propertyTaxMonthlyOverride: null as number | null,
  insuranceMonthlyOverride: null as number | null,
  userNotes: '',
};

const upsertSchema = z.object({
  rentCompSummary: z.string().optional(),
  neighborhoodTags: z.string().optional(),
  floodZoneNote: z.string().optional(),
  schoolTierNote: z.string().optional(),
  rentControlNote: z.string().optional(),
  hoaSpecialAssessmentNote: z.string().optional(),
  macroStressNotes: z.string().optional(),
  propertyTaxMonthlyOverride: z.number().int().nonnegative().nullable().optional(),
  insuranceMonthlyOverride: z.number().int().nonnegative().nullable().optional(),
  userNotes: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const row = await prisma.listingMarketContext.findUnique({ where: { listingId: id } });
  return NextResponse.json({ context: row ? { ...row } : { listingId: id, ...empty, updatedAt: null } });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = upsertSchema.parse(await request.json());
  const saved = await prisma.listingMarketContext.upsert({
    where: { listingId: id },
    create: { listingId: id, ...empty, ...body },
    update: { ...body },
  });

  return NextResponse.json({ ok: true, context: saved });
}
