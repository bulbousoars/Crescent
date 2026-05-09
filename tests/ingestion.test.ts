import { describe, expect, it, vi } from 'vitest';
import { ingestZillowEmail } from '@/lib/ingestion';

describe('ingestZillowEmail', () => {
  it('upserts a Zillow listing, creates pipeline state, and records an event', async () => {
    const db = {
      listing: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'listing-1', zpid: '12345' }),
      },
      listingPipeline: {
        upsert: vi.fn().mockResolvedValue({ id: 'pipeline-1', status: 'NEW' }),
      },
      listingEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      listingPriceHistory: {
        create: vi.fn().mockResolvedValue({ id: 'price-1' }),
      },
      listingAnalysis: {
        create: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
      },
      workflowRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update: vi.fn().mockResolvedValue({ id: 'run-1', status: 'COMPLETED' }),
      },
    };

    const result = await ingestZillowEmail(db, {
      zpid: '12345',
      listingUrl: 'https://www.zillow.com/homedetails/12345_zpid/',
      address: '10 Market St, Camden, NJ 08102',
      city: 'Camden',
      state: 'NJ',
      zip: '08102',
      price: 175000,
      priceCut: 0,
      beds: 3,
      baths: 2,
      sqft: 1200,
      hoa: 0,
      yearBuilt: '',
      lotSize: '',
      listingId: '12345',
      notificationType: 'New Listing',
      searchName: 'South Jersey rentals',
      gmailMessageId: 'msg-1',
      gmailThreadId: 'thread-1',
      rawPayload: { source: 'test' },
    });

    expect(result.ok).toBe(true);
    expect(result.listingId).toBe('listing-1');
    expect(db.listing.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { zpid: '12345' },
    }));
    expect(db.listingPipeline.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'NEW' }),
    }));
    expect(db.listingEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'INGESTED_FROM_ZILLOW_EMAIL' }),
    }));
  });

  it('persists n8n financial analysis fields when present', async () => {
    const db = {
      listing: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'listing-1', zpid: '12345' }),
      },
      listingPipeline: {
        upsert: vi.fn().mockResolvedValue({ id: 'pipeline-1', status: 'NEW' }),
      },
      listingEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      listingPriceHistory: {
        create: vi.fn().mockResolvedValue({ id: 'price-1' }),
      },
      listingAnalysis: {
        create: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
      },
      workflowRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update: vi.fn().mockResolvedValue({ id: 'run-1', status: 'COMPLETED' }),
      },
    };

    await ingestZillowEmail(db, {
      zpid: '12345',
      listingUrl: 'https://www.zillow.com/homedetails/12345_zpid/',
      address: '10 Market St, Camden, NJ 08102',
      city: 'Camden',
      state: 'NJ',
      zip: '08102',
      price: 175000,
      beds: 3,
      baths: 2,
      sqft: 1200,
      rent: 1850,
      rentSource: 'HUD FMR',
      hud_fmr_selected: 1800,
      hud_metro: 'Philadelphia-Camden-Wilmington',
      zillow_rent_zestimate: 1900,
      rentcast_est: 1875,
      rentcast_low: 1700,
      rentcast_high: 2000,
      pAndI: 931,
      taxMo: 220,
      insMo: 88,
      totalExp: 1470,
      monthlyCF: 380,
      annualCF: 4560,
      afterTaxCF: 3420,
      noi: 15000,
      capRate: 0.0857,
      coc: 0.073,
      cashReq: 62500,
      equity5: 42000,
      tag: 'PASS',
      meetsSpecs: 'Y',
      criteriaFailReasons: '',
    });

    expect(db.listingAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: 'listing-1',
        rentUsed: 1850,
        rentSource: 'HUD FMR',
        hudFmrSelected: 1800,
        hudMetro: 'Philadelphia-Camden-Wilmington',
        zillowZestimate: 1900,
        rentcastEst: 1875,
        rentcastLow: 1700,
        rentcastHigh: 2000,
        pAndI: 931,
        propertyTaxMonthly: 220,
        insuranceMonthly: 88,
        totalExpensesMonthly: 1470,
        monthlyCf: 380,
        annualCf: 4560,
        afterTaxCf: 3420,
        noi: 15000,
        capRate: 0.0857,
        cashOnCash: 0.073,
        cashRequired: 62500,
        equity5yr: 42000,
        tag: 'PASS',
        criteriaPass: true,
        criteriaFailReasons: '',
      }),
    });
  });

  it('does not overwrite existing home specs when a sparse payload omits them', async () => {
    const db = {
      listing: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'listing-1', zpid: '12345' }),
      },
      listingPipeline: {
        upsert: vi.fn().mockResolvedValue({ id: 'pipeline-1', status: 'NEW' }),
      },
      listingEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      listingPriceHistory: {
        create: vi.fn().mockResolvedValue({ id: 'price-1' }),
      },
      listingAnalysis: {
        create: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
      },
      workflowRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update: vi.fn().mockResolvedValue({ id: 'run-1', status: 'COMPLETED' }),
      },
    };

    await ingestZillowEmail(db, {
      zpid: '12345',
      listingUrl: 'https://www.zillow.com/homedetails/12345_zpid/',
      address: '10 Market St, Camden, NJ',
      city: 'Camden',
      state: 'NJ',
      price: 175000,
      listingId: '12345',
      notificationType: 'Backfill',
    });

    const upsertArgs = db.listing.upsert.mock.calls[0][0];
    expect(upsertArgs.create).toMatchObject({
      beds: 0,
      baths: 0,
      sqft: 0,
      hoaMonthly: 0,
    });
    expect(upsertArgs.update).not.toHaveProperty('beds');
    expect(upsertArgs.update).not.toHaveProperty('baths');
    expect(upsertArgs.update).not.toHaveProperty('sqft');
    expect(upsertArgs.update).not.toHaveProperty('hoaMonthly');
    expect(upsertArgs.update).not.toHaveProperty('yearBuilt');
    expect(upsertArgs.update).not.toHaveProperty('lotSize');
  });
});
