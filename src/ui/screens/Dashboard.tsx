import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { formatClock } from '../../game/time';
import { dealStatus, toGameTime } from '../../game/deals';
import { dailyBurn } from '../../game/team';
import { AnimatedNumber, money } from '../components/AnimatedNumber';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { spring } from '../motion';
import type { ScreenId } from '../Sidebar';

const TIPS = [
  'Mornings (10–12) are the best time to call. Lunch and late afternoon are rough.',
  'Research a business first. Pointing out a real problem beats a generic pitch.',
  'Listen to how they answer. A rushed "make it quick" means get to the point.',
  'Big claims like "10x your revenue" make skeptical owners hang up.',
  'Most calls go nowhere. That’s normal — keep dialing.',
];

export function Dashboard({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const s = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const now = toGameTime(s.day, s.minute);
  const openDeals = s.deals.filter((d) => !['won', 'lost'].includes(dealStatus(d, now)));
  const yourTurn = openDeals.filter((d) => dealStatus(d, now) === 'your_turn').length;
  const earned = s.lifetime.moneyIn + s.today.moneyIn;
  const callbacks = s.businesses.filter((b) => b.status === 'callback' && b.callback?.day === s.day).length;
  const runway = Math.max(0, Math.floor(s.money / dailyBurn(s.employees)));
  const tip = TIPS[(s.day - 1) % TIPS.length];

  const stats = [
    { label: 'Bank balance', value: <AnimatedNumber value={s.money} format={money} />, sub: `${runway} days of runway` },
    { label: 'Open deals', value: <AnimatedNumber value={openDeals.length} />, sub: yourTurn ? `${yourTurn} waiting on your reply` : `${s.projects.length} signed so far` },
    { label: 'Earned', value: <AnimatedNumber value={earned} format={money} />, sub: `${s.today.dials} calls today` },
    {
      label: 'Reputation',
      value: <AnimatedNumber value={s.reputation} />,
      sub: `${s.projects.filter((p) => p.status === 'delivered').length} sites delivered`,
    },
  ];

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Good {s.minute < 12 * 60 ? 'morning' : s.minute < 17 * 60 ? 'afternoon' : 'evening'}, {s.profile?.playerName}</h1>
          <p className="muted">
            {callbacks > 0
              ? `You have ${callbacks} callback${callbacks > 1 ? 's' : ''} scheduled today.`
              : yourTurn > 0
                ? `${yourTurn} client${yourTurn > 1 ? 's are' : ' is'} waiting for your text.`
                : 'No clients yet. Time to pick up the phone.'}
          </p>
        </div>
        <div className="row">
          {yourTurn > 0 && <Button onClick={() => onNavigate('messages')}>Open messages</Button>}
          <Button variant="primary" onClick={() => onNavigate('phone')}>
            Open phone
          </Button>
        </div>
      </div>

      <div className="grid grid-4">
        {stats.map((st, i) => (
          <motion.div key={st.label} className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.04 }}>
            <div className="stat-label">{st.label}</div>
            <div className="stat-value">{st.value}</div>
            <div className="stat-sub">{st.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h2>Activity</h2>
          </div>
          {s.log.length === 0 ? (
            <div className="empty">Nothing yet.</div>
          ) : (
            <div className="log">
              <AnimatePresence initial={false}>
                {s.log.slice(0, 10).map((l) => (
                  <motion.div key={l.id} className={`log-item ${l.tone}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
                    <span className="log-time num">
                      Day {l.day}, {formatClock(l.minute)}
                    </span>
                    <span className="log-text">{l.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-title">
              <h2>Tip of the day</h2>
            </div>
            <p className="muted">{tip}</p>
          </div>
          <div className="card">
            <div className="card-title">
              <h2>How it works</h2>
            </div>
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>Cold call local businesses from the Phone screen.</li>
              <li>Text the ones who are interested and agree on a price.</li>
              <li>Build their website, get paid, and grow your reputation.</li>
              <li>Hire a team, move into an office, and scale.</li>
            </ol>
            <div className="divider" />
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} style={{ color: 'var(--text-3)', padding: 0 }}>
              Restart game
            </Button>
          </div>
        </div>
      </div>

      <Modal open={confirmReset}>
        <h2>Restart from day 1?</h2>
        <p className="muted" style={{ marginTop: 8 }}>This deletes your save. It can&rsquo;t be undone.</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button variant="primary" style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={s.resetGame}>
            Delete save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
