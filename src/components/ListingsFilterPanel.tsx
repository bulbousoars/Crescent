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
  /** Workspace home: classic grid. Data table: grouped layout with active chips. */
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
      label: `${filters.minBeds}+ beds`,
      href: hrefWithout(action, base, 'minBeds'),
    });
  }
  if (filters.minBaths != null) {
    chips.push({
      key: 'minBaths',
      label: `${filters.minBaths}+ baths`,
      href: hrefWithout(action, base, 'minBaths'),
    });
  }
  if (filters.minSqft != null) {
    chips.push({
      key: 'minSqft',
      label: `${filters.minSqft.toLocaleString()}+ sq ft`,
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

      <div className="filter-panel__head">
        <div className="filter-panel__title-block">
          <h2 className="filter-panel__title">Filters</h2>
          <p className="filter-panel__meta">
            {resultCount != null ? (
              <>
                <strong>{resultCount.toLocaleString()}</strong> listings
                {chips.length > 0 ? (
                  <>
                    {' '}
                    · <span>{chips.length} active</span>
                  </>
                ) : null}
              </>
            ) : (
              'Narrow the table'
            )}
          </p>
        </div>
        <div className="filter-panel__actions">
          <button className="button primary" type="submit">
            <Filter size={16} />
            Apply
          </button>
          <a className="button ghost" href={clearHref}>
            Clear all
          </a>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="filter-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <a key={chip.key} className="filter-chip" href={chip.href} title={`Remove filter: ${chip.label}`}>
              <span>{chip.label}</span>
              <X size={14} aria-hidden />
            </a>
          ))}
        </div>
      ) : null}

      <div className="filter-sections">
        <section className="filter-section">
          <h3 className="filter-section__label">Underwriting</h3>
          <div className="filter-section__grid filter-section__grid--2">
            {showAssumptions ? (
              <label className="control">
                <span>Profile</span>
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
              <span>Pipeline status</span>
              <select className="field" name="status" defaultValue={filters.status ?? ''}>
                <option value="">Any status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="filter-section filter-section--wide">
          <h3 className="filter-section__label">Property</h3>
          <label className="control">
            <span>Focus address</span>
            <select className="field" name="listingId" defaultValue={filters.listingId ?? ''}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address}, {property.city}, {property.state} {property.zip}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="filter-section">
          <h3 className="filter-section__label">Location</h3>
          <div className="filter-section__grid filter-section__grid--2">
            <label className="control">
              <span>State</span>
              <select className="field" name="state" defaultValue={filters.state ?? ''}>
                <option value="">Any</option>
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
                <option value="">Any</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="filter-section">
          <h3 className="filter-section__label">List price</h3>
          <div className="filter-range">
            <label className="control">
              <span>Minimum</span>
              <input
                className="field"
                name="minPrice"
                type="number"
                min={0}
                step={1000}
                placeholder="No min"
                defaultValue={raw.minPrice ?? ''}
              />
            </label>
            <span className="filter-range__sep" aria-hidden>
              –
            </span>
            <label className="control">
              <span>Maximum</span>
              <input
                className="field"
                name="maxPrice"
                type="number"
                min={0}
                step={1000}
                placeholder="No max"
                defaultValue={raw.maxPrice ?? ''}
              />
            </label>
          </div>
        </section>

        <section className="filter-section">
          <h3 className="filter-section__label">Size</h3>
          <div className="filter-section__grid filter-section__grid--3">
            <label className="control">
              <span>Min beds</span>
              <input
                className="field"
                name="minBeds"
                type="number"
                min={0}
                step={0.5}
                placeholder="Any"
                defaultValue={raw.minBeds ?? ''}
              />
            </label>
            <label className="control">
              <span>Min baths</span>
              <input
                className="field"
                name="minBaths"
                type="number"
                min={0}
                step={0.5}
                placeholder="Any"
                defaultValue={raw.minBaths ?? ''}
              />
            </label>
            <label className="control">
              <span>Min sq ft</span>
              <input
                className="field"
                name="minSqft"
                type="number"
                min={0}
                step={50}
                placeholder="Any"
                defaultValue={raw.minSqft ?? ''}
              />
            </label>
          </div>
        </section>
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
