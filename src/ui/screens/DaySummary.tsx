import { useGame } from '../../game/store';
import { DAILY_LIVING_COST } from '../../game/balance';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { money } from '../components/AnimatedNumber';

export function DaySummary() {
  const summary = useGame((s) => s.lastDaySummary);
  const cash = useGame((s) => s.money);
  const dismiss = useGame((s) => s.dismissSummary);
  const runway = Math.floor(cash / DAILY_LIVING_COST);

  const rows: [string, string][] = summary
    ? [
        ['Calls made', String(summary.dials)],
        ['Real conversations', String(summary.conversations)],
        ['Interested businesses', String(summary.leadsWon)],
        ['Money earned', money(summary.moneyIn)],
        ['Money spent', money(summary.moneyOut)],
      ]
    : [];

  return (
    <Modal open={!!summary}>
      {summary && (
        <>
          <p className="small faint">End of day {summary.day}</p>
          <h2 style={{ fontSize: 20, marginTop: 2 }}>
            {summary.moneyIn > 0 ? 'Payday!' : summary.leadsWon > 0 ? 'Good day.' : summary.dials === 0 ? 'A quiet day.' : 'Tough day.'}
          </h2>
          <div className="stack" style={{ marginTop: 16, gap: 0 }}>
            {rows.map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="muted">{k}</span>
                <span className="num" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            {cash < 0
              ? 'You’re in debt. Find a client soon.'
              : `At ${money(DAILY_LIVING_COST)}/day you can last about ${runway} more days without income.`}
          </p>
          <Button variant="primary" block style={{ marginTop: 18 }} onClick={dismiss}>
            Start next day
          </Button>
        </>
      )}
    </Modal>
  );
}
