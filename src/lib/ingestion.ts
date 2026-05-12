import { z } from 'zod';

export const zillowIngestionSchema = z.object({
  zpid: z.string().optional().default(''),
  listingId: z.string().optional().default(''),
  listingUrl: z.string().url(),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zip: z.string().optional().default(''),
  price: z.number().int().nonnegative(),
  priceCut: z.number().int().nonnegative().optional().default(0),
  beds: z.number().nonnegative().optional().default(0),
  baths: z.number().nonnegative().optional().default(0),
  sqft: z.number().int().nonnegative().optional().default(0),
  hoa: z.number().int().nonnegative().optional().default(0),
  hoaMonthly: z.number().int().nonnegative().optional(),
  yearBuilt: z.string().optional().default(''),
  lotSize: z.string().optional().default(''),
  rentZestimateMonthly: z.number().int().nonnegative().nullable().optional(),
  estimatedPaymentMonthly: z.number().int().nonnegative().nullable().optional(),
  estimatedPAndIMonthly: z.number().int().nonnegative().nullable().optional(),
  estimatedPropertyTaxMonthly: z.number().int().nonnegative().nullable().optional(),
  estimatedInsuranceMonthly: z.number().int().nonnegative().nullable().optional(),
  previousListPrice: z.number().int().nonnegative().nullable().optional(),
  propertyType: z.string().optional().default(''),
  mlsNumber: z.string().optional().default(''),
  daysOnZillow: z.number().int().nonnegative().nullable().optional(),
  notificationType: z.string().optional().default('Unknown'),
  searchName: z.string().optional().default(''),
  gmailMessageId: z.string().optional().default(''),
  gmailThreadId: z.string().optional().default(''),
  hud_fmr_selected: z.number().int().nonnegative().optional().default(0),
  hud_metro: z.string().optional().default(''),
  zillow_rent_zestimate: z.number().int().nonnegative().optional().default(0),
  rentcast_est: z.number().int().nonnegative().optional().default(0),
  rentcast_low: z.number().int().nonnegative().optional().default(0),
  rentcast_high: z.number().int().nonnegative().optional().default(0),
  rent: z.number().int().nonnegative().optional().default(0),
  rentSource: z.string().optional().default(''),
  pAndI: z.number().int().nonnegative().optional().default(0),
  taxMo: z.number().int().nonnegative().optional().default(0),
  insMo: z.number().int().nonnegative().optional().default(0),
  totalExp: z.number().int().nonnegative().optional().default(0),
  monthlyCF: z.number().int().optional().default(0),
  annualCF: z.number().int().optional().default(0),
  afterTaxCF: z.number().int().optional().default(0),
  noi: z.number().int().optional().default(0),
  capRate: z.number().optional().default(0),
  coc: z.number().optional().default(0),
  cashReq: z.number().int().nonnegative().optional().default(0),
  equity5: z.number().int().optional().default(0),
  tag: z.string().optional().default(''),
  meetsSpecs: z.union([z.string(), z.boolean()]).optional().default(''),
  criteriaFailReasons: z.string().optional().default(''),
  rawPayload: z.unknown().optional(),
});

export type ZillowIngestionPayload = z.input<typeof zillowIngestionSchema>;
type ParsedZillowIngestionPayload = z.infer<typeof zillowIngestionSchema>;

