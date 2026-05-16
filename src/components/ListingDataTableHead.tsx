import Link from 'next/link';
import type { ListingSortColumn } from '@/lib/listingSort';
import { hrefForSortedColumn } from '@/lib/listingSort';

export type ListingDataQueryParams = Record<string, string | undefined>;

type Col = { id: ListingSortColumn; label: string; title?: string };

const COLUMNS: Col[] = [
  { id: 'address', label: 'Full address' },
  { id: 'ingestedAt', label: 'Date Added' },
  { id: 'status', label: 'Status' },
  { id: 'price', label: 'Price' },
  { id: 'previousListPrice', label: 'Prev. list', title: 'Previous list price' },
  { id: 'state', label: 'State' },
  { id: 'city', label: 'City' },
  { id: 'beds', label: 'Beds' },
  { id: 'baths', label: 'Baths' },
  { id: 'sqft', label: 'Sq ft' },
  { id: 'yearBuilt', label: 'Year built' },
  { id: 'lotSize', label: 'Lot' },
  { id: 'hoaMonthly', label: 'HOA' },
  { id: 'propertyType', label: 'Type' },
  { id: 'mlsNumber', label: 'MLS' },
  { id: 'daysOnZillow', label: 'Days Z' },
  { id: 'rentZestimateMonthly', label: 'Rent Zest.', title: 'Rent Zestimate (monthly)' },
  { id: 'estimatedPaymentMonthly', label: 'Est. pay', title: 'Estimated total payment (monthly)' },
  { id: 'estimatedPAndIMonthly', label: 'P&I' },
  { id: 'estimatedPropertyTaxMonthly', label: 'Tax' },
  { id: 'estimatedInsuranceMonthly', label: 'Ins.' },
  { id: 'rentUsed', label: 'UW rent', title: 'Underwriting rent used' },
  { id: 'hudFmrSelected', label: 'HUD FMR' },
  { id: 'rentcastEst', label: 'Rentcast' },
  { id: 'uwPAndI', label: 'UW P&I', title: 'Underwriting principal & interest' },
  { id: 'uwPropertyTax', label: 'UW tax', title: 'Underwriting property tax (monthly)' },
  { id: 'uwInsurance', label: 'UW ins.', title: 'Underwriting insurance (monthly)' },
  { id: 'totalExpensesMonthly', label: 'UW expenses', title: 'Underwriting total monthly expenses' },
  { id: 'monthlyCf', label: 'Monthly CF', title: 'Monthly cash flow' },
  { id: 'capRate', label: 'Cap' },
  { id: 'cashOnCash', label: 'CoC', title: 'Cash-on-cash return' },
  { id: 'noi', label: 'NOI' },
  { id: 'cashRequired', label: 'Cash in' },
  { id: 'equity5yr', label: '5yr Eq', title: '5-year projected equity' },
  { id: 'dscr', label: 'DSCR' },
  { id: 'tag', label: 'Tag' },
  { id: 'listingUrl', label: 'Zillow' },
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
            <th key={col.id} title={col.title}>
              <Link className="th-sort" href={href} prefetch={false}>
                <span>{col.label}</span>
                <span className="th-sort-icons" aria-hidden>
                  {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
                </span>
              </Link>
            </th>
          );
        })}
        <th>Actions</th>
      </tr>
    </thead>
  );
}
