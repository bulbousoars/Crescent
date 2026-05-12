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
  { id: 'state', label: 'State' },
  { id: 'city', label: 'City' },
  { id: 'beds', label: 'Beds' },
  { id: 'baths', label: 'Baths' },
  { id: 'sqft', label: 'Sq ft' },
  { id: 'hoaMonthly', label: 'HOA' },
  { id: 'monthlyCf', label: 'Monthly CF', title: 'Monthly cash flow' },
  { id: 'capRate', label: 'Cap' },
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