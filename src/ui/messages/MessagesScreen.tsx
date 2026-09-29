import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { dealStatus, toGameTime, unreadCount, type DealStatus } from '../../game/deals';
import { Icon } from '../components/Icon';
import { fadeUp } from '../motion';
import { ThreadList } from './ThreadList';
import { ChatView } from './ChatView';
import { ClientNotes } from './ClientNotes';

const ORDER: Record<DealStatus, number> = { your_turn: 0, waiting: 1, won: 2, lost: 3 };

export function MessagesScreen() {
  const { deals, businesses, day, minute } = useGame();
  const now = toGameTime(day, minute);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...deals].sort((a, b) => {
    const byStatus = ORDER[dealStatus(a, now)] - ORDER[dealStatus(b, now)];
    return byStatus || unreadCount(b, now) - unreadCount(a, now);
  });
  const selected = deals.find((d) => d.id === selectedId) ?? sorted[0] ?? null;
  const biz = selected ? businesses.find((b) => b.id === selected.businessId)! : null;
  const yourTurn = deals.filter((d) => dealStatus(d, now) === 'your_turn').length;

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Messages</h1>
          <p className="muted">
            {deals.length === 0
              ? 'Businesses that say yes on the phone show up here.'
              : yourTurn > 0
                ? `${yourTurn} client${yourTurn > 1 ? 's are' : ' is'} waiting on you. Don’t leave them hanging.`
                : 'Everyone’s been answered. Replies come in as time passes.'}
          </p>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="card empty" style={{ padding: 64 }}>
          <Icon name="chat" size={28} />
          <p style={{ marginTop: 10 }}>No conversations yet. Get someone interested on the phone first.</p>
        </div>
      ) : (
        <div className="messages-layout">
          <ThreadList deals={sorted} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          <AnimatePresence mode="wait">
            {selected && biz && (
              <motion.div key={selected.id} {...fadeUp}>
                <ChatView deal={selected} biz={biz} />
              </motion.div>
            )}
          </AnimatePresence>
          {selected && biz && <ClientNotes deal={selected} biz={biz} />}
        </div>
      )}
    </div>
  );
}
