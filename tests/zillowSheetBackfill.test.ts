import { describe, expect, it } from 'vitest';
import { mapZillowSheetRow } from '@/lib/zillowSheetBackfill';

describe('mapZillowSheetRow', () => {
  it('maps a Listings_Input row into a Zillow ingestion payload', () => {
    const result = mapZillowSheetRow({
      DateReceived: '2026-04-20',
      WorkflowRunId: 'run-123',
      SearchName: 'Texas rentals',
      NotificationType: 'New Listing',
      ListingId: 'listing-123',
      Zpid: '123456',
      ListingUrl: 'https://www.zillow.com/homedetails/123456_zpid/',
      Address: '25 Main St, Dallas, TX 75201',
      City: 'Dallas',
      State: 'tx',
      Zip: '75201',
      Price: '$175,000',
      PriceCut: '$5,000',
      Beds: '3',
      Baths: '2.5',
      Sqft: '1,450',
      HOA_Monthly: '$125',
      YearBuilt: '1985',
      LotSize: '0.18 acres',
      HUD_FMR_Selected: '$1,850',
      HUD_Metro: 'Dallas, TX HUD Metro FMR Area',
      Zillow_Zestimate: '$1,900',
      MeetsSpecs: 'Y',
      CriteriaFailReasons: '',
      RentSourceUsed: 'HUD FMR',
      RentUsed: '$1,850',
      Tag: 'PASS',
      PAndI: '$931',
      PropTax_Mo: '$220',
      Insurance_Mo: '$88',
      TotalExpenses_Mo: '$1,470',
      MonthlyCF: '$380',
      AnnualCF: '$4,560',
      AfterTaxCF: '$342',
      NOI: '$15,000',
      CapRate: '8.57%',
      CashOnCash: '7.3%',
      CashRequired: '$62,500',
      Equity_5yr: '$42,000',
      Rentcast_Est: '$1,875',
      Rentcast_Low: '$1,700',
      Rentcast_High: '$2,000',
      Rentcast_MonthlyCF: '$405',
      Rentcast_Confirms: 'TRUE',
    }, 2);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.payload).toMatchObject({
      zpid: '123456',
      listingId: 'listing-123',
      listingUrl: 'https://www.zillow.com/homedetails/123456_zpid/',
      address: '25 Main St, Dallas, TX 75201',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      price: 175000,
      priceCut: 5000,
      beds: 3,
      baths: 2.5,
      sqft: 1450,
      hoa: 125,
      rent: 1850,
      rentSource: 'HUD FMR',
      hud_fmr_selected: 1850,
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
      afterTaxCF: 342,
      noi: 15000,
      capRate: 0.0857,
      coc: 0.073,
      cashReq: 62500,
      equity5: 42000,
      meetsSpecs: 'Y',
      criteriaFailReasons: '',
      tag: 'PASS',
    });
    expect(result.payload.rawPayload).toMatchObject({
      sheetRowNumber: 2,
      source: 'google_sheets_backfill',
    });
  });

  it('skips rows without the required listing identity fields', () => {
    const result = mapZillowSheetRow({
      Address: '25 Main St, Dallas, TX 75201',
      City: 'Dallas',
      State: 'TX',
      Zip: '75201',
      Price: '$175,000',
    }, 7);

    expect(result).toEqual({
      ok: false,
      rowNumber: 7,
      reason: 'Missing ListingUrl',
    });
  });

  it('allows sparse historical sheet rows without ZIP codes', () => {
    const result = mapZillowSheetRow({
      ListingUrl: 'https://www.zillow.com/homedetails/9366766_zpid/',
      Address: '950 Taylor Dr, Folcroft, PA',
      City: 'Folcroft',
      State: 'PA',
      Price: 205000,
      Zpid: '9366766',
    }, 3);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.payload.zip).toBe('');
    expect(result.payload).not.toHaveProperty('beds');
    expect(result.payload).not.toHaveProperty('baths');
    expect(result.payload).not.toHaveProperty('sqft');
    expect(result.payload).not.toHaveProperty('hoaMonthly');
  });
});
