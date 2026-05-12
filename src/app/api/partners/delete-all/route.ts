import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  confirm: z.literal('DELETE_ALL_PARTNERS'),
});

export async function POST(request: NextRequest) {
  const { confirm } = bodySchema.parse(await request.json());
  if (confirm !== 'DELETE_ALL_PARTNERS') {
    return NextResponse.json({ error: 'invalid confirm token' }, { status: 400 });
  }
  const deleted = await prisma.partnerContact.deleteMany({});
  return NextResponse.json({ ok: true, deleted: deleted.count });
}
