import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DAY_HARD_END, useGame } from '../../game/store';
import { dealStatus, FEATURES, fromGameTime, OPEN_QUOTE, textChoices, toGameTime, visibleMessages } from '../../game/deals';
import { vibe } from '../../game/calls';
import type { Business, Deal, Quote, TextMessage } from '../../game/types';
import { formatClock } from '../../game/time';
import { Button } from '../components/Button';
import { money } from '../components/AnimatedNumber';
import { spring } from '../motion';
import { QuoteBuilder } from './QuoteBuilder';
import { useNumberKeys } from '../useNumberKeys';
import { Burst, stamp } from '../components/Burst';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { retainerFee } from '../../game/pricing';
import { Modal } from '../components/Modal';

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <div className="quote-card">
      <div className="small faint" style={{ marginBottom: 6, fontWeight: 600 }}>QUOTE</div>
      <div className="qc-row">
        <span className="muted">Pages</span>
        <span>{quote.pages}</span>
      </div>
      {quote.features.map((f) => (
        <div key={f} className="qc-row">
          <span className="muted">{FEATURES[f].label}</span>
          <span>&#10003;</span>
        </div>
      ))}
      <div className="qc-row">
        <span className="muted">Ready in</span>
        <span>{quote.days} days</span>
      </div>
      {(quote.plan ?? 'buyout') === 'buyout' && (
        <div className="qc-row">
          <span className="muted">Deposit</span>
          <span>{quote.depositPct ? `${quote.depositPct}% up front` : 'None'}</span>
        </div>
      )}
      {quote.plan === 'retainer' ? (
        <>
          <div className="qc-row">
            <span className="muted">Covers</span>
            <span>Hosting &amp; upkeep</span>
          </div>
          <div className="qc-row qc-total">
            <span>Monthly</span>
            <span className="num">{money(retainerFee(quote.price))}/mo</span>
          </div>
        </>
      ) : quote.plan === 'either' ? (
        <>
          <div className="qc-row qc-total">
            <span>Buy it</span>
            <span className="num">{money(quote.price)}</span>
          </div>
          <div className="qc-row qc-total">
            <span>Or monthly</span>
            <span className="num">{money(retainerFee(quote.price))}/mo</span>
          </div>
        </>
      ) : (
        <div className="qc-row qc-total">
          <span>Total</span>
          <span className="num">{money(quote.price)}</span>
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: TextMessage }) {
  const time = formatClock(fromGameTime(m.t).minute);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'you' ? 'flex-end' : m.from === 'them' ? 'flex-start' : 'center' }}
    >
      {m.text && (
        <div className={`bubble ${m.from}`}>
          {m.text}
          {m.from !== 'system' && <span className="msg-time">{time}</span>}
        </div>
      )}
      {m.quote && <div style={{ marginTop: 6, width: '100%', display: 'flex', justifyContent: 'flex-end' }}><QuoteCard quote={m.quote} /></div>}
    </motion.div>
  );
}

