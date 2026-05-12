import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  linkedListingId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const roleQ = (request.nextUrl.searchParams.get('role') ?? '').trim().toLowerCase();
  const partners = await prisma.partnerContact.findMany({
    where: roleQ
      ? { role: { contains: roleQ, mode: 'insensitive' } }
      : undefined,
    orderBy: { name: 'asc' },
    include: { linkedListing: { select: { id: true, address: true } } },
  });
  return NextResponse.json({ partners });
}

export async function POST(request: NextRequest) {
  const data = createSchema.parse(await request.json());
  const partner = await prisma.partnerContact.create({
    data: {
      name: data.name,
      role: data.role ?? '',
      company: data.company ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      notes: data.notes ?? '',
      linkedListingId: data.linkedListingId ?? null,
    },
  });
  return NextResponse.json({ ok: true, partner });
}
