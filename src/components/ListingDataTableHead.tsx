import Link from 'next/link';
import type { ListingSortColumn } from '@/lib/listingSort';
import { hrefForSortedColumn } from '@/lib/listingSort';

export type ListingDataQueryParams = Record<string, string | undefined>;

type Col = { id: ListingSortColumn; label: string; title: string };

const COLUMNS: Col[] = [
  { id: 'address', label: 'Full address', title: 'Full street address' },
  { id: 'ingestedAt', label: 'Date Added', title: 'Date listing was ingested' },
  { id: 'status', label: 'Status', title: 'Pipeline status' },
  { id: 'price', label: 'Price', title: 'List price' },
  { id: 'previousListPrice', label: 'Prev. list', title: 'Previous list price' },
  { id: 'state', label: 'State', title: 'State' },
  { id: 'city', label: 'City', title: 'City' },
  { id: 'beds', label: 'Beds', title: 'Bedrooms' },
  { id: 'baths', label: 'Baths', title: 'Bathrooms' },
  { id: 'sqft', label: 'Sq ft', title: 'Square feet' },
  { id: 'yearBuilt', label: 'Year built', title: 'Year built' },
  { id: 'lotSize', label: 'Lot', title: 'Lot size' },
  { id: 'hoaMonthly', label: 'HOA', title: 'Homeowners association dues (monthly)' },
  { id: 'propertyType', label: 'Type', title: 'Property type' },
  { id: 'mlsNumber', label: 'MLS', title: 'MLS listing number' },
  { id: 'daysOnZillow', label: 'Days Z', title: 'Days on Zillow' },
  { id: 'rentZestimateMonthly', label: 'Rent Zest.', title: 'Rent Zestimate (monthly)' },
  { id: 'estimatedPaymentMonthly', label: 'Est. pay', title: 'Estimated total payment (monthly, from Zillow)' },
  { id: 'estimatedPAndIMonthly', label: 'P&I', title: 'Principal and interest (monthly, Zillow estimate)' },
  { id: 'estimatedPropertyTaxMonthly', label: 'Tax', title: 'Property tax (monthly, Zillow estimate)' },
  { id: 'estimatedInsuranceMonthly', label: 'Ins.', title: 'Insurance (monthly, Zillow estimate)' },
  { id: 'rentUsed', label: 'UW rent', title: 'Underwriting rent used (profile-driven)' },
  { id: 'hudFmrSelected', label: 'HUD FMR', title: 'HUD Fair Market Rent (monthly)' },
  { id: 'rentcastEst', label: 'Rentcast', title: 'Rentcast long-term rent estimate (monthly)' },
  { id: 'uwPAndI', label: 'UW P&I', title: 'Underwriting principal and interest (monthly)' },
  { id: 'uwPropertyTax', label: 'UW tax', title: 'Underwriting property tax (monthly)' },
  { id: 'uwInsurance', label: 'UW ins.', title: 'Underwriting insurance (monthly)' },
  { id: 'totalExpensesMonthly', label: 'UW expenses', title: 'Underwriting total monthly expenses' },
  { id: 'monthlyCf', label: 'Monthly CF', title: 'Monthly cash flow' },
  { id: 'capRate', label: 'Cap', title: 'Capitalization rate' },
  { id: 'cashOnCash', label: 'CoC', title: 'Cash-on-cash return' },
  { id: 'noi', label: 'NOI', title: 'Net operating income (annual)' },
  { id: 'downPayment', label: 'Down', title: 'Down payment (list price × profile down-payment %)' },
  { id: 'cashRequired', label: 'Cash in', title: 'Cash required to close (down payment + closing costs)' },
  { id: 'equity5yr', label: '5yr Eq', title: 'Five-year projected equity' },
  { id: 'dscr', label: 'DSCR', title: 'Debt service coverage ratio (monthly NOI ÷ P&I)' },
  { id: 'tag', label: 'Tag', title: 'Underwriting tag: CASH FLOW, EQUITY PLAY, or PASS' },
  { id: 'listingUrl', label: 'Zillow', title: 'Open listing on Zillow' },
];

interface Props {
  params: ListingDataQueryParams;
}

export function ListingDataTableHead({ params }: Props) {
  return (
    <thead>
      <tr>
        {COLUMNS.map((col) => {
          const active = params.sort === col.id;
          const dir = params.sortDir === 'desc' ? 'desc' : 'asc';
          const href = hrefForSortedColumn(params, col.id);
          return (
            <th key={col.id}>
              <Link className="th-sort" href={href} prefetch={false}>
                <abbr title={col.title}>{col.label}</abbr>
                <span className="th-sort-icons" aria-hidden>
                  {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
                </span>
              </Link>
            </th>
          );
        })}
        <th title="Edit listing or open property detail">Actions</th>
      </tr>
    </thead>
  );
}
