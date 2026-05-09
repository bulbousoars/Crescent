import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { ingestZillowEmail } from '@/lib/ingestion';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await ingestZillowEmail(prisma, payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
