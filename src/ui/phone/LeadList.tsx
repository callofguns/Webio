import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { INDUSTRIES, WEBSITE_LABELS } from '../../game/businesses';
import type { Business } from '../../game/types';
import { Tabs } from '../components/Tabs';
import { spring } from '../motion';
import { statusBadge } from './labels';

export type LeadFilter = 'todo' | 'callbacks' | 'interested' | 'all';

function sortScore(b: Business, day: number): number {
  if (b.status === 'callback' && b.callback?.day === day) return 0;
  if (b.status === 'new') return 1;
  if (b.status === 'callback') return 2;
  if (b.status === 'contacted') return 3;
  if (b.status === 'interested') return 4;
  return 5;
}

export function LeadList(props: {
  filter: LeadFilter;
  onFilter: (f: LeadFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  const { businesses, day } = useGame();
  const shown = businesses
    .filter((b) => {
      switch (props.filter) {
        case 'todo':
          return b.status === 'new' || b.status === 'contacted' || b.status === 'callback';
        case 'callbacks':
          return b.status === 'callback';
        case 'interested':
          return b.status === 'interested';
        default:
          return true;
      }
    })
    .sort((a, b) => sortScore(a, day) - sortScore(b, day));

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <Tabs
          id="lead-filter"
          value={props.filter}
          onChange={props.onFilter}
          options={[
            { value: 'todo', label: 'To call' },
            { value: 'callbacks', label: 'Callbacks' },
            { value: 'interested', label: 'Interested' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <div className="lead-list">
        {shown.length === 0 && <div className="empty">Nothing here. Search the directory to find more businesses.</div>}
        <AnimatePresence initial={false}>
          {shown.map((b) => {
            const badge = statusBadge(b, day);
            const selected = b.id === props.selectedId;
            return (
              <motion.button
                key={b.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className={`lead-row ${props.locked && !selected ? 'dim' : ''}`}
                onClick={() => props.onSelect(b.id)}
              >
                {selected && <motion.div layoutId="lead-sel" className="sel-bg" transition={spring} />}
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="name">{b.name}</span>
                  <span className={`badge ${badge.tone}`}>{badge.text}</span>
                </div>
                <span className="small muted">
                  {INDUSTRIES[b.industry].label}
                  {b.researched && ` · ${WEBSITE_LABELS[b.website]}`}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
