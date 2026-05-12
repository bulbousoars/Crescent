import { describe, it, expect } from 'vitest';
import { parseZillowMessage, classifyZillowEmail } from '../../src/lib/parsers/zillow';
import type { RawMessage } from '../../src/lib/mail/provider';

function makeMessage(overrides: Partial<RawMessage> = {}): RawMessage {
  return {
    providerMsgId: 'gmail-id-1',
    threadId: 'gmail-thread-1',
    fromAddress: 'instant-updates@mail.zillow.com',
    subject: '',
    receivedAt: new Date('2026-05-09T12:00:00Z'),
    textBody: '',
    htmlBody: '',
    snippet: '',
    labels: [],
    ...overrides,
  };
}

describe('classifyZillowEmail', () => {
  it('rejects non-zillow senders', () => {
    expect(classifyZillowEmail(makeMessage({ fromAddress: 'noreply@redfin.com' }))).toBeNull();
  });

  it('rejects allowed-sender mismatch (e.g. marketing@zillow.com)', () => {
    expect(classifyZillowEmail(makeMessage({ fromAddress: 'marketing@mail.zillow.com', subject: 'New listing!' }))).toBeNull();
  });

  it('classifies New Listing alerts', () => {
    const c = classifyZillowEmail(
      makeMessage({ subject: "Your 'Camden Rentals' Search: New listing", textBody: 'New listing in Camden, NJ' }),
    );
    expect(c).not.toBeNull();
    expect(c!.notificationType).toBe('New Listing');
    expect(c!.eventClass).toBe('primary');
    expect(c!.searchName).toBe('Camden Rentals');
  });

  it('classifies Price Cut alerts', () => {
    const c = classifyZillowEmail(
      makeMessage({ subject: 'Price cut on your saved home', textBody: '...reduced by $5,000...' }),
    );
    expect(c).not.toBeNull();
    expect(c!.notificationType).toBe('Price Cut');
  });

  it('classifies Search Results digests', () => {
    const c = classifyZillowEmail(
      makeMessage({ subject: 'Your search results', textBody: 'latest results for your search Camden' }),
    );
    expect(c).not.toBeNull();
    expect(c!.notificationType).toBe('Search Results');
  });
});