export function ChatView({ deal, biz }: { deal: Deal; biz: Business }) {
  const { day, minute, activeCall, projects, sendText, markRead, wait, deleteLostDeals } = useGame();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = toGameTime(day, minute);
  const [quoting, setQuoting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const messages = visibleMessages(deal, now);
  const status = dealStatus(deal, now);
  const first = biz.ownerName.split(' ')[0];
  const mood = vibe(deal.warmth);
  const onCall = !!activeCall && activeCall.phase !== 'ended';
  const tooLate = minute + 3 > DAY_HARD_END;
  const choices = textChoices(deal, biz);
  const pickText = (id: string) => (id === OPEN_QUOTE ? setQuoting(true) : sendText(deal.id, id));
  // Press 1-5 to pick a text.
  useNumberKeys(choices.length, (i) => pickText(choices[i].id), status === 'your_turn' && !onCall && !tooLate);
  const project = projects.find((p) => p.dealId === deal.id);

  useEffect(() => {
    markRead(deal.id);
    bottom.current?.parentElement?.scrollTo({ top: bottom.current.offsetTop, behavior: 'smooth' });
  }, [messages.length, deal.id, markRead]);

  let lastDay = 0;

  return (
    <div className="card chat">
      <div className="call-head">
        <Avatar name={biz.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{biz.name}</h2>
          <p className="small muted">Texting {first}</p>
        </div>
        {(status === 'your_turn' || status === 'waiting') && (
          <div className="vibe" title="How keen they are">
            <span className="small muted">{mood.label}</span>
            <div className="vibe-bar">
              {[1, 2, 3, 4, 5].map((i) => (
                <i key={i} className={i <= mood.step ? 'on' : ''} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="transcript">
        {messages.map((m) => {
          const msgDay = fromGameTime(m.t).day;
          const sep = msgDay !== lastDay;
          lastDay = msgDay;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep && <div className="day-sep">Day {msgDay}</div>}
              <Bubble m={m} />
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <AnimatePresence mode="wait">
        {status === 'your_turn' && (
          <motion.div key={`choices-${messages.length}`} className="choices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            <span className="small faint">
              {onCall ? 'Finish your call first.' : tooLate ? 'It’s too late to text. End the day.' : deal.stage === 'negotiating' ? 'They want a lower price. What do you do?' : 'What do you text?'}
            </span>
            {choices.map((c, i) => (
              <motion.button
                key={c.id}
                className="choice"
                disabled={onCall || tooLate}
                onClick={() => pickText(c.id)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.04 }}
                whileTap={{ scale: 0.985 }}
                style={c.id === OPEN_QUOTE ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 650 } : undefined}
              >
                <span className="key">{i + 1}</span>
                <span className="choice-text">
                  {c.label}
                  {c.hint && <span className="hint">{c.hint}</span>}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
        {status === 'waiting' && (
          <motion.div key="waiting" className="choices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="waiting">
              <span className="muted">
                Waiting for {first} to reply&hellip;
                <span className="small faint" style={{ display: 'block' }}>Replies arrive as time passes. Make some calls meanwhile.</span>
              </span>
              <div className="row">
                <Button size="sm" disabled={onCall || minute >= DAY_HARD_END} onClick={() => wait(30)}>Wait 30 min</Button>
                <Button size="sm" disabled={onCall || minute >= DAY_HARD_END} onClick={() => wait(60)}>Wait 1 hr</Button>
              </div>
            </div>
          </motion.div>
        )}
        {status === 'won' && (
          <motion.div key="won" className="choices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {(() => {
                const signed = (
                  <motion.span className="badge good outcome-stamp" {...stamp}>
                    Contract signed &middot; {deal.plan === 'retainer' ? `${money(retainerFee(deal.agreedPrice ?? 0))}/month` : money(deal.agreedPrice ?? 0)}
                  </motion.span>
                );
                // Confetti only for a fresh win, not every time you reopen the chat.
                return now - (deal.closedAt ?? 0) < 24 * 60 ? <Burst>{signed}</Burst> : signed;
              })()}
              {project && project.depositPaid > 0 && <span className="small muted">{money(project.depositPaid)} deposit paid</span>}
            </div>
            <span className="small faint">
              {project?.status === 'delivered'
                ? `Site delivered. They rated it ${project.stars} out of 5.`
                : project?.status === 'review'
                  ? 'They\u2019re looking at the site you sent.'
                  : `Due on day ${project?.dueDay}. Build it in the Projects tab.`}
            </span>
          </motion.div>
        )}
        {status === 'lost' && (
          <motion.div key="lost" className="choices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <span className="badge bad" style={{ alignSelf: 'flex-start' }}>Deal lost</span>
            <span className="small faint">You can try calling them again in about a month.</span>
            <Button size="sm" variant="ghost" style={{ alignSelf: 'flex-start', color: 'var(--bad)', padding: 0 }} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={15} /> Delete conversation
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <QuoteBuilder open={quoting} deal={deal} biz={biz} onClose={() => setQuoting(false)} />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2>Delete this conversation?</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          The texts with {biz.name} will be removed for good. You can still call them again once they&rsquo;ve cooled off.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button
            variant="primary"
            style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => {
              setConfirmDelete(false);
              deleteLostDeals([deal.id]);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
