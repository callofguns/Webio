import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import {
  buyBlocker,
  FURNITURE,
  FURNITURE_ORDER,
  moveBlocker,
  OFFICE_ORDER,
  OFFICES,
  officeEffects,
  activeFurniture,
  type OfficeId,
} from '../../game/office';
import { dailyBurn } from '../../game/team';
import { WORKDAY_END, WORKDAY_START } from '../../game/balance';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { money } from '../components/AnimatedNumber';
import { spring } from '../motion';
import { FloorPlan } from './FloorPlan';

const pct = (mult: number) => Math.round((mult - 1) * 100);

/** The current office's bonuses, in plain words. */
function perkList(office: OfficeId, furniture: Parameters<typeof officeEffects>[1]): string[] {
  const fx = officeEffects(office, furniture);
  const out = [`Fits ${fx.capacity} ${OFFICES[office].remote ? 'remote ' : ''}employee${fx.capacity === 1 ? '' : 's'}`];
  if (fx.morale) out.push(`Team morale +${fx.morale}`);
  if (fx.teamSpeed > 1) out.push(`Team works ${pct(fx.teamSpeed)}% faster`);
  if (fx.designSpeed > 1) out.push(`Designers work ${pct(fx.designSpeed)}% faster`);
  if (fx.playerSpeed > 1) out.push(`You build ${pct(fx.playerSpeed)}% faster`);
  if (fx.presence) out.push(`Owners are friendlier on calls (+${fx.presence} interest)`);
  if (fx.prestige) out.push('Great applicants are more willing to join');
  if (fx.dialMult > 1) out.push(`Sales callers make ${pct(fx.dialMult)}% more calls`);
  if (fx.leadWarmth) out.push('New leads start out warmer');
  if (fx.latePenalty < 6) out.push('Late-night work is less sloppy');
  if (out.length === 1) out.push('No bonuses yet. Clients can tell you work from home.');
  return out;
}

export function OfficeScreen() {
  const s = useGame();
  const [moving, setMoving] = useState<OfficeId | null>(null);
  const here = OFFICES[s.office];
  // People are in on weekdays from 9 to 6.
  const working = (s.day - 1) % 7 < 5 && s.minute >= WORKDAY_START && s.minute < WORKDAY_END;
  const active = new Set(activeFurniture(s.office, s.furniture));
  const target = moving ? OFFICES[moving] : null;
  const burnAfterMove = target ? dailyBurn(s.employees, target.rent) : 0;

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Office</h1>
          <p className="muted">
            {here.name} &middot; {here.rent ? `${money(here.rent)}/day rent` : 'no rent'} &middot; {s.employees.length}/{here.capacity} employees
          </p>
        </div>
      </div>

      <div className="office-layout">
        <div className="card" style={{ padding: 14 }}>
          <FloorPlan office={s.office} furniture={s.furniture} employees={s.employees} working={working} playerName={s.profile?.playerName ?? 'You'} />
        </div>
        <div className="card">
          <div className="card-title">
            <h2>What you get here</h2>
          </div>
          <ul className="perk-list">
            {perkList(s.office, s.furniture).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {s.furniture.some((f) => !active.has(f)) && (
            <p className="small faint" style={{ marginTop: 10 }}>Some of your equipment doesn&rsquo;t fit here, so it&rsquo;s in storage.</p>
          )}
        </div>
      </div>

      <h2>Places you could work</h2>
      <div className="grid office-grid">
        {OFFICE_ORDER.map((id, i) => {
          const o = OFFICES[id];
          const current = id === s.office;
          const blocker = moveBlocker(id, s.office, s.money, s.reputation, s.employees.length);
          return (
            <motion.div
              key={id}
              className={`card stack office-card ${current ? 'frame-sel' : ''}`}
              style={{ gap: 10 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.05 }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{o.name}</h3>
                {current && <span className="badge accent">You&rsquo;re here</span>}
              </div>
              <p className="small muted">{o.description}</p>
              <div className="chip-list">
                <span className="badge">Fits {o.capacity}</span>
                <span className="badge">{o.rent ? `${money(o.rent)}/day` : 'Free'}</span>
                {o.moveIn > 0 && <span className="badge">Move-in {money(o.moveIn)}</span>}
                {o.reputation > 0 && <span className={`badge ${s.reputation >= o.reputation ? 'good' : 'warn'}`}>{o.reputation} reputation</span>}
              </div>
              {!current && (
                <Button size="sm" variant={blocker ? 'default' : 'primary'} disabled={!!blocker} onClick={() => setMoving(id)} style={{ marginTop: 'auto' }}>
                  {blocker ?? `Move here · ${money(o.moveIn)}`}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      <h2>Equipment</h2>
      <div className="grid office-grid">
        {FURNITURE_ORDER.map((id) => {
          const f = FURNITURE[id];
          const owned = s.furniture.includes(id);
          const blocker = buyBlocker(id, s.office, s.furniture, s.money);
          return (
            <div key={id} className={`card stack equip-card ${owned ? 'owned' : ''}`} style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="equip-icon" aria-hidden>
                  {f.icon}
                </span>
                <h3 style={{ flex: 1 }}>{f.name}</h3>
              </div>
              <p className="small muted" style={{ flex: 1 }}>{f.effect}</p>
              {owned ? (
                <span className={`badge ${active.has(id) ? 'good' : ''}`} style={{ alignSelf: 'flex-start' }}>
                  {active.has(id) ? '✓ Owned' : 'In storage'}
                </span>
              ) : (
                <Button size="sm" variant={blocker ? 'default' : 'primary'} disabled={!!blocker} onClick={() => s.buyFurniture(id)}>
                  {blocker ?? `Buy · ${money(f.price)}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!moving}>
        {target && moving && (
          <>
            <h2>Move to {target.name.toLowerCase()}?</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              Moving costs {money(target.moveIn)} now. Rent is {money(target.rent)} every day, weekends too. {s.employees.length ? 'With living costs and wages' : 'With living costs'}{' '}
              that&rsquo;s about {money(burnAfterMove)}/day going out, so your money would last about {Math.max(0, Math.floor((s.money - target.moveIn) / burnAfterMove))} days
              without new income.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <Button onClick={() => setMoving(null)}>Stay put</Button>
              <Button
                variant="primary"
                onClick={() => {
                  s.moveOffice(moving);
                  setMoving(null);
                }}
              >
                Move in
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
