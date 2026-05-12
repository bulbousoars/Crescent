import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { escapeCsvCell } from '@/lib/csv';

export async function GET() {
  const rows = await prisma.partnerContact.findMany({
    orderBy: { name: 'asc' },
    include: { linkedListing: { select: { address: true } } },
  });

  const header = ['name', 'role', 'company', 'email', 'phone', 'notes', 'linkedAddress'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        escapeCsvCell(r.name),
        escapeCsvCell(r.role),
        escapeCsvCell(r.company),
        escapeCsvCell(r.email),
        escapeCsvCell(r.phone),
        escapeCsvCell(r.notes),
        escapeCsvCell(r.linkedListing?.address ?? ''),
      ].join(','),
    ),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crescent-partners.csv"',
    },
  });
}
