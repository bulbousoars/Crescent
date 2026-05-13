import { NextRequest, NextResponse } from 'next/server';
import { enrichListingById } from '@/lib/enrichment/enrichListing';
import { requireDataApiToken } from '@/lib/dataApiAuth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  const { id } = await context.params;
  const exists = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

  const result = await enrichListingById(prisma, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
