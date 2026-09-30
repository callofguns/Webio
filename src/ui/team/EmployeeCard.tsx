import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { BONUS_AMOUNT, marketPay, ROLES } from '../../game/team';
import type { Employee } from '../../game/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { money } from '../components/AnimatedNumber';
import { softSpring } from '../motion';
import { initials, LevelDots, TraitBadges } from './common';

function moraleLabel(m: number): { text: string; tone: string } {
  if (m >= 70) return { text: 'Happy', tone: 'good' };
  if (m >= 45) return { text: 'Okay', tone: '' };
  if (m >= 30) return { text: 'Unhappy', tone: 'warn' };
  return { text: 'Thinking of quitting', tone: 'bad' };
}

export function EmployeeCard({ e }: { e: Employee }) {
  const { projects, businesses, day, money: cash, assignEmployee, giveBonus, fireEmployee } = useGame();
  const [confirmFire, setConfirmFire] = useState(false);
  const mood = moraleLabel(e.morale);
  const market = marketPay(e.role, e.level);
  // After a week you know what they're really like.
  const knowsAll = day - e.hiredDay >= 5;
  const traits = knowsAll ? e.traits : e.knownTraits;
  const openProjects = projects.filter((p) => p.status !== 'delivered');
  const builder = e.role !== 'sales';

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12 }}>
        <div className="avatar">{initials(e.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{e.name}</h2>
          <p className="small muted">{ROLES[e.role].label}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ fontWeight: 600 }}>{money(e.pay)}/day</div>
          <div className="small faint">Going rate {money(market)}</div>
        </div>
      </div>

      <LevelDots level={e.level} />

      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="small muted">Morale</span>
          <span className={`badge ${mood.tone}`}>{mood.text}</span>
        </div>
        <div className="progress">
          <motion.div
            initial={false}
            animate={{ width: `${e.morale}%` }}
            transition={softSpring}
            style={{ background: e.morale < 30 ? 'var(--bad)' : e.morale < 45 ? 'var(--warn)' : undefined }}
          />
        </div>
      </div>

      <div className="chip-list">
        <TraitBadges traits={traits} />
        {!knowsAll && <span className="badge">Still getting to know them</span>}
      </div>

      <div className="small" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
        <div className="muted">{e.today.note || ((day - 1) % 7 >= 5 ? 'Off for the weekend' : day - e.hiredDay < 1 ? 'Starts today' : 'Starts at 9 AM')}</div>
        <div className="faint num" style={{ marginTop: 2 }}>
          Today: {e.role === 'sales' ? `${e.today.dials} calls, ${e.today.leads} leads` : `${e.today.hours} hrs of work`}
        </div>
      </div>

      {builder && (
        <div className="field">
          <label htmlFor={`assign-${e.id}`}>Working on</label>
          <select
            id={`assign-${e.id}`}
            className="input"
            value={e.assignedProjectId ?? ''}
            onChange={(ev) => assignEmployee(e.id, ev.target.value || null)}
          >
            <option value="">Nothing</option>
            {openProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {businesses.find((b) => b.id === p.businessId)?.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row wrap">
        <Button size="sm" disabled={cash < BONUS_AMOUNT} onClick={() => giveBonus(e.id)} title="Makes them happier">
          Give {money(BONUS_AMOUNT)} bonus
        </Button>
        <Button size="sm" variant="ghost" style={{ color: 'var(--bad)' }} onClick={() => setConfirmFire(true)}>
          Let go
        </Button>
      </div>

      <Modal open={confirmFire}>
        <h2>Let {e.name} go?</h2>
        <p className="muted" style={{ marginTop: 8 }}>You still pay what they&rsquo;ve earned this week. The rest of the team will be a bit nervous.</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={() => setConfirmFire(false)}>Keep them</Button>
          <Button
            variant="primary"
            style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => {
              setConfirmFire(false);
              fireEmployee(e.id);
            }}
          >
            Let go
          </Button>
        </div>
      </Modal>
    </div>
  );
}
