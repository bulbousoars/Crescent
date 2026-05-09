import { Filter } from 'lucide-react';
import type { ListingFilters } from '@/lib/listingFilters';
import type { RawListingFilters } from '@/lib/listingFilters';

type AssumptionOption = { id: string; name: string; isDefault: boolean };

type Props = {
  action: string;
  raw: RawListingFilters;
  filters: ListingFilters;
  statuses: string[];
  states: string[];
  cities: string[];
  properties: { id: string; address: string; city: string; state: string; zip: string }[];
  assumptions: AssumptionOption[];
  selectedAssumptionId?: string;
  hiddenFields?: Record<string, string | undefined>;
  showAssumptions?: boolean;
};

export function ListingsFilterPanel({
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
}: Props) {
  return (
    <form className="filter-panel" action={action}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}
      <div className="filter-grid">
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
