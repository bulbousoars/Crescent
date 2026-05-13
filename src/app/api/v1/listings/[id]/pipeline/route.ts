import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

const pipelineUpdateSchema = z.object({
  status: z.enum(['NEW', 'REVIEW', 'KEEP', 'DECLINED', 'OFFER', 'UNDER_CONTRACT', 'CLOSED']),
  manualDecision: z.string().optional().default(''),
  manualNotes: z.string().optional().default(''),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const payload = pipelineUpdateSchema.parse(await request.json());

  const pipeline = await prisma.listingPipeline.upsert({
    where: { listingId: id },
    create: {
      listingId: id,
      status: payload.status,
      manualDecision: payload.manualDecision,
      manualNotes: payload.manualNotes,
    },
    update: payload,
  });

  await prisma.listingEvent.create({
    data: {
      listingId: id,
      eventType: 'API_PIPELINE_UPDATED',
      eventPayloadJson: payload,
    },
  });

  return NextResponse.json({ ok: true, pipeline });
}
