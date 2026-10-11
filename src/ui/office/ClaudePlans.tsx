import { motion } from 'motion/react';
import { developerCount, useGame } from '../../game/store';
import { CLAUDE_ORDER, CLAUDE_PLANS, claudeCost, planBlocker, seatsFor, type ClaudePlan } from '../../game/claude';
import { dailyBurn } from '../../game/team';
import { OFFICES } from '../../game/office';
import { Button } from '../components/Button';
import { money } from '../components/AnimatedNumber';
import { spring } from '../motion';

/** Subscribe to Claude to build sites faster. Charged every evening, like rent. */
export function ClaudePlans() {
  const { claude, money: cash, employees, office, setClaudePlan } = useGame();
  const rent = OFFICES[office].rent;
  const devs = developerCount(employees);
  const burnWith = (plan: ClaudePlan) => dailyBurn(employees, rent, claudeCost(plan, devs));
  const current = CLAUDE_PLANS[claude];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Claude subscription</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {claude === 'none'
              ? 'An AI helper that builds sites with you. Billed every evening, weekends too. Cancel any time.'
              : `You’re on ${current.name}: ${money(claudeCost(claude, devs))}/day, taken every evening.`}
          </p>
        </div>
        {claude !== 'none' && (
          <Button size="sm" variant="ghost" style={{ color: 'var(--bad)' }} onClick={() => setClaudePlan('none')}>
            Cancel plan
          </Button>
        )}
      </div>

      <div className="grid office-grid">
        {CLAUDE_ORDER.map((id, i) => {
          const plan = CLAUDE_PLANS[id];
          const isCurrent = id === claude;
          const blocker = planBlocker(id, claude, cash, devs);
          const change = Math.round(burnWith(id) - burnWith(claude));
          return (
            <motion.div
              key={id}
              className={`card stack equip-card claude-card ${isCurrent ? 'owned frame-sel' : ''}`}
              style={{ gap: 10 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.05 }}
            >
              <div className="row" style={{ gap: 10 }}>
                <span className="equip-icon" aria-hidden>
                  {plan.icon}
                </span>
                <h3 style={{ flex: 1 }}>{plan.name}</h3>
                {isCurrent && <span className="badge accent">Your plan</span>}
              </div>
              <p className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                {money(plan.price)}
                <span className="small muted" style={{ fontWeight: 500 }}> /day{plan.perSeat ? ' per developer' : ''}</span>
              </p>
              {plan.perSeat && (
                <p className="small muted" style={{ marginTop: -6 }}>
                  You and {devs} developer{devs === 1 ? '' : 's'} = {seatsFor(id, devs)} seats, {money(claudeCost(id, devs))}/day{devs + 1 < (plan.minSeats ?? 1) ? ' (minimum seats)' : ''}.
                </p>
              )}
              <ul className="perk-list">
                {plan.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {!isCurrent && (
                <>
                  <p className="small faint" style={{ marginTop: 'auto' }}>
                    {change >= 0 ? `Your costs go up by ${money(change)}/day.` : `Your costs go down by ${money(-change)}/day.`}
                  </p>
                  <Button size="sm" variant={blocker ? 'default' : 'primary'} disabled={!!blocker} onClick={() => setClaudePlan(id)}>
                    {blocker ?? (claude === 'none' ? `Subscribe · ${money(claudeCost(id, devs))}/day` : `Switch to ${plan.name.replace('Claude ', '')}`)}
                  </Button>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      <p className="small faint">Claude speeds up your own building. Your team works at the same pace as before.</p>
    </>
  );
}
