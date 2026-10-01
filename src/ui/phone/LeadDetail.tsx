import { callBlocker, DAY_HARD_END, useGame } from '../../game/store';
import { INDUSTRIES, PAIN_LABELS, SIZE_LABELS, WEBSITE_LABELS } from '../../game/businesses';
import { RESEARCH_MINUTES } from '../../game/balance';
import type { Business } from '../../game/types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { statusBadge } from './labels';
import { Avatar } from '../components/Avatar';

const Unknown = () => <span className="unknown">Research to find out</span>;

export function LeadDetail({ biz }: { biz: Business }) {
  const { day, minute, research, beginCall } = useGame();
  const blocker = callBlocker(biz, day, minute);
  const badge = statusBadge(biz, day);
  const canResearch = !biz.researched && minute + RESEARCH_MINUTES <= DAY_HARD_END;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 12 }}>
          <Avatar name={biz.name} />
          <div>
            <h2>{biz.name}</h2>
            <p className="small muted num">
              {INDUSTRIES[biz.industry].label} &middot; {biz.phone}
            </p>
          </div>
        </div>
        <span className={`badge ${badge.tone}`}>{badge.text}</span>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Owner</dt>
          <dd>{biz.researched ? biz.ownerName : <Unknown />}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{biz.researched ? SIZE_LABELS[biz.size] : <Unknown />}</dd>
        </div>
        <div>
          <dt>Website</dt>
          <dd>{biz.researched ? WEBSITE_LABELS[biz.website] : <Unknown />}</dd>
        </div>
        <div>
          <dt>Biggest problem</dt>
          <dd>{biz.researched ? PAIN_LABELS[biz.painPoint] : <Unknown />}</dd>
        </div>
        <div>
          <dt>Times called</dt>
          <dd className="num">{biz.attempts}</dd>
        </div>
      </dl>

      <div className="row wrap">
        <Button variant="primary" disabled={!!blocker} onClick={() => beginCall(biz.id)}>
          <Icon name="phone" size={16} /> Call
        </Button>
        {!biz.researched && (
          <Button disabled={!canResearch} onClick={() => research(biz.id)}>
            <Icon name="search" size={16} /> Research &middot; {RESEARCH_MINUTES} min
          </Button>
        )}
        {blocker && <span className="small faint">{blocker}</span>}
      </div>
      {!biz.researched && (
        <p className="small faint" style={{ marginTop: 12 }}>
          Researching looks up their website and owner. It lets you pitch a real problem instead of guessing.
        </p>
      )}
    </div>
  );
}
