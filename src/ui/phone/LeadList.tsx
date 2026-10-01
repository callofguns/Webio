import { useEffect, useRef } from 'react';
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

/** The businesses shown for a filter, in list order. Also used to pick the next one to call. */
export function visibleLeads(businesses: Business[], filter: LeadFilter, day: number): Business[] {
  return businesses
    .filter((b) => {
      switch (filter) {
        case 'todo':
          return b.status === 'new' || b.status === 'contacted' || b.status === 'callback';
        case 'callbacks':
          return b.status === 'callback';
        case 'interested':
          return b.status === 'interested' || b.status === 'client';
        default:
          return true;
      }
    })
    .sort((a, b) => sortScore(a, day) - sortScore(b, day));
}

export function LeadList(props: {
  filter: LeadFilter;
  onFilter: (f: LeadFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  const { businesses, day } = useGame();
  const shown = visibleLeads(businesses, props.filter, day);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected business in view, e.g. when the next one opens after a call.
  useEffect(() => {
    if (!props.selectedId) return;
    listRef.current?.querySelector(`[data-id="${props.selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [props.selectedId]);

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
            { value: 'interested', label: 'Won' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <div className="lead-list" ref={listRef}>
        {shown.length === 0 && <div className="empty">Nothing here. Search the directory to find more businesses.</div>}
        <AnimatePresence initial={false}>
          {shown.map((b) => {
            const badge = statusBadge(b, day);
            const selected = b.id === props.selectedId;
            return (
              <motion.button
                key={b.id}
                data-id={b.id}
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
