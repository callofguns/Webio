import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { vibe, type CallOutcome, type CallState } from '../../game/calls';
import type { Business } from '../../game/types';
import { formatHour } from '../../game/time';
import { Button } from '../components/Button';
import { spring } from '../motion';
import { AnswerTimer } from './AnswerTimer';
import { CALL_CHOICE_SECONDS } from '../../game/balance';

/** How long to wait before showing each kind of line, so the call feels live. */
const DELAY = { system: 450, them: 1000, you: 120 };

function outcomeInfo(call: CallState): { text: string; tone: string } {
  const map: Record<CallOutcome, { text: string; tone: string }> = {
    interested: { text: 'Interested — they’re waiting for your text', tone: 'good' },
    callback: { text: call.callback ? `Call back on day ${call.callback.day} around ${formatHour(call.callback.hour)}` : 'Call back later', tone: 'warn' },
    no_answer: { text: 'No answer', tone: '' },
    voicemail_left: { text: 'Voicemail left — they might call back', tone: '' },
    blocked: { text: 'Couldn’t get past the front desk', tone: 'bad' },
    not_interested: { text: 'Not interested', tone: 'bad' },
    do_not_call: { text: 'Asked you to never call again', tone: 'bad' },
  };
  return map[call.outcome!];
}

function Typing() {
  return (
    <motion.div className="bubble them typing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
      ))}
    </motion.div>
  );
}

export function CallView({ call, biz, onDone, nextName }: { call: CallState; biz: Business; onDone?: () => void; nextName?: string }) {
  const { choose, closeCall, callTimedOut } = useGame();
  // Reveal lines one at a time. After a page reload, only replay the last couple.
  const [shown, setShown] = useState(() => Math.max(0, call.lines.length - 2));
  const bottom = useRef<HTMLDivElement>(null);
  const caughtUp = shown >= call.lines.length;
  const next = call.lines[shown];

  useEffect(() => {
    if (caughtUp) return;
    // Line 0 is "Calling…". Line 1 waits a bit longer while the phone rings.
    const delay = shown === 0 ? 0 : shown === 1 ? 1700 : DELAY[next.speaker];
    const t = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [shown, caughtUp, next]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [shown, caughtUp]);

  const v = vibe(call.interest);
  const ringing = !caughtUp && shown === 1;
  const ended = call.phase === 'ended' && caughtUp;

  return (
    <div className="card call">
      <div className="call-head">
        <div className="avatar">{biz.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{biz.name}</h2>
          <p className="small muted num">
            {biz.phone} &middot; {call.minutes} min
          </p>
        </div>
        {call.reachedOwner && caughtUp && call.lines.some((l) => l.speaker === 'you') && (
          <motion.div className="vibe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} title="How interested they seem">
            <span className="small muted">{v.label}</span>
            <div className="vibe-bar">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.i key={i} className={i <= v.step ? 'on' : ''} layout transition={spring} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="transcript">
        <AnimatePresence initial={false}>
          {call.lines.slice(0, shown).map((l) => (
            <motion.div
              key={l.id}
              className={`bubble ${l.speaker}`}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring}
            >
              {l.text}
            </motion.div>
          ))}
          {!caughtUp && next?.speaker === 'them' && !ringing && <Typing key="typing" />}
          {ringing && (
            <motion.div key="ring" className="bubble system" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
              Ringing&hellip;
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      <AnimatePresence mode="wait">
        {caughtUp && !ended && call.choices.length > 0 && (
          <motion.div key={call.lines.length} className="choices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span className="small faint">{call.phase === 'opener' ? 'How do you open?' : call.phase === 'close' ? 'What do you ask for?' : 'What do you say?'}</span>
              {/* A new timer starts for every answer. */}
              <AnswerTimer key={call.lines.length} seconds={CALL_CHOICE_SECONDS} onExpire={callTimedOut} />
            </div>
            {call.choices.map((c, i) => (
              <motion.button
                key={c.id}
                className="choice"
                disabled={c.disabled}
                onClick={() => choose(c.id)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.04 }}
                whileTap={c.disabled ? undefined : { scale: 0.985 }}
              >
                {c.label}
                {c.hint && <span className="hint">{c.hint}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
        {ended && (
          <motion.div key="end" className="choices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className={`badge ${outcomeInfo(call).tone}`}>{outcomeInfo(call).text}</span>
              <span className="small faint num">+{call.xp} sales XP</span>
            </div>
            <Button variant="primary" onClick={onDone ?? closeCall}>
              {nextName ? `Next: ${nextName} \u2192` : 'Done'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
