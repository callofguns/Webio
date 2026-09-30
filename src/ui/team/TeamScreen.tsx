import { useState } from 'react';
import { useGame } from '../../game/store';
import { MAX_TEAM } from '../../game/balance';
import { Tabs } from '../components/Tabs';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { money } from '../components/AnimatedNumber';
import { EmployeeCard } from './EmployeeCard';
import { HiringPanel } from './HiringPanel';

export function TeamScreen() {
  const { employees, applicants, payrollDue, day } = useGame();
  const [tab, setTab] = useState<'team' | 'hiring'>(employees.length ? 'team' : 'hiring');
  const weekly = employees.reduce((n, e) => n + e.pay, 0) * 5;
  // Day 1 is a Monday, so Friday is index 4 in the week.
  const daysToFriday = (4 - ((day - 1) % 7) + 7) % 7;

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Team</h1>
          <p className="muted">
            {employees.length}/{MAX_TEAM} people
            {employees.length > 0 && (
              <>
                {' '}
                &middot; {money(weekly)} a week in wages &middot; {money(payrollDue)} owed so far, paid{' '}
                {daysToFriday === 0 ? 'tonight' : `on Friday (${daysToFriday} day${daysToFriday > 1 ? 's' : ''})`}
              </>
            )}
          </p>
        </div>
        <Tabs
          id="team-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'team', label: `Team (${employees.length})` },
            { value: 'hiring', label: `Hiring${applicants.length ? ` (${applicants.length})` : ''}` },
          ]}
        />
      </div>

      {tab === 'team' ? (
        employees.length === 0 ? (
          <div className="card empty" style={{ padding: 64 }}>
            <Icon name="users" size={28} />
            <p style={{ marginTop: 10 }}>It&rsquo;s just you for now. Hiring lets you get more done, but wages add up fast.</p>
            <Button variant="primary" style={{ marginTop: 14 }} onClick={() => setTab('hiring')}>
              Start hiring
            </Button>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {employees.map((e) => (
              <EmployeeCard key={e.id} e={e} />
            ))}
          </div>
        )
      ) : (
        <HiringPanel />
      )}
    </div>
  );
}
