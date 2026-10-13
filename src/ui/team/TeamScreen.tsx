import { useState } from 'react';
import { useGame } from '../../game/store';
import { OFFICES } from '../../game/office';
import { Tabs } from '../components/Tabs';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { money } from '../components/AnimatedNumber';
import { EmployeeCard } from './EmployeeCard';
import { HiringPanel } from './HiringPanel';

export function TeamScreen() {
  const { employees, applicants, payrollDue, day, office, salesPaused, setSalesPaused } = useGame();
  const sellers = employees.filter((e) => e.role === 'sales').length;
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
            {employees.length}/{OFFICES[office].capacity} people
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
          <div className="stack" style={{ gap: 16 }}>
          {sellers > 0 && (
            <div className={`card sales-pause ${salesPaused ? 'paused' : ''}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{salesPaused ? 'Sales calls are paused' : 'Sales calls are on'}</h2>
                <p className="small muted" style={{ marginTop: 4 }}>
                  {salesPaused
                    ? 'Your salespeople aren’t calling anyone, so no new deals come in. They still get paid, and chats they already started carry on.'
                    : 'Too many projects? Pause your salespeople to stop new deals coming in while you and your team catch up.'}
                </p>
              </div>
              <Button variant={salesPaused ? 'primary' : undefined} onClick={() => setSalesPaused(!salesPaused)}>
                {salesPaused ? 'Start calling again' : `Pause sales${sellers > 1 ? ` (${sellers})` : ''}`}
              </Button>
            </div>
          )}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {employees.map((e) => (
              <EmployeeCard key={e.id} e={e} />
            ))}
          </div>
          </div>
        )
      ) : (
        <HiringPanel />
      )}
    </div>
  );
}
