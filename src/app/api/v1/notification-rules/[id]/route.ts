import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({
  name: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
  recipientEmail: z.string().email().optional(),
  minMonthlyCf: z.number().int().nullable().optional(),
  maxMonthlyCf: z.number().int().nullable().optional(),
  minCapRate: z.number().nullable().optional(),
  maxCapRate: z.number().nullable().optional(),
  minPricePerSqft: z.number().nullable().optional(),
  maxPricePerSqft: z.number().nullable().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const rule = await prisma.notificationRule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const data = patchSchema.parse(await request.json());
  try {
    const rule = await prisma.notificationRule.update({ where: { id }, data });
    return NextResponse.json({ ok: true, rule });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  try {
    await prisma.notificationRule.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
