import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseCsv } from '@/lib/csv';
import { interpretPartnerCsvRows } from '@/lib/partnersCsvImport';
import { prisma } from '@/lib/prisma';

const MAX_CSV_CHARS = 2_000_000;
const MAX_ROWS = 2000;

const bodySchema = z.object({
  csv: z.string().max(MAX_CSV_CHARS),
});

export async function POST(request: NextRequest) {
  let raw: string;
  try {
    const json = await request.json();
    raw = bodySchema.parse(json).csv;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body; expected { "csv": "..." }' }, { status: 400 });
  }

  const matrix = parseCsv(raw);
  const { records, headerError } = interpretPartnerCsvRows(matrix);
  if (headerError) {
    return NextResponse.json({ error: headerError }, { status: 400 });
  }
  if (records.length === 0) {
    return NextResponse.json({ error: 'No importable rows (each row needs a non-empty name)' }, { status: 400 });
  }
  if (records.length > MAX_ROWS) {
    return NextResponse.json({ error: `At most ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  const linkedAddrs = [...new Set(records.map((r) => r.linkedAddress).filter(Boolean))];
  const listings =
    linkedAddrs.length > 0
      ? await prisma.listing.findMany({
          where: { address: { in: linkedAddrs } },
          select: { id: true, address: true },
        })
      : [];
  const listingIdByAddress = new Map(listings.map((l) => [l.address, l.id]));

  const warnings: string[] = [];
  const data = records.map((rec, idx) => {
    const rowNum = idx + 2;
    let linkedListingId: string | null = null;
    if (rec.linkedAddress) {
      linkedListingId = listingIdByAddress.get(rec.linkedAddress) ?? null;
      if (!linkedListingId) {
        warnings.push(`Row ${rowNum}: no listing with exact address "${rec.linkedAddress}" — saved without link`);
      }
    }
    return {
      name: rec.name,
      role: rec.role,
      company: rec.company,
      email: rec.email,
      phone: rec.phone,
      notes: rec.notes,
      linkedListingId,
    };
  });

  await prisma.partnerContact.createMany({ data });

  return NextResponse.json({
    ok: true,
    created: data.length,
    warnings,
  });
}
