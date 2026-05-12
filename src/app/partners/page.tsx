import { PartnersDirectory } from '@/components/PartnersDirectory';

export const dynamic = 'force-dynamic';

export default function PartnersPage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Buy-side</div>
          <h1>Partners &amp; contacts</h1>
          <p className="muted">User-maintained directory — no vendor marketplace.</p>
        </div>
      </div>
      <PartnersDirectory />
    </div>
  );
}
