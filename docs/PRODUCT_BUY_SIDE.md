# Crescent — buy-side product direction

This document captures product positioning and feature intent for Crescent: **individual, buy-side deal evaluation** — not agent lead-gen, not community/social, not a curated vendor marketplace.

Sources of inspiration are selective: **BiggerPockets-style deal math and market context** are in scope; **Propertybase-style CRM** is mostly out of scope except **report shapes** that can inform dashboards (Crescent already has acquisition dashboards; the gap is often scenario overlays and acquisition-funnel analytics).

---

## Explicitly out of scope (for this positioning)

- Lead sources, ISA handoffs, drip campaigns, “speed to lead,” pipeline stages for **inbound prospects** as a CRM product.
- Anything that assumes **MLS-side listing workflows** as the core object (listing-like data may still appear as **comps/context**, not “my leads”).
- Pre-built, curated **partner marketplaces** or ranked vendor lists.
- **Community** at forum scale: verified experience badges, structured Q&A feeds, local/strategy groups as product pillars.
- **Full MLS/IDX compliance** or deep Salesforce-style customization as MVP goals.

---

## Deal math and scenarios (two layers)

### 1. Scratch “what-if” lab (ephemeral — no DB write by default)

**Purpose:** Load a property (or a blank template) and nudge numbers to see outcomes without creating a new persisted underwriting record on every slider move.

**Inputs (illustrative):** purchase price; rent (or rehab budget + ARV); loan terms; closing costs; hold period; capex reserve; vacancy; property management %; insurance/taxes.

**Typical adjustments:** −$10k price; 25% vs 20% down; rate +0.5%; rent −5%; rehab +$15k; refi in month 12 (if modeled).

**Outputs (illustrative):** cash to close; monthly cash flow; cash-on-cash; debt coverage (DSCR-ish) when debt is modeled; optional coarse IRR / equity multiple if a simple exit or refi event is included.

**UX contract:**

- Primary actions: **Discard** (default outcome when leaving) vs optional **Save as scenario snapshot** if history is ever desired.
- The lab is **always ephemeral** unless the user explicitly saves.

### 2. Underwriting profile (saved — source of truth)

When the user wants persistence, saved assumptions / underwriting profiles remain the **authoritative** record. The scratch lab does **not** replace that; it avoids spawning a new underwriting row for every exploratory tweak.

**Relationship:** Lab → optional “promote to saved profile” or “save snapshot”; saved profile → optional “open in lab” as starting point.

---

## Market context (individual decision support, not a feed)

Think **context panels** attached to a deal or property, not discussion threads.

| Area | Direction |
|------|-----------|
| Rent / sale comps | Summaries (ranges, bands): e.g. median rent in radius, rent/sqft band, days on market when available — **decision support**, not Zillow-grade precision claims. |
| Tax and insurance | Anchors from assessor / millage where available; **user-editable overrides** always. |
| Neighborhood / submarket | User-pinned tags (school tier, flood zone, crime index only if sourced carefully with **clear limitations** in UI). |
| Regulatory / cost of ownership | HOA, special assessments, rent-control jurisdictions — **user notes + light structured fields**. |
| Macro stress (optional) | Inputs to scenarios (e.g. “stress unemployment +2% → cut rent assumption 3%”), not editorial commentary. |

Everything supports **one user / one household** making a decision; no obligation to build social proof or threads.

---

## Partner directory (“Contacts” / “Partners”)

- **Locally stored, user-maintained only** — no pre-seeded rows.
- Fields (illustrative): name; role tags (lender, attorney, PM, contractor, inspector); phone; email; notes; optional **last used on deal X** link.
- **Search/filter** by tag; click-to-copy contact details; optional association to a deal (“this lender quoted on 123 Main”).
- **CSV import** is optional later.
- Treat as **PII**: export and delete-all paths; no cross-user sharing unless multi-tenant org features are added later.

---

## Dashboard inspiration (buy-side reinterpretation of “CRM reports”)

Crescent already exposes acquisition **Insights** dashboards. Use these **report shapes** as inspiration for gaps (especially **scenario overlays** and **acquisition funnel** metrics), not lead-conversion CRM metrics.

| Traditional CRM shape | Buy-side reinterpretation |
|------------------------|---------------------------|
| Pipeline value by stage | **Capital in play by stage:** sourcing → LOI → due diligence → closed → exited |
| Conversion by source | **Win rate by acquisition channel:** MLS, wholesaler, direct mail, auction, etc. |
| Time in stage | **Cycle time:** first touch → close; due-diligence burn |
| Forecast | **12-month equity and cash** under base / down / upside scenarios |
| Team leaderboard | **Skip** (individual app) or **personal goals vs plan** |
| Listing performance | **Asset performance:** actual vs pro forma rent, delinquency, work-order spend (if/when tracked) |

**Pairing:** scratch what-if lab and saved scenarios naturally complement dashboards that show **base vs stress** overlays.

---

## Implementation notes (non-binding)

- **n8n / VM:** ingestion and automation may stay external; product behaviors above are **in-app UX + data model** concerns unless otherwise specified.
- Existing Crescent concepts (**assumption sets**, **ListingAnalysis**, pipeline stages for **your** review flow) should remain the backbone; new work should extend them rather than reintroduce agent-lead CRM semantics.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-12 | Initial buy-side spec from product conversation (BiggerPockets / Propertybase selective borrow). |
