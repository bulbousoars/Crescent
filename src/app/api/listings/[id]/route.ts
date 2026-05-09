import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const editSchema = z.object({
  price: z.number().int().nonnegative().optional(),
  priceCut: z.number().int().nonnegative().optional(),
  beds: z.number().nonnegative().optional(),
  baths: z.number().nonnegative().optional(),
  sqft: z.number().int().nonnegative().optional(),
  hoaMonthly: z.number().int().nonnegative().optional(),
  yearBuilt: z.string().optional(),
}).refine((obj) => Object.keys(obj).length > 0, { message: 'no fields to update' });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues }, { status: 400 });
  }
  const updates = parsed.data;

  const prior = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, price: true, priceCut: true },
  });
  if (!prior) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }

  const updated = await prisma.listing.update({ where: { id }, data: updates });

  const priceChanged =
    (updates.price !== undefined && updates.price !== prior.price) ||
    (updates.priceCut !== undefined && updates.priceCut !== prior.priceCut);

  if (priceChanged) {
    await prisma.listingPriceHistory.create({
      data: {
        listingId: id,
        price: updated.price,
        priceCut: updated.priceCut,
        source: 'manual',
      },
    });
  }

  await prisma.listingEvent.create({
    data: {
      listingId: id,
      eventType: 'MANUAL_EDIT',
      eventPayloadJson: {
        before: prior,
        after: updates,
      },
    },
  });

  return NextResponse.json({ ok: true, listing: updated });
}
