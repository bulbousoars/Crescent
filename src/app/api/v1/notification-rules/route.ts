import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

const ruleSchema = z.object({
  name: z.string().max(200).optional().default(''),
  enabled: z.boolean().optional().default(true),
  recipientEmail: z.string().email(),
  minMonthlyCf: z.number().int().nullable().optional(),
  maxMonthlyCf: z.number().int().nullable().optional(),
  minCapRate: z.number().nullable().optional(),
  maxCapRate: z.number().nullable().optional(),
  minPricePerSqft: z.number().nullable().optional(),
  maxPricePerSqft: z.number().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const rules = await prisma.notificationRule.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const data = ruleSchema.parse(await request.json());
  const rule = await prisma.notificationRule.create({ data });
  return NextResponse.json({ ok: true, rule });
}
