import { useGame } from '../../game/store';
import { isBuilder } from '../../game/roles';
import { Avatar } from '../components/Avatar';

const ROLE_WORD = { designer: 'design', developer: 'dev', sales: 'sales', pm: 'PM', support: 'support', qa: 'QA' } as const;

/** Small badges for the people on your team who are working on a project, with a live dot while they're at it. */
export function WorkerChips({ projectId, showEmpty }: { projectId: string; showEmpty?: boolean }) {
  const employees = useGame((s) => s.employees);
  // Builders and testers work on a specific project.
  const crew = employees.filter((e) => (isBuilder(e.role) || e.role === 'qa') && e.assignedProjectId === projectId);

  if (crew.length === 0) {
    return showEmpty && employees.some((e) => isBuilder(e.role)) ? <span className="small faint">Nobody on your team is on this one</span> : null;
  }
  return (
    <div className="worker-chips" aria-label="Who is working on this">
      {crew.map((e) => {
        const busy = /^(Working|Testing|Polishing|Fixing|Planned|Asking|Started)/.test(e.today.note) && e.today.hours > 0;
        const training = !!e.training;
        return (
          <span key={e.id} className={`worker-chip ${busy ? 'busy' : ''}`} title={`${e.name}: ${e.today.note || 'ready to work'}`}>
            <Avatar name={e.name} text={e.name[0]} size={20} />
            <span>
              {e.name.split(' ')[0]} <em>{training ? 'training' : ROLE_WORD[e.role]}</em>
            </span>
            <i className="dot" aria-hidden />
          </span>
        );
      })}
    </div>
  );
}