describe('parseZillowMessage - single listing', () => {
  it('extracts a single new-listing payload', () => {
    const body = `New Listing in your saved search.

10 Market St, Camden, NJ 08102

$175,000
3 bd | 2 ba | 1,280 sqft

View on Zillow:
https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/

Open House on Saturday.

Privacy policy
Zillow, Inc. 2026`;

    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads.length).toBe(1);
    const p = result!.payloads[0];
    expect(p.zpid).toBe('12345');
    expect(p.listingUrl).toBe('https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/');
    expect(p.address).toBe('10 Market St, Camden, NJ 08102');
    expect(p.city).toBe('Camden');
    expect(p.state).toBe('NJ');
    expect(p.zip).toBe('08102');
    expect(p.price).toBe(175000);
    expect(p.beds).toBe(3);
    expect(p.baths).toBe(2);
    expect(p.sqft).toBe(1280);
    expect(p.notificationType).toBe('New Listing');
    expect(p.gmailMessageId).toBe('gmail-id-1');
  });

  it('prefers the listing price over "Est. payment $/mo" amounts', () => {
    const body = `New listing

10 Market St, Camden, NJ 08102

Est. payment $2,345/mo
$175,000
3 bd | 2 ba | 1,280 sqft

https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/`;
    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads[0].price).toBe(175000);
  });

  it('extracts a price cut amount', () => {
    const body = `Price cut! 10 Market St, Camden, NJ 08102. Reduced by $5,000. Now $170,000. 3 bd 2 ba 1280 sqft.
https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/`;
    const result = parseZillowMessage(makeMessage({ subject: 'Price cut: $5,000', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads[0].priceCut).toBe(5000);
    expect(result!.payloads[0].notificationType).toBe('Price Cut');
  });

  it('rejects a body with no Zillow link', () => {
    const body = `New listing! 10 Market St, Camden, NJ 08102. $175,000. 3 bd 2 ba 1280 sqft.`;
    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads).toEqual([]);
  });

  it('decodes Zillow tracking URLs to homedetails', () => {
    const tracked = 'https://email.mail.zillow.com/c/eJ?target=' + encodeURIComponent('https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/99999_zpid/');
    const body = `New Listing 10 Market St, Camden, NJ 08102 $200,000 3 bd 2 ba 1500 sqft\n${tracked}`;
    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads.length).toBe(1);
    expect(result!.payloads[0].zpid).toBe('99999');
  });

  it('prefers the listing price over "20% down" callouts (e.g. $225k down on a $1.125M home)', () => {
    const body = `New listing

123 Main St, Somewhere, PA 19000

$1,125,000
With 20% down ($225,000)
3 bd | 2 ba | 2,000 sqft

https://www.zillow.com/homedetails/123-Main-St-Somewhere-PA-19000/55555_zpid/`;
    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads[0].price).toBe(1_125_000);
  });

  it('prefers list price beside the address over a higher promo amount earlier in the email', () => {
    const body = `Market spotlight — homes from $225,000 this spring.

456 Oak Rd, Smallville, OH 43125 $153,300 3 bd 2 ba 1100 sqft
https://www.zillow.com/homedetails/456-Oak-Smallville-OH-43125/11111_zpid/`;

    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads[0].price).toBe(153_300);
  });

  it('does not match URL-token gibberish like rtoken=17c54ba6 as 4 baths', () => {
    // Verify the regex hardening: the n8n parser was bumped to require non-word prefix
    // for spec extraction so URL tokens don't pollute beds/baths.
    const body = `New Listing 10 Market St, Camden, NJ 08102 $175,000 3 bd 2 ba 1280 sqft
https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/?rtoken=17c54ba6-abc`;
    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result!.payloads[0].baths).toBe(2);
    expect(result!.payloads[0].beds).toBe(3);
    expect(result!.payloads[0].sqft).toBe(1280);
  });

  it('extracts Zillow email metrics (year built, lot, payments, MLS, days, type, prior price)', () => {
    const body = `New listing

10 Market St, Camden, NJ 08102
Previously listed at $189,900
Single family residence
Year built: 1998
0.15 acres lot
Rent Zestimate: $1,650/mo
Est. payment $1,200/mo
Principal & interest $980/mo
Property taxes $150/mo
Home insurance $70/mo
MLS # NJCD12345
12 days on Zillow

$175,000
3 bd | 2 ba | 1,280 sqft

https://www.zillow.com/homedetails/10-Market-St-Camden-NJ-08102/12345_zpid/`;

    const result = parseZillowMessage(makeMessage({ subject: 'New listing', textBody: body }));
    expect(result).not.toBeNull();
    const p = result!.payloads[0];
    expect(p.price).toBe(175_000);
    expect(p.previousListPrice).toBe(189_900);
    expect(p.yearBuilt).toBe('1998');
    expect(p.lotSize).toContain('0.15');
    expect((p.propertyType ?? '').toLowerCase()).toContain('single');
    expect(p.mlsNumber).toBe('NJCD12345');
    expect(p.daysOnZillow).toBe(12);
    expect(p.rentZestimateMonthly).toBe(1650);
    expect(p.estimatedPaymentMonthly).toBe(1200);
    expect(p.estimatedPAndIMonthly).toBe(980);
    expect(p.estimatedPropertyTaxMonthly).toBe(150);
    expect(p.estimatedInsuranceMonthly).toBe(70);
  });
});

describe('parseZillowMessage - search results digest', () => {
  it('extracts multiple listings and de-dupes by zpid', () => {
    const body = `Latest results for your search 'Camden Rentals'

100 Main St, Camden, NJ 08102 $150,000 2 bd 1 ba 900 sqft
https://www.zillow.com/homedetails/100-Main-St-Camden-NJ-08102/100_zpid/

200 Oak Ave, Camden, NJ 08103 $180,000 3 bd 2 ba 1200 sqft
https://www.zillow.com/homedetails/200-Oak-Ave-Camden-NJ-08103/200_zpid/

100 Main St, Camden, NJ 08102 $150,000 2 bd 1 ba 900 sqft
https://www.zillow.com/homedetails/100-Main-St-Camden-NJ-08102/100_zpid/

Privacy policy
Zillow, Inc.`;

    const result = parseZillowMessage(makeMessage({ subject: "Your 'Camden Rentals' search results", textBody: body }));
    expect(result).not.toBeNull();
    expect(result!.payloads.length).toBe(2);
    const zpids = result!.payloads.map((p) => p.zpid).sort();
    expect(zpids).toEqual(['100', '200']);
  });

  it('cuts off the body at footer markers', () => {
    const body = `Latest results for your search 'Camden Rentals'

100 Main St, Camden, NJ 08102 $150,000 2 bd 1 ba 900 sqft
https://www.zillow.com/homedetails/100-Main-St-Camden-NJ-08102/100_zpid/

Our recommendations for you
999 Junk St, Wherever, ZZ 00000 $999,999 9 bd 9 ba 99999 sqft
https://www.zillow.com/homedetails/junk/999_zpid/

Privacy policy`;

    const result = parseZillowMessage(makeMessage({ subject: 'search results', textBody: body }));
    expect(result!.payloads.length).toBe(1);
    expect(result!.payloads[0].zpid).toBe('100');
  });
});
