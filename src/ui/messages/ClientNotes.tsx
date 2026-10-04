import { FEATURES, knownBy, toGameTime } from '../../game/deals';
import { useGame } from '../../game/store';
import { INDUSTRIES, SIZE_LABELS } from '../../game/businesses';
import type { Business, Deal } from '../../game/types';
import { money } from '../components/AnimatedNumber';

const Ask = ({ what }: { what: string }) => <span className="unknown">Ask about {what}</span>;

/** What you've learned about the client so far. */
export function ClientNotes({ deal, biz }: { deal: Deal; biz: Business }) {
  const now = useGame((s) => toGameTime(s.day, s.minute));
  // Only what they've actually replied about so far.
  const known = knownBy(deal, now);
  const { needs } = deal;
  return (
    <div className="card notes-card">
      <div className="card-title">
        <h2>Client notes</h2>
      </div>
      <dl className="notes" style={{ margin: 0 }}>
        <dt>Contact</dt>
        <dd>
          {biz.ownerName} &middot; {INDUSTRIES[biz.industry].label}
        </dd>
        <dt>Size</dt>
        <dd>{SIZE_LABELS[biz.size]}</dd>
        <dt>What they need</dt>
        <dd>
          {known.features ? (
            <div className="chip-list">
              {needs.features
                .filter((f) => f !== 'copywriting')
                .map((f) => (
                  <span key={f} className="badge accent">{FEATURES[f].label}</span>
                ))}
              <span className="badge">~{needs.pages} pages</span>
            </div>
          ) : (
            <Ask what="features" />
          )}
        </dd>
        <dt>Budget</dt>
        <dd className="num">
          {!known.budget ? <Ask what="budget" /> : deal.budgetHint ? `${money(deal.budgetHint[0])} – ${money(deal.budgetHint[1])}` : 'Wouldn’t say'}
        </dd>
        <dt>Deadline</dt>
        <dd>{known.deadline ? `Within ${needs.deadlineDays} days` : <Ask what="timing" />}</dd>
        <dt>Logo, photos &amp; text</dt>
        <dd>{known.content ? (needs.hasContent ? 'They have their own' : 'They need you to make them') : <Ask what="content" />}</dd>
      </dl>
    </div>
  );
}
