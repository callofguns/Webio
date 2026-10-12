import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { GOAL_BY_ID, GOALS, nextGoals, type Goal } from '../../game/goals';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { money } from '../components/AnimatedNumber';
import { softSpring } from '../motion';

function GoalRow({ goal, done }: { goal: Goal; done: boolean }) {
  const s = useGame();
  const [n, target] = goal.progress(s);
  const showCount = target > 1;
  return (
    <div className={`goal-row ${done ? 'done' : ''}`}>
      <span className="goal-check" aria-hidden>
        {done ? '✓' : ''}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 650 }}>{goal.title}</span>
          <span className="small num goal-reward">+{money(goal.reward)}</span>
        </div>
        <div className="small muted">{goal.text}</div>
        {!done && showCount && (
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <div className="progress" style={{ flex: 1 }}>
              <motion.div initial={false} animate={{ width: `${(n / target) * 100}%` }} transition={softSpring} />
            </div>
            <span className="small faint num">
              {target >= 1000 ? `${money(n)} / ${money(target)}` : `${n} / ${target}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Every goal, done ones ticked. */
export function GoalList() {
  const done = useGame((s) => s.goalsDone ?? []);
  return (
    <div className="stack" style={{ gap: 4 }}>
      <p className="small muted" style={{ marginBottom: 6 }}>
        {done.length} of {GOALS.length} done
      </p>
      {GOALS.map((g) => (
        <GoalRow key={g.id} goal={g} done={done.includes(g.id)} />
      ))}
    </div>
  );
}

/** The next few goals, on the Home screen. */
export function GoalsCard() {
  const done = useGame((s) => s.goalsDone ?? []);
  const [all, setAll] = useState(false);
  const next = nextGoals(done);
  return (
    <div className="card">
      <div className="card-title">
        <h2>Goals</h2>
        <span className="badge num">
          {done.length}/{GOALS.length}
        </span>
      </div>
      {next.length === 0 ? (
        <p className="muted">You reached every goal. What an agency!</p>
      ) : (
        <div className="stack" style={{ gap: 4 }}>
          {next.map((g) => (
            <GoalRow key={g.id} goal={g} done={false} />
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" style={{ marginTop: 8, padding: 0 }} onClick={() => setAll(true)}>
        See all goals
      </Button>
      <Modal open={all} wide onClose={() => setAll(false)}>
        <h2>Goals</h2>
        <div className="modal-body" style={{ marginTop: 12 }}>
          <GoalList />
        </div>
        <div className="row modal-foot" style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={() => setAll(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Celebrates goals you just reached. Waits until the day summary and any event are out of the way. */
export function GoalPopup() {
  const queue = useGame((s) => s.goalQueue ?? []);
  const busy = useGame((s) => !!s.lastDaySummary || !!s.event);
  const dismiss = useGame((s) => s.dismissGoals);
  const goals = queue.map((id) => GOAL_BY_ID[id]).filter(Boolean);
  const total = goals.reduce((n, g) => n + g.reward, 0);
  return (
    <Modal open={goals.length > 0 && !busy} onClose={dismiss}>
      <div className="goal-pop">
        <div className="event-icon" aria-hidden>
          🏆
        </div>
        <p className="small faint">{goals.length > 1 ? `${goals.length} goals reached` : 'Goal reached'}</p>
        <h2 style={{ fontSize: 20, marginTop: 2 }}>{goals.length === 1 ? goals[0].title : 'Nice work!'}</h2>
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          {goals.map((g) => (
            <div key={g.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{g.text}</span>
              <span className="num goal-reward" style={{ fontWeight: 700 }}>
                +{money(g.reward)}
              </span>
            </div>
          ))}
        </div>
        {goals.length > 1 && <p className="small muted" style={{ marginTop: 10 }}>{money(total)} added to your bank.</p>}
        <Button variant="primary" block style={{ marginTop: 18 }} onClick={dismiss}>
          Collect {money(total)}
        </Button>
      </div>
    </Modal>
  );
}
