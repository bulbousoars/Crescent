import type { ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import type { ListingFilters, RawListingFilters } from '@/lib/listingFilters';
import { listingFilterHref } from '@/lib/listingSort';

type AssumptionOption = { id: string; name: string; isDefault: boolean };

type Props = {
  action: string;
  raw: RawListingFilters & { assumptionId?: string };
  filters: ListingFilters;
  statuses: string[];
  states: string[];
  cities: string[];
  properties: { id: string; address: string; city: string; state: string; zip: string }[];
  assumptions: AssumptionOption[];
  selectedAssumptionId?: string;
  hiddenFields?: Record<string, string | undefined>;
  showAssumptions?: boolean;
  variant?: 'workspace' | 'data';
  resultCount?: number;
};

function toQueryRecord(raw: Props['raw'], hiddenFields?: Props['hiddenFields']) {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  if (hiddenFields) {
    for (const [k, v] of Object.entries(hiddenFields)) {
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
  }
  return out;
}

function hrefWithout(
  action: string,
  base: Record<string, string | undefined>,
  omit: string,
): string {
  const next = { ...base };
  delete next[omit];
  return listingFilterHref(action, next, {});
}

type ActiveChip = { key: string; label: string; href: string };

function buildActiveChips(
  action: string,
  base: Record<string, string | undefined>,
  filters: ListingFilters,
  raw: Props['raw'],
  properties: Props['properties'],
  assumptions: AssumptionOption[],
  selectedAssumptionId?: string,
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const defaultAssumption =
    assumptions.find((a) => a.isDefault)?.id ?? assumptions[0]?.id;

  if (filters.listingId) {
    const p = properties.find((x) => x.id === filters.listingId);
    chips.push({
      key: 'listingId',
      label: p ? p.address : 'One property',
      href: hrefWithout(action, base, 'listingId'),
    });
  }
  if (raw.assumptionId && raw.assumptionId !== defaultAssumption) {
    const name = assumptions.find((a) => a.id === raw.assumptionId)?.name ?? 'Profile';
    chips.push({
      key: 'assumptionId',
      label: name,
      href: hrefWithout(action, base, 'assumptionId'),
    });
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label: filters.status.replaceAll('_', ' '),
      href: hrefWithout(action, base, 'status'),
    });
  }
  if (filters.state) {
    chips.push({ key: 'state', label: filters.state, href: hrefWithout(action, base, 'state') });
  }
  if (filters.city) {
    chips.push({ key: 'city', label: filters.city, href: hrefWithout(action, base, 'city') });
  }
  if (filters.minPrice != null) {
    chips.push({
      key: 'minPrice',
      label: `Min $${filters.minPrice.toLocaleString()}`,
      href: hrefWithout(action, base, 'minPrice'),
    });
  }
  if (filters.maxPrice != null) {
    chips.push({
      key: 'maxPrice',
      label: `Max $${filters.maxPrice.toLocaleString()}`,
      href: hrefWithout(action, base, 'maxPrice'),
    });
  }
  if (filters.minBeds != null) {
    chips.push({
      key: 'minBeds',
      label: `${filters.minBeds}+ bd`,
      href: hrefWithout(action, base, 'minBeds'),
    });
  }
  if (filters.minBaths != null) {
    chips.push({
      key: 'minBaths',
      label: `${filters.minBaths}+ ba`,
      href: hrefWithout(action, base, 'minBaths'),
    });
  }
  if (filters.minSqft != null) {
    chips.push({
      key: 'minSqft',
      label: `${filters.minSqft.toLocaleString()}+ sf`,
      href: hrefWithout(action, base, 'minSqft'),
    });
  }
  return chips;
}

function HiddenSortFields({ raw }: { raw: RawListingFilters }) {
  return (
    <>
      {raw.sort ? <input type="hidden" name="sort" value={raw.sort} /> : null}
      {raw.sort ? <input type="hidden" name="sortDir" value={raw.sortDir === 'desc' ? 'desc' : 'asc'} /> : null}
    </>
  );
}

