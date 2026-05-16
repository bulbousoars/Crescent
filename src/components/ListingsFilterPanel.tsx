import { X } from 'lucide-react';
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

function pillActive(raw: string | undefined, value: string) {
  const v = raw?.trim() ?? '';
  if (value === '') return v === '';
  return v === value;
}

type PillOption = { value: string; label: string };

function FilterPillRow({
  name,
  legend,
  options,
  rawValue,
}: {
  name: string;
  legend: string;
  options: PillOption[];
  rawValue?: string;
}) {
  return (
    <div className="filter-subblock">
      <div className="filter-subblock__title">{legend}</div>
      <div className="filter-pills" role="radiogroup" aria-label={legend}>
        {options.map((opt) => (
          <label
            key={opt.value || 'any'}
            className={`filter-pill${pillActive(rawValue, opt.value) ? ' filter-pill--on' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={pillActive(rawValue, opt.value)}
              className="filter-pill__input"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

const BED_OPTIONS: PillOption[] = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6+' },
];

const BATH_OPTIONS: PillOption[] = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4+' },
];

const SQFT_OPTIONS: PillOption[] = [
  { value: '', label: 'Any' },
  { value: '800', label: '800+' },
  { value: '1000', label: '1k+' },
  { value: '1200', label: '1.2k+' },
  { value: '1500', label: '1.5k+' },
  { value: '2000', label: '2k+' },
];

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
          Apply filters
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

  const statusOptions: PillOption[] = [
    { value: '', label: 'Any' },
    ...statuses.map((s) => ({ value: s, label: s.replaceAll('_', ' ') })),
  ];

  const showLabel =
    resultCount != null
      ? `Show ${resultCount.toLocaleString()} listing${resultCount === 1 ? '' : 's'}`
      : 'Show listings';

  return (
    <form className="filter-panel filter-panel--data" action={action}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}
      <HiddenSortFields raw={raw} />

      <header className="filter-panel__header">
        <h2 className="filter-panel__title">Filters</h2>
      </header>

      {chips.length > 0 ? (
        <div className="filter-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <a key={chip.key} className="filter-chip" href={chip.href} title={`Remove: ${chip.label}`}>
              <span>{chip.label}</span>
              <X size={14} aria-hidden />
            </a>
          ))}
        </div>
      ) : null}

      <div className="filter-panel__body">
        <section className="filter-block">
          <h3 className="filter-block__title">Price range</h3>
          <p className="filter-block__hint">List price — underwriting columns use the profile below.</p>
          <div className="filter-price-inputs">
            <label className="filter-price-field">
              <span className="filter-price-field__label">Min price</span>
              <input
                className="filter-price-field__input"
                name="minPrice"
                type="number"
                min={0}
                step={1000}
                placeholder="$"
                defaultValue={raw.minPrice ?? ''}
              />
            </label>
            <label className="filter-price-field">
              <span className="filter-price-field__label">Max price</span>
              <input
                className="filter-price-field__input"
                name="maxPrice"
                type="number"
                min={0}
                step={1000}
                placeholder="$"
                defaultValue={raw.maxPrice ?? ''}
              />
            </label>
          </div>
        </section>

        <FilterPillRow
          name="status"
          legend="Pipeline status"
          options={statusOptions}
          rawValue={raw.status}
        />

        {showAssumptions ? (
          <section className="filter-block">
            <h3 className="filter-block__title">Underwriting profile</h3>
            <p className="filter-block__hint">Drives rent, expenses, and cash-flow columns in the table.</p>
            <div className="filter-cards">
              {assumptions.length === 0 ? (
                <label
                  className={`filter-card${!selectedAssumptionId || selectedAssumptionId === 'default' ? ' filter-card--on' : ''}`}
                >
                  <input
                    type="radio"
                    name="assumptionId"
                    value="default"
                    defaultChecked={!selectedAssumptionId || selectedAssumptionId === 'default'}
                    className="filter-card__input"
                  />
                  <span className="filter-card__title">Default underwriting</span>
                  <span className="filter-card__desc">Built-in assumption set</span>
                </label>
              ) : null}
              {assumptions.map((item) => (
                <label
                  key={item.id}
                  className={`filter-card${selectedAssumptionId === item.id ? ' filter-card--on' : ''}`}
                >
                  <input
                    type="radio"
                    name="assumptionId"
                    value={item.id}
                    defaultChecked={selectedAssumptionId === item.id}
                    className="filter-card__input"
                  />
                  <span className="filter-card__title">{item.name}</span>
                  <span className="filter-card__desc">
                    {item.isDefault ? 'Default profile' : 'Custom profile'}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className="filter-block">
          <h3 className="filter-block__title">Focus property</h3>
          <select className="filter-select" name="listingId" defaultValue={filters.listingId ?? ''}>
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.address}, {property.city}, {property.state} {property.zip}
              </option>
            ))}
          </select>
        </section>

        <section className="filter-block">
          <h3 className="filter-block__title">Location</h3>
          <div className="filter-price-inputs">
            <label className="filter-price-field">
              <span className="filter-price-field__label">State</span>
              <select className="filter-select" name="state" defaultValue={filters.state ?? ''}>
                <option value="">Any</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-price-field">
              <span className="filter-price-field__label">City</span>
              <select className="filter-select" name="city" defaultValue={filters.city ?? ''}>
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

        <section className="filter-block filter-block--group">
          <h3 className="filter-block__title">Rooms and size</h3>
          <FilterPillRow name="minBeds" legend="Bedrooms" options={BED_OPTIONS} rawValue={raw.minBeds} />
          <FilterPillRow name="minBaths" legend="Bathrooms" options={BATH_OPTIONS} rawValue={raw.minBaths} />
          <FilterPillRow name="minSqft" legend="Square feet" options={SQFT_OPTIONS} rawValue={raw.minSqft} />
        </section>
      </div>

      <footer className="filter-panel__footer">
        <a className="filter-panel__clear" href={clearHref}>
          Clear all
        </a>
        <button className="filter-panel__submit" type="submit">
          {showLabel}
        </button>
      </footer>
    </form>
  );
}

export function ListingsFilterPanel(props: Props) {
  if (props.variant === 'data') {
    return <DataFilterForm {...props} />;
  }
  return <WorkspaceFilterForm {...props} />;
}