type IngestionDb = {
  listing: {
    findUnique(args: unknown): Promise<{ id: string; price: number; priceCut: number } | null>;
    upsert(args: unknown): Promise<{ id: string; zpid: string | null }>;
  };
  listingPipeline: {
    upsert(args: unknown): Promise<unknown>;
  };
  listingEvent: {
    create(args: unknown): Promise<unknown>;
  };
  listingPriceHistory: {
    create(args: unknown): Promise<unknown>;
  };
  listingAnalysis: {
    create(args: unknown): Promise<unknown>;
  };
  workflowRun: {
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
};

const analysisKeys = [
  'rent',
  'monthlyCF',
  'annualCF',
  'afterTaxCF',
  'noi',
  'capRate',
  'coc',
  'cashReq',
  'equity5',
] as const;

function hasAnalysisFields(rawPayload: ZillowIngestionPayload) {
  return analysisKeys.some((key) => Object.prototype.hasOwnProperty.call(rawPayload, key));
}

function isCriteriaPass(value: string | boolean) {
  if (typeof value === 'boolean') return value;
  return ['Y', 'YES', 'TRUE', 'PASS'].includes(value.trim().toUpperCase());
}

function hasOwnField(value: unknown, key: string) {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));
}

export async function ingestZillowEmail(db: IngestionDb, rawPayload: ZillowIngestionPayload) {
  const payload: ParsedZillowIngestionPayload = zillowIngestionSchema.parse(rawPayload);
  const workflowRun = await db.workflowRun.create({
    data: {
      type: 'ZILLOW_EMAIL_INGESTION',
      status: 'STARTED',
      payloadJson: payload,
    },
  });

  try {
    const hoaMonthly = payload.hoaMonthly ?? payload.hoa ?? 0;
    const externalListingId = payload.listingId || payload.zpid || payload.listingUrl;
    const specUpdateData = {
      ...(hasOwnField(rawPayload, 'beds') ? { beds: payload.beds } : {}),
      ...(hasOwnField(rawPayload, 'baths') ? { baths: payload.baths } : {}),
      ...(hasOwnField(rawPayload, 'sqft') ? { sqft: payload.sqft } : {}),
      ...(hasOwnField(rawPayload, 'hoaMonthly') || hasOwnField(rawPayload, 'hoa') ? { hoaMonthly } : {}),
      ...(hasOwnField(rawPayload, 'yearBuilt') ? { yearBuilt: payload.yearBuilt } : {}),
      ...(hasOwnField(rawPayload, 'lotSize') ? { lotSize: payload.lotSize } : {}),
    };
    const priorListing = await db.listing.findUnique({
      where: payload.zpid ? { zpid: payload.zpid } : { listingUrl: payload.listingUrl },
      select: { id: true, price: true, priceCut: true },
    });

    const listing = await db.listing.upsert({
      where: payload.zpid ? { zpid: payload.zpid } : { listingUrl: payload.listingUrl },
      create: {
        externalSource: 'zillow_email',
        externalListingId,
        zpid: payload.zpid || null,
        listingUrl: payload.listingUrl,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        price: payload.price,
        priceCut: payload.priceCut,
        notificationType: payload.notificationType,
        searchName: payload.searchName,
        sourceMessageId: payload.gmailMessageId,
        sourceThreadId: payload.gmailThreadId,
        rawPayloadJson: payload.rawPayload ?? payload,
        beds: payload.beds,
        baths: payload.baths,
        sqft: payload.sqft,
        hoaMonthly,
        yearBuilt: payload.yearBuilt,
        lotSize: payload.lotSize,
        rentZestimateMonthly: payload.rentZestimateMonthly ?? null,
        estimatedPaymentMonthly: payload.estimatedPaymentMonthly ?? null,
        estimatedPAndIMonthly: payload.estimatedPAndIMonthly ?? null,
        estimatedPropertyTaxMonthly: payload.estimatedPropertyTaxMonthly ?? null,
        estimatedInsuranceMonthly: payload.estimatedInsuranceMonthly ?? null,
        previousListPrice: payload.previousListPrice ?? null,
        propertyType: payload.propertyType ?? '',
        mlsNumber: payload.mlsNumber ?? '',
        daysOnZillow: payload.daysOnZillow ?? null,
      },
      update: {
        externalListingId,
        listingUrl: payload.listingUrl,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        price: payload.price,
        priceCut: payload.priceCut,
        notificationType: payload.notificationType,
        searchName: payload.searchName,
        sourceMessageId: payload.gmailMessageId,
        sourceThreadId: payload.gmailThreadId,
        rawPayloadJson: payload.rawPayload ?? payload,
        ...specUpdateData,
        rentZestimateMonthly: payload.rentZestimateMonthly ?? null,
        estimatedPaymentMonthly: payload.estimatedPaymentMonthly ?? null,
        estimatedPAndIMonthly: payload.estimatedPAndIMonthly ?? null,
        estimatedPropertyTaxMonthly: payload.estimatedPropertyTaxMonthly ?? null,
        estimatedInsuranceMonthly: payload.estimatedInsuranceMonthly ?? null,
        previousListPrice: payload.previousListPrice ?? null,
        propertyType: payload.propertyType ?? '',
        mlsNumber: payload.mlsNumber ?? '',
        daysOnZillow: payload.daysOnZillow ?? null,
      },
    });

    await db.listingPipeline.upsert({
      where: { listingId: listing.id },
      create: {
        listingId: listing.id,
        status: 'NEW',
      },
      update: {},
    });

    const priceChanged = !priorListing
      || priorListing.price !== payload.price
      || priorListing.priceCut !== payload.priceCut;

    if (priceChanged) {
      await db.listingPriceHistory.create({
        data: {
          listingId: listing.id,
          price: payload.price,
          priceCut: payload.priceCut,
          source: priorListing ? 'ingest' : 'initial',
        },
      });
      await db.listingEvent.create({
        data: {
          listingId: listing.id,
          eventType: priorListing ? 'PRICE_CHANGE' : 'PRICE_INITIAL',
          eventPayloadJson: priorListing
            ? {
                fromPrice: priorListing.price,
                toPrice: payload.price,
                fromPriceCut: priorListing.priceCut,
                toPriceCut: payload.priceCut,
              }
            : { price: payload.price, priceCut: payload.priceCut },
        },
      });
    }

    if (hasAnalysisFields(rawPayload)) {
      await db.listingAnalysis.create({
        data: {
          listingId: listing.id,
          rentUsed: payload.rent,
          rentSource: payload.rentSource,
          hudFmrSelected: payload.hud_fmr_selected,
          hudMetro: payload.hud_metro,
          zillowZestimate: payload.zillow_rent_zestimate,
          rentcastEst: payload.rentcast_est,
          rentcastLow: payload.rentcast_low,
          rentcastHigh: payload.rentcast_high,
          pAndI: payload.pAndI,
          propertyTaxMonthly: payload.taxMo,
          insuranceMonthly: payload.insMo,
          totalExpensesMonthly: payload.totalExp,
          monthlyCf: payload.monthlyCF,
          annualCf: payload.annualCF,
          afterTaxCf: payload.afterTaxCF,
          noi: payload.noi,
          capRate: payload.capRate,
          cashOnCash: payload.coc,
          cashRequired: payload.cashReq,
          equity5yr: payload.equity5,
          tag: payload.tag,
          criteriaPass: isCriteriaPass(payload.meetsSpecs),
          criteriaFailReasons: payload.criteriaFailReasons,
        },
      });
    }

    await db.listingEvent.create({
      data: {
        listingId: listing.id,
        eventType: 'INGESTED_FROM_ZILLOW_EMAIL',
        eventPayloadJson: {
          gmailMessageId: payload.gmailMessageId,
          notificationType: payload.notificationType,
          workflowRunId: workflowRun.id,
        },
      },
    });

    await db.workflowRun.update({
      where: { id: workflowRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        resultJson: { listingId: listing.id },
      },
    });

    return { ok: true, listingId: listing.id };
  } catch (error) {
    await db.workflowRun.update({
      where: { id: workflowRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        resultJson: {
          error: error instanceof Error ? error.message : 'Unknown ingestion error',
        },
      },
    });
    throw error;
  }
}
