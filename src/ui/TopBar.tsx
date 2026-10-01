import { useState } from 'react';
import { DAY_HARD_END, useGame } from '../game/store';
import { DAILY_LIVING_COST } from '../game/balance';
import { callTimeQuality, formatClock, isBusinessHours, weekday } from '../game/time';
import { AnimatedNumber, money } from './components/AnimatedNumber';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { MoneyDelta } from './components/MoneyDelta';

export function TopBar() {
  const { day, minute, money: cash, activeCall, endDay, wait } = useGame();
  const [confirming, setConfirming] = useState(false);
  const open = isBusinessHours(day, minute);
  const quality = callTimeQuality(day, minute);
  const midCall = !!activeCall && activeCall.phase !== 'ended';

  const callBadge = !open ? (
    <span className="badge">
      <span className="dot" /> <span className="hide-sm">Businesses closed</span>
    </span>
  ) : (
    <span className={`badge ${quality === 'good' ? 'good' : quality === 'okay' ? 'warn' : 'bad'}`}>
      <span className="dot" />
      <span className="hide-sm">{quality === 'good' ? 'Good time to call' : quality === 'okay' ? 'Okay time to call' : 'Bad time to call'}</span>
    </span>
  );

  return (
    <header className="topbar">
      <div>
        <div className="clock num">{formatClock(minute)}</div>
        <div className="small faint">
          Day {day} &middot; {weekday(day)}
        </div>
      </div>
      {callBadge}
      <div className="spacer" />
      <div className="money-wrap">
        <MoneyDelta value={cash} />
        <div style={{ fontWeight: 700, fontSize: 16, color: cash < 0 ? 'var(--bad)' : undefined }}>
          <AnimatedNumber value={cash} format={money} />
        </div>
        <div className="small faint hide-sm">Bank balance</div>
      </div>
      <Button className="wait-btn" disabled={midCall || minute >= DAY_HARD_END} onClick={() => wait(60)} title="Let an hour pass">
        <span className="hide-sm">Wait 1 hr</span>
        <span className="show-sm">+1h</span>
      </Button>
      <Button variant="primary" disabled={midCall} onClick={() => (open ? setConfirming(true) : endDay())}>
        End day
      </Button>

      <Modal open={confirming}>
        <h2>End the day early?</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Businesses are still open. Every hour you don&rsquo;t use is a missed chance to find clients. You&rsquo;ll pay{' '}
          {money(DAILY_LIVING_COST)} in living costs either way.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={() => setConfirming(false)}>Keep working</Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirming(false);
              endDay();
            }}
          >
            End day
          </Button>
        </div>
      </Modal>
    </header>
  );
}
