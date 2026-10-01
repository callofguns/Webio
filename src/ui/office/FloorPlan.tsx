// A little top-down drawing of your office. Desks fill up with your team,
// equipment you buy shows up in the room, and the lights go off after work.

import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'motion/react';
import { activeFurniture, FURNITURE, FURNITURE_ORDER, OFFICES, type FurnitureId, type OfficeId } from '../../game/office';
import type { Employee } from '../../game/types';
import { Avatar } from '../components/Avatar';

/** Positions are percentages of the room (x, y = center). */
type Spot = [number, number];

interface Layout {
  desks: Spot[];
  /** Where equipment goes, in FURNITURE_ORDER. */
  slots: Spot[];
  decor: ReactNode;
}

const box = (x: number, y: number, w: number, h: number, cls: string, label?: string) => (
  <div className={`fp-thing ${cls}`} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
    {label && <span>{label}</span>}
  </div>
);

function grid(cols: number, rows: number, x0: number, x1: number, y0: number, y1: number): Spot[] {
  const out: Spot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push([x0 + ((x1 - x0) * (c + 0.5)) / cols, y0 + ((y1 - y0) * (r + 0.5)) / rows]);
    }
  }
  return out;
}

const LAYOUTS: Record<OfficeId, Layout> = {
  bedroom: {
    desks: [[26, 64]],
    slots: [[38, 60], [16, 60], [8, 18], [90, 86], [60, 86], [50, 18], [70, 86], [80, 86]],
    decor: (
      <>
        {box(60, 8, 34, 46, 'fp-bed', 'Bed')}
        {box(28, 0, 24, 4, 'fp-window')}
        <div className="fp-rug" style={{ left: '40%', top: '56%', width: '30%', height: '34%' }} />
      </>
    ),
  },
  coworking: {
    desks: [[26, 40], [42, 40], [58, 40], [74, 40]],
    slots: [[90, 20], [90, 40], [8, 20], [8, 80], [90, 80], [50, 88], [30, 88], [70, 88]],
    decor: (
      <>
        {box(16, 46, 68, 12, 'fp-table', 'Shared table')}
        {/* Other people who rent desks here. */}
        {[30, 50, 70].map((x) => (
          <div key={x} className="fp-stranger" style={{ left: `${x}%`, top: '68%' }} />
        ))}
        {box(30, 0, 40, 4, 'fp-window')}
      </>
    ),
  },
  small: {
    desks: grid(4, 2, 8, 64, 16, 72),
    slots: [[90, 70], [90, 50], [74, 10], [6, 88], [40, 90], [90, 30], [26, 90], [60, 90]],
    decor: (
      <>
        {box(70, 56, 24, 30, 'fp-table', 'Meeting')}
        {box(20, 0, 50, 4, 'fp-window')}
      </>
    ),
  },
  loft: {
    desks: grid(5, 3, 6, 66, 18, 82),
    slots: [[92, 14], [92, 34], [76, 12], [4, 90], [50, 92], [92, 54], [30, 92], [84, 84]],
    decor: (
      <>
        <div className="fp-brick" />
        {box(10, 0, 20, 5, 'fp-window')}
        {box(40, 0, 20, 5, 'fp-window')}
        {box(70, 66, 24, 26, 'fp-sofa', 'Lounge')}
      </>
    ),
  },
};

export function FloorPlan({
  office,
  furniture,
  employees,
  working,
  playerName,
}: {
  office: OfficeId;
  furniture: FurnitureId[];
  employees: Employee[];
  /** Work hours: people are at their desks and the lights are on. */
  working: boolean;
  playerName: string;
}) {
  const layout = LAYOUTS[office];
  const remote = OFFICES[office].remote;
  const active = new Set(activeFurniture(office, furniture));
  // Your desk comes first, then one desk per seat.
  const seats = remote ? [layout.desks[0]] : layout.desks.slice(0, OFFICES[office].capacity + 1);

  return (
    <div className={`floorplan fp-${office} ${working ? '' : 'fp-off'}`} role="img" aria-label={`Floor plan of ${OFFICES[office].name}`}>
      {layout.decor}

      {seats.map(([x, y], i) => {
        const person = i === 0 ? null : employees[i - 1];
        const here = i === 0 || (working && !!person);
        return (
          <div key={i} className="fp-desk" style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}>
            <div className="fp-desk-top">
              <i />
            </div>
            {here && (
              <motion.div
                className="fp-person"
                animate={working ? { y: [0, -2, 0] } : undefined}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
              >
                <Avatar name={person?.name ?? playerName} text={person ? person.name[0] : 'You'} size={i === 0 ? 30 : 26} />
              </motion.div>
            )}
          </div>
        );
      })}

      {FURNITURE_ORDER.map((f, i) =>
        active.has(f) ? (
          <motion.div
            key={f}
            className="fp-item"
            style={{ left: `${layout.slots[i][0]}%`, top: `${layout.slots[i][1]}%` }}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            title={FURNITURE[f].name}
          >
            {FURNITURE[f].icon}
          </motion.div>
        ) : null,
      )}

      {/* In your bedroom, staff join on video calls. */}
      {remote && employees.length > 0 && (
        <div className="fp-calls">
          <span className="fp-calls-label">{working ? 'On a video call' : 'Offline'}</span>
          <div className="row" style={{ gap: 4 }}>
            {employees.map((e) => (
              <div key={e.id} style={{ opacity: working ? 1 : 0.35 }}>
                <Avatar name={e.name} text={e.name[0]} size={24} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!working && <div className="fp-night">Lights off &middot; back at 9 AM</div>}
    </div>
  );
}
