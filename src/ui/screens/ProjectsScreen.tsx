import { useGame } from '../../game/store';
import { FEATURES } from '../../game/deals';
import { Icon } from '../components/Icon';
import { money } from '../components/AnimatedNumber';

export function ProjectsScreen() {
  const { projects, businesses, day } = useGame();

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Signed contracts. Building the sites comes in part 3.</p>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="card empty" style={{ padding: 64 }}>
          <Icon name="layout" size={28} />
          <p style={{ marginTop: 10 }}>No contracts yet. Win a deal in Messages first.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {projects.map((p) => {
            const biz = businesses.find((b) => b.id === p.businessId)!;
            const daysLeft = p.dueDay - day;
            return (
              <div key={p.id} className="card stack" style={{ gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2>{biz.name}</h2>
                  <span className={`badge ${daysLeft < 0 ? 'bad' : daysLeft <= 3 ? 'warn' : ''}`}>
                    {daysLeft < 0 ? `${-daysLeft}d late` : `Due in ${daysLeft}d`}
                  </span>
                </div>
                <div className="chip-list">
                  <span className="badge">{p.pages} pages</span>
                  {p.features.map((f) => (
                    <span key={f} className="badge accent">{FEATURES[f].label}</span>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Price</span>
                  <span className="num" style={{ fontWeight: 600 }}>{money(p.price)}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Still owed</span>
                  <span className="num">{money(p.price - p.depositPaid)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
