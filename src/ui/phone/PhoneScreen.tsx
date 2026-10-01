import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { callBlocker, DAY_HARD_END, useGame } from '../../game/store';
import { DIRECTORY_SEARCH_MINUTES, LEAD_LIST_COST, LEAD_LIST_SIZE } from '../../game/balance';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { fadeUp } from '../motion';
import { LeadList, visibleLeads, type LeadFilter } from './LeadList';
import { LeadDetail } from './LeadDetail';
import { CallView } from './CallView';
import { useIsMobile } from '../useIsMobile';
import { BackButton } from '../components/BackButton';

export function PhoneScreen() {
  const { businesses, activeCall, day, minute, money, searchDirectory, buyLeadList } = useGame();
  const [filter, setFilter] = useState<LeadFilter>('todo');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const callable = businesses.filter((b) => !callBlocker(b, day, minute)).length;
  const selected = businesses.find((b) => b.id === (activeCall?.businessId ?? selectedId)) ?? null;
  const busy = !!activeCall;
  const mobile = useIsMobile();
  // On phones, show either the list or the selected business, not both.
  const showDetail = !mobile || !!selected;
  const showList = !mobile || !selected;
  const midCall = !!activeCall && activeCall.phase !== 'ended';

  // After a call, jump straight to the next business you can call: first in
  // this list, then in the "To call" list if this one has nobody left.
  const nextUp = (() => {
    if (!activeCall || activeCall.phase !== 'ended') return null;
    const notThis = (b: (typeof businesses)[number]) => b.id !== activeCall.businessId && !callBlocker(b, day, minute);
    const here = visibleLeads(businesses, filter, day).find(notThis);
    if (here) return { biz: here, filter };
    const todo = visibleLeads(businesses, 'todo', day).find(notThis);
    return todo ? { biz: todo, filter: 'todo' as const } : null;
  })();
  const finishCall = () => {
    useGame.getState().closeCall();
    if (!nextUp) return;
    setFilter(nextUp.filter);
    setSelectedId(nextUp.biz.id);
  };

  return (
    <div className="screen">
      {mobile && selected && (
        <BackButton
          label="All businesses"
          disabled={midCall}
          onClick={() => {
            if (activeCall) useGame.getState().closeCall();
            setSelectedId(null);
          }}
        />
      )}
      {showList && <div className="screen-head">
        <div>
          <h1>Phone</h1>
          <p className="muted">
            {businesses.length} businesses on your list &middot; {callable} you can call right now
          </p>
        </div>
        <div className="row wrap">
          <Button disabled={busy || minute + DIRECTORY_SEARCH_MINUTES > DAY_HARD_END} onClick={searchDirectory} title="Free, but takes time">
            <Icon name="search" size={16} /> Search directory &middot; {DIRECTORY_SEARCH_MINUTES} min
          </Button>
          <Button disabled={busy || money < LEAD_LIST_COST} onClick={buyLeadList} title={`${LEAD_LIST_SIZE} businesses`}>
            <Icon name="list" size={16} /> Buy {LEAD_LIST_SIZE} leads &middot; ${LEAD_LIST_COST}
          </Button>
        </div>
      </div>}

      <div className="phone-layout">
        {showList && (
          <LeadList filter={filter} onFilter={setFilter} selectedId={selected?.id ?? null} onSelect={(id) => !busy && setSelectedId(id)} locked={busy} />
        )}
        {showDetail && <AnimatePresence mode="wait">
          {activeCall && selected ? (
            <motion.div key={activeCall.id} {...fadeUp}>
              <CallView call={activeCall} biz={selected} onDone={finishCall} nextName={nextUp?.biz.name} />
            </motion.div>
          ) : selected ? (
            <motion.div key={selected.id} {...fadeUp}>
              <LeadDetail biz={selected} />
            </motion.div>
          ) : (
            <motion.div key="none" className="card empty" {...fadeUp} style={{ padding: 64 }}>
              <Icon name="phone" size={28} />
              <p style={{ marginTop: 10 }}>Pick a business from the list to see its details and call it.</p>
            </motion.div>
          )}
        </AnimatePresence>}
      </div>
    </div>
  );
}