function CompactField({
  label,
  children,
  wide,
  narrow,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  narrow?: boolean;
}) {
  return (
    <label
      className={[
        'filter-compact__field',
        wide ? 'filter-compact__field--wide' : '',
        narrow ? 'filter-compact__field--narrow' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="filter-compact__label">{label}</span>
      {children}
    </label>
  );
}

function WorkspaceFilterForm({
  action,
  raw,
  filters,
  statuses,
  states,
  cities,
  properties,
  assumptions,
  selectedAssumptionId,
  hiddenFields,
  showAssumptions,
}: Props) {
  return (
    <form className="filter-panel" action={action}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}
      <div className="filter-grid">
        <HiddenSortFields raw={raw} />
        <label className="control wide">
          <span>Property address</span>
          <select className="field" name="listingId" defaultValue={filters.listingId ?? ''}>
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.address}, {property.city}, {property.state} {property.zip}
              </option>
            ))}
          </select>
        </label>
        {showAssumptions ? (
          <label className="control">
            <span>Assumptions</span>
            <select className="field" name="assumptionId" defaultValue={selectedAssumptionId ?? ''}>
              {assumptions.length === 0 ? <option value="default">Default underwriting</option> : null}
              {assumptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="control">
          <span>Status</span>
          <select className="field" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>State</span>
          <select className="field" name="state" defaultValue={filters.state ?? ''}>
            <option value="">Any state</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>City</span>
          <select className="field" name="city" defaultValue={filters.city ?? ''}>
            <option value="">Any city</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>Min price</span>
          <input className="field" name="minPrice" type="number" defaultValue={raw.minPrice ?? ''} />
        </label>
        <label className="control">
          <span>Max price</span>
          <input className="field" name="maxPrice" type="number" defaultValue={raw.maxPrice ?? ''} />
        </label>
        <label className="control">
          <span>Bedrooms</span>
          <input className="field" name="minBeds" type="number" step="0.5" defaultValue={raw.minBeds ?? ''} />
        </label>
        <label className="control">
          <span>Bathrooms</span>
          <input className="field" name="minBaths" type="number" step="0.5" defaultValue={raw.minBaths ?? ''} />
        </label>
        <label className="control">
          <span>Min sq ft</span>
          <input className="field" name="minSqft" type="number" defaultValue={raw.minSqft ?? ''} />
        </label>
      </div>
      <div className="toolbar">
        <button className="button primary" type="submit">
          <Filter size={16} /> Apply filters
        </button>
        <a className="button" href={action}>
          Clear
        </a>
      </div>
    </form>
  );
}

function DataFilterForm(props: Props) {
  const {
    action,
    raw,
    filters,
    statuses,
    states,
    cities,
    properties,
    assumptions,
    selectedAssumptionId,
    hiddenFields,
    showAssumptions = true,
    resultCount,
  } = props;
  const base = toQueryRecord(raw, hiddenFields);
  const chips = buildActiveChips(
    action,
    base,
    filters,
    raw,
    properties,
    assumptions,
    selectedAssumptionId,
  );
  const clearHref = hiddenFields?.tab
    ? listingFilterHref(action, { tab: hiddenFields.tab }, {})
    : action;

  return (
    <form className="filter-panel filter-panel--data" action={action}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}
      <HiddenSortFields raw={raw} />

      <div className="filter-compact">
        <div className="filter-compact__row">
          {showAssumptions ? (
            <CompactField label="Profile">
              <select className="filter-compact__input" name="assumptionId" defaultValue={selectedAssumptionId ?? ''}>
                {assumptions.length === 0 ? <option value="default">Default</option> : null}
                {assumptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.isDefault ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </CompactField>
          ) : null}
          <CompactField label="Status">
            <select className="filter-compact__input" name="status" defaultValue={filters.status ?? ''}>
              <option value="">Any</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </CompactField>
          <CompactField label="State">
            <select className="filter-compact__input" name="state" defaultValue={filters.state ?? ''}>
              <option value="">Any</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </CompactField>
          <CompactField label="City">
            <select className="filter-compact__input" name="city" defaultValue={filters.city ?? ''}>
              <option value="">Any</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </CompactField>
          <CompactField label="Min $" narrow>
            <input
              className="filter-compact__input"
              name="minPrice"
              type="number"
              min={0}
              step={1000}
              placeholder="—"
              defaultValue={raw.minPrice ?? ''}
            />
          </CompactField>
          <CompactField label="Max $" narrow>
            <input
              className="filter-compact__input"
              name="maxPrice"
              type="number"
              min={0}
              step={1000}
              placeholder="—"
              defaultValue={raw.maxPrice ?? ''}
            />
          </CompactField>
          <CompactField label="Beds" narrow>
            <input
              className="filter-compact__input"
              name="minBeds"
              type="number"
              min={0}
              step={0.5}
              placeholder="—"
              defaultValue={raw.minBeds ?? ''}
            />
          </CompactField>
          <CompactField label="Baths" narrow>
            <input
              className="filter-compact__input"
              name="minBaths"
              type="number"
              min={0}
              step={0.5}
              placeholder="—"
              defaultValue={raw.minBaths ?? ''}
            />
          </CompactField>
          <CompactField label="Sq ft" narrow>
            <input
              className="filter-compact__input"
              name="minSqft"
              type="number"
              min={0}
              step={50}
              placeholder="—"
              defaultValue={raw.minSqft ?? ''}
            />
          </CompactField>
          <div className="filter-compact__actions">
            <button className="button primary filter-compact__btn" type="submit" title="Apply filters">
              <Filter size={15} />
              Apply
            </button>
            <a className="button ghost filter-compact__btn" href={clearHref}>
              Clear
            </a>
          </div>
        </div>

        <div className="filter-compact__row filter-compact__row--secondary">
          <CompactField label="Property" wide>
            <select className="filter-compact__input" name="listingId" defaultValue={filters.listingId ?? ''}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address}, {property.city}, {property.state} {property.zip}
                </option>
              ))}
            </select>
          </CompactField>
          {resultCount != null ? (
            <span className="filter-compact__count muted">
              {resultCount.toLocaleString()} listing{resultCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {chips.length > 0 ? (
          <div className="filter-chips filter-chips--compact" aria-label="Active filters">
            {chips.map((chip) => (
              <a key={chip.key} className="filter-chip" href={chip.href} title={`Remove: ${chip.label}`}>
                <span>{chip.label}</span>
                <X size={12} aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </form>
  );
}

export function ListingsFilterPanel(props: Props) {
  if (props.variant === 'data') {
    return <DataFilterForm {...props} />;
  }
  return <WorkspaceFilterForm {...props} />;
}
