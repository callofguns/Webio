import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { dealStatus, toGameTime, unreadCount, visibleMessages, type DealStatus } from '../../game/deals';
import type { Deal } from '../../game/types';
import { spring } from '../motion';

export const STATUS_BADGE: Record<DealStatus, { text: string; tone: string }> = {
  your_turn: { text: 'Your turn', tone: 'accent' },
  waiting: { text: 'Waiting', tone: '' },
  won: { text: 'Signed', tone: 'good' },
  lost: { text: 'Lost', tone: 'bad' },
};

export function ThreadList({ deals, selectedId, onSelect }: { deals: Deal[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const { businesses, day, minute } = useGame();
  const now = toGameTime(day, minute);

  return (
    <div className="card" style={{ padding: 8 }}>
      <div className="thread-list">
        {deals.map((d) => {
          const biz = businesses.find((b) => b.id === d.businessId)!;
          const last = visibleMessages(d, now).at(-1);
          const status = STATUS_BADGE[dealStatus(d, now)];
          const unread = unreadCount(d, now) > 0;
          const selected = d.id === selectedId;
          return (
            <motion.button key={d.id} layout="position" transition={spring} className="thread-row" onClick={() => onSelect(d.id)}>
              {selected && <motion.div layoutId="thread-sel" className="sel-bg" transition={spring} />}
              <div className="avatar" style={{ width: 36, height: 36 }}>{biz.name[0]}</div>
              <div className="thread-main">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: unread ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.name}</span>
                  <span className={`badge ${status.tone}`}>{status.text}</span>
                </div>
                <div className="preview">
                  {last?.from === 'you' && 'You: '}
                  {last?.quote ? 'Sent a quote' : last?.text}
                </div>
              </div>
              {unread && <span className="unread" aria-label="Unread" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
