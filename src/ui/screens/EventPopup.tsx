import { useGame } from '../../game/store';
import { describeEvent } from '../../game/events';
import { Modal } from '../components/Modal';

/** A random event. It waits for your answer, so it can't be swiped away. */
export function EventPopup() {
  const ev = useGame((s) => s.event);
  const summaryOpen = useGame((s) => !!s.lastDaySummary);
  const projects = useGame((s) => s.projects);
  const deals = useGame((s) => s.deals);
  const employees = useGame((s) => s.employees);
  const businesses = useGame((s) => s.businesses);
  const resolve = useGame((s) => s.resolveEvent);

  const project = ev ? projects.find((p) => p.id === ev.targetId) : undefined;
  const deal = ev ? deals.find((d) => d.id === ev.targetId) : undefined;
  const employee = ev ? employees.find((e) => e.id === ev.targetId) : undefined;
  const biz = businesses.find((b) => b.id === (project ?? deal)?.businessId);
  const view = ev ? describeEvent(ev, { project, deal, employee, biz }) : null;

  return (
    <Modal open={!!view && !summaryOpen}>
      {view && (
        <div className="event-card">
          <div className="event-icon" aria-hidden>
            {view.icon}
          </div>
          <p className="small faint">Something happened</p>
          <h2 style={{ fontSize: 20, marginTop: 2 }}>{view.title}</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {view.text}
          </p>
          <div className="stack" style={{ gap: 10, marginTop: 16 }}>
            {view.choices.map((c) => (
              <button key={c.id} className="option" style={{ padding: '12px 14px' }} onClick={() => resolve(c.id)}>
                <span className="o-name" style={{ fontSize: 15 }}>
                  {c.label}
                </span>
                <span className="o-sub" style={{ fontSize: 13 }}>
                  {c.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
