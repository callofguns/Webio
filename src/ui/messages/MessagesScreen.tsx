import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { dealStatus, toGameTime, unreadCount, type DealStatus } from '../../game/deals';
import { Icon } from '../components/Icon';
import { fadeUp } from '../motion';
import { ThreadList } from './ThreadList';
import { ChatView } from './ChatView';
import { ClientNotes } from './ClientNotes';
import { useIsMobile } from '../useIsMobile';
import { BackButton } from '../components/BackButton';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useListScroll } from '../useListScroll';

const ORDER: Record<DealStatus, number> = { your_turn: 0, waiting: 1, won: 2, lost: 3 };

export function MessagesScreen() {
  const { deals, businesses, day, minute, deleteLostDeals } = useGame();
  const [confirmClear, setConfirmClear] = useState(false);
  const now = toGameTime(day, minute);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const mobile = useIsMobile();

  const sorted = [...deals].sort((a, b) => {
    const byStatus = ORDER[dealStatus(a, now)] - ORDER[dealStatus(b, now)];
    return byStatus || unreadCount(b, now) - unreadCount(a, now);
  });
  // On a big screen, open the top conversation. On a phone, start on the list.
  const selected = deals.find((d) => d.id === selectedId) ?? (mobile ? null : sorted[0]) ?? null;
  const biz = selected ? businesses.find((b) => b.id === selected.businessId)! : null;
  useListScroll(mobile && !!selected);
  const yourTurn = deals.filter((d) => dealStatus(d, now) === 'your_turn').length;
  const lost = deals.filter((d) => dealStatus(d, now) === 'lost');

  if (mobile && selected && biz) {
    return (
      <div className="screen">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <BackButton label="All messages" onClick={() => setSelectedId(null)} />
          <Button size="sm" onClick={() => setNotesOpen(true)}>
            Client notes
          </Button>
        </div>
        <ChatView deal={selected} biz={biz} />
        <Modal open={notesOpen} onClose={() => setNotesOpen(false)}>
          <ClientNotes deal={selected} biz={biz} />
          <Button block style={{ marginTop: 12 }} onClick={() => setNotesOpen(false)}>
            Close
          </Button>
        </Modal>
      </div>
    );
  }

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
        {lost.length > 0 && (
          <Button size="sm" onClick={() => setConfirmClear(true)}>
            <Icon name="trash" size={15} /> Clear lost ({lost.length})
          </Button>
        )}
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
            {!mobile && selected && biz && (
              <motion.div key={selected.id} {...fadeUp}>
                <ChatView deal={selected} biz={biz} />
              </motion.div>
            )}
          </AnimatePresence>
          {!mobile && selected && biz && <ClientNotes deal={selected} biz={biz} />}
        </div>
      )}

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)}>
        <h2>Delete {lost.length === 1 ? 'the lost conversation' : `all ${lost.length} lost conversations`}?</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Only conversations marked Lost are removed. Signed clients and open chats stay. You can still call these businesses again once they&rsquo;ve cooled off.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={() => setConfirmClear(false)}>Keep them</Button>
          <Button
            variant="primary"
            style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => {
              setConfirmClear(false);
              deleteLostDeals(lost.map((d) => d.id));
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
