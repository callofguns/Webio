import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { callBlocker, DAY_HARD_END, useGame } from '../../game/store';
import { DIRECTORY_SEARCH_MINUTES, LEAD_LIST_COST, LEAD_LIST_SIZE } from '../../game/balance';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { fadeUp } from '../motion';
import { LeadList, type LeadFilter } from './LeadList';
import { LeadDetail } from './LeadDetail';
import { CallView } from './CallView';

export function PhoneScreen() {
  const { businesses, activeCall, day, minute, money, searchDirectory, buyLeadList } = useGame();
  const [filter, setFilter] = useState<LeadFilter>('todo');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const callable = businesses.filter((b) => !callBlocker(b, day, minute)).length;
  const selected = businesses.find((b) => b.id === (activeCall?.businessId ?? selectedId)) ?? null;
  const busy = !!activeCall;

  return (
    <div className="screen">
      <div className="screen-head">
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
      </div>

      <div className="phone-layout">
        <LeadList filter={filter} onFilter={setFilter} selectedId={selected?.id ?? null} onSelect={(id) => !busy && setSelectedId(id)} locked={busy} />
        <AnimatePresence mode="wait">
          {activeCall && selected ? (
            <motion.div key={activeCall.id} {...fadeUp}>
              <CallView call={activeCall} biz={selected} />
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
        </AnimatePresence>
      </div>
    </div>
  );
}
