import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const snapshotSchema = z.object({
  label: z.string().max(200).optional(),
  inputs: z.record(z.unknown()),
  outputs: z.record(z.unknown()),
});

/** Persists a one-off what-if run to the listing timeline (optional); does not change ListingAnalysis. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const payload = snapshotSchema.parse(await request.json());

  await prisma.listingEvent.create({
    data: {
      listingId: id,
      eventType: 'WHAT_IF_SNAPSHOT',
      eventPayloadJson: {
        label: payload.label ?? 'What-if lab snapshot',
        savedAt: new Date().toISOString(),
        inputs: payload.inputs,
        outputs: payload.outputs,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
