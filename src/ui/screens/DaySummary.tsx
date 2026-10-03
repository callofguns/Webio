import { useGame } from '../../game/store';
import { dailyBurn } from '../../game/team';
import { OFFICES } from '../../game/office';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { money } from '../components/AnimatedNumber';

export function DaySummary() {
  const summary = useGame((s) => s.lastDaySummary);
  const cash = useGame((s) => s.money);
  const dismiss = useGame((s) => s.dismissSummary);
  const employees = useGame((s) => s.employees);
  const rent = useGame((s) => OFFICES[s.office].rent);
  const burn = dailyBurn(employees, rent);
  const runway = Math.floor(cash / burn);

  const rows: [string, string][] = summary
    ? [
        ['Calls made', String(summary.dials)],
        ['Real conversations', String(summary.conversations)],
        ['Interested businesses', String(summary.leadsWon)],
        ...(summary.team
          ? ([
              ['Team calls', `${summary.team.dials} calls, ${summary.team.leads} lead${summary.team.leads === 1 ? '' : 's'}`],
              ['Team building', `${summary.team.buildHours} hrs`],
            ] as [string, string][])
          : []),
        ['Money earned', money(summary.moneyIn)],
        ...(summary.payroll ? ([['Wages paid', money(summary.payroll)]] as [string, string][]) : []),
        ...(summary.rent ? ([['Rent', money(summary.rent)]] as [string, string][]) : []),
        ['Money spent', money(summary.moneyOut)],
      ]
    : [];

  return (
    <Modal open={!!summary} onClose={dismiss}>
      {summary && (
        <>
          <p className="small faint">End of day {summary.day}</p>
          <h2 style={{ fontSize: 20, marginTop: 2 }}>
            {summary.payroll > 0 ? 'Payday for your team.' : summary.moneyIn > 0 ? 'Money came in!' : summary.leadsWon > 0 ? 'Good day.' : summary.dials === 0 ? 'A quiet day.' : 'Tough day.'}
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
              : `You spend about ${money(burn)}/day${employees.length || rent ? ` including ${[employees.length && 'wages', rent && 'rent'].filter(Boolean).join(' and ')}` : ''}. That lasts about ${runway} more days without income.`}
          </p>
          <Button variant="primary" block style={{ marginTop: 18 }} onClick={dismiss}>
            Start next day
          </Button>
        </>
      )}
    </Modal>
  );
}
