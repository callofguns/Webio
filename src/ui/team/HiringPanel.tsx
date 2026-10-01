import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DAY_HARD_END, useGame } from '../../game/store';
import { TEST_TASK_COST } from '../../game/balance';
import { OFFICES } from '../../game/office';
import { BOARDS, INTERVIEW_MINUTES, marketPay, POST_DAYS, ROLES, TEST_MINUTES, type OfferResult } from '../../game/team';
import type { Applicant, JobBoard, Role } from '../../game/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Tabs } from '../components/Tabs';
import { money } from '../components/AnimatedNumber';
import { spring } from '../motion';
import { initials, LEVEL_NAMES, LevelDots, TraitBadges } from './common';

function Stepper({ value, onChange, step = 5, min = 20 }: { value: number; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <div className="stepper">
      <Button size="sm" disabled={value <= min} onClick={() => onChange(value - step)} aria-label="Less">&minus;</Button>
      <span className="val num" style={{ minWidth: 70 }}>{money(value)}/day</span>
      <Button size="sm" onClick={() => onChange(value + step)} aria-label="More">+</Button>
    </div>
  );
}

function PostJob() {
  const { reputation, money: cash, jobPosts, postJob } = useGame();
  const [role, setRole] = useState<Role>('sales');
  const [board, setBoard] = useState<JobBoard>('free');
  const [pay, setPay] = useState(marketPay('sales', 2));
  const info = BOARDS[board];
  const duplicate = jobPosts.some((p) => p.role === role && p.board === board);

  return (
    <div className="card">
      <div className="card-title">
        <h2>Post a job</h2>
      </div>
      <Tabs
        id="post-role"
        value={role}
        onChange={(r) => {
          setRole(r);
          setPay(marketPay(r, 2));
        }}
        options={(Object.keys(ROLES) as Role[]).map((r) => ({ value: r, label: ROLES[r].label }))}
      />
      <p className="small muted" style={{ margin: '8px 0 14px' }}>{ROLES[role].does}</p>

      <div className="field-label">Where to post</div>
      <div className="stack" style={{ gap: 6 }}>
        {(Object.keys(BOARDS) as JobBoard[]).map((b) => {
          const o = BOARDS[b];
          const locked = reputation < o.reputation;
          return (
            <button key={b} className={`option ${board === b ? 'on' : ''}`} disabled={locked} onClick={() => setBoard(b)}>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span className="o-name">{o.label}</span>
                <span className="small num" style={{ fontWeight: 600 }}>{o.cost ? `${money(o.cost)} / week` : 'Free'}</span>
              </span>
              <span className="o-sub">{locked ? `Needs ${o.reputation} reputation (you have ${reputation})` : o.description}</span>
            </button>
          );
        })}
      </div>

      <div className="form-row" style={{ marginTop: 8 }}>
        <div>
          <div style={{ fontWeight: 500 }}>Pay offered</div>
          <div className="small faint">
            Beginners want ~{money(marketPay(role, 1))}, seniors ~{money(marketPay(role, 4))}. Paying more attracts better people.
          </div>
        </div>
        <Stepper value={pay} onChange={setPay} />
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <span className="small muted">Runs for {POST_DAYS} days</span>
        <Button variant="primary" disabled={duplicate || cash < info.cost || reputation < info.reputation} onClick={() => postJob(role, board, pay)}>
          {duplicate ? 'Already posted' : `Post job${info.cost ? ` · ${money(info.cost)}` : ''}`}
        </Button>
      </div>
    </div>
  );
}

function OfferModal({ applicant, onClose }: { applicant: Applicant; onClose: () => void }) {
  const makeOffer = useGame((s) => s.makeOffer);
  const [pay, setPay] = useState(applicant.counter ?? applicant.askingPay);
  const [result, setResult] = useState<OfferResult | null>(null);
  const shownLevel = applicant.tested ? applicant.level : applicant.claimedLevel;

  return (
    <>
      <h2>Offer {applicant.name} a job</h2>
      {!result || result.kind === 'counter' ? (
        <>
          <p className="muted" style={{ marginTop: 8 }}>
            They asked for {money(applicant.askingPay)}/day. The going rate for a {LEVEL_NAMES[shownLevel].toLowerCase()}{' '}
            {ROLES[applicant.role].label.toLowerCase()} is about {money(marketPay(applicant.role, shownLevel))}.
          </p>
          {result?.kind === 'counter' && (
            <div className="banner info" style={{ marginTop: 12 }}>
              &ldquo;I&rsquo;d need at least {money(result.pay)}/day.&rdquo;
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', margin: '18px 0' }}>
            <span style={{ fontWeight: 500 }}>Daily pay</span>
            <Stepper value={pay} onChange={setPay} />
          </div>
          <p className="small faint">Paid every Friday, about {money(pay * 5)} a week. Underpaid people get unhappy and quit.</p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => setResult(makeOffer(applicant.id, pay))}>
              Send offer
            </Button>
          </div>
        </>
      ) : (
        <>
          <p style={{ marginTop: 10 }} className={result.kind === 'accept' ? '' : 'muted'}>
            {result.kind === 'accept' ? `${applicant.name} said yes! They start working right away.` : `“${result.reason}”`}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function ApplicantCard({ a, onOffer }: { a: Applicant; onOffer: () => void }) {
  const { day, minute, money: cash, employees, activeCall, interviewApplicant, testApplicant, rejectApplicant } = useGame();
  const onCall = !!activeCall && activeCall.phase !== 'ended';
  const leavesIn = a.leavesDay - day;
  const capacity = useGame((s) => OFFICES[s.office].capacity);
  const full = employees.length >= capacity;

  return (
    <motion.div layout className="card stack" style={{ gap: 10 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring}>
      <div className="row" style={{ gap: 12 }}>
        <Avatar name={a.name} text={initials(a.name)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{a.name}</h2>
          <p className="small muted">
            {ROLES[a.role].label} &middot; {a.years} year{a.years === 1 ? '' : 's'} experience
          </p>
        </div>
        <span className={`badge ${leavesIn <= 1 ? 'bad' : leavesIn <= 2 ? 'warn' : ''}`}>{leavesIn <= 0 ? 'Leaving today' : `Available ${leavesIn} more days`}</span>
      </div>

      <div>
        <div className="small faint" style={{ marginBottom: 2 }}>{a.tested ? 'Real skill (from test task)' : 'Résumé says'}</div>
        <LevelDots level={a.tested ? a.level : a.claimedLevel} faded={!a.tested} />
        {a.tested && a.level < a.claimedLevel && <div className="small" style={{ color: 'var(--bad)', marginTop: 2 }}>Their résumé said {LEVEL_NAMES[a.claimedLevel]}. It was exaggerated.</div>}
      </div>

      <div className="chip-list">
        {a.interviewed ? (a.knownTraits.length ? <TraitBadges traits={a.knownTraits} /> : <span className="badge">Nothing stood out</span>) : <span className="badge">Interview to learn more</span>}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">Asking</span>
        <span className="num" style={{ fontWeight: 600 }}>{money(a.counter ?? a.askingPay)}/day</span>
      </div>

      <div className="row wrap">
        <Button size="sm" disabled={a.interviewed || onCall || minute + INTERVIEW_MINUTES > DAY_HARD_END} onClick={() => interviewApplicant(a.id)}>
          {a.interviewed ? 'Interviewed' : `Interview · ${INTERVIEW_MINUTES / 60} hr`}
        </Button>
        <Button size="sm" disabled={a.tested || onCall || cash < TEST_TASK_COST || minute + TEST_MINUTES > DAY_HARD_END} onClick={() => testApplicant(a.id)}>
          {a.tested ? 'Tested' : `Test task · ${TEST_MINUTES} min, ${money(TEST_TASK_COST)}`}
        </Button>
        <Button size="sm" variant="primary" disabled={full} onClick={onOffer}>
          Make offer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => rejectApplicant(a.id)}>
          Pass
        </Button>
      </div>
    </motion.div>
  );
}

export function HiringPanel() {
  const { applicants, jobPosts, employees, day, office, closeJobPost } = useGame();
  const [offerId, setOfferId] = useState<string | null>(null);
  const offering = applicants.find((a) => a.id === offerId) ?? null;
  // Keep showing the modal's result even after the applicant is removed.
  const [lastOffering, setLastOffering] = useState<Applicant | null>(null);
  const modalApplicant = offering ?? lastOffering;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {employees.length >= OFFICES[office].capacity && (
        <div className="banner info">
          {OFFICES[office].name} only fits {OFFICES[office].capacity} employee{OFFICES[office].capacity === 1 ? '' : 's'}. Move somewhere bigger on the Office
          screen to make room.
        </div>
      )}
      <div className="team-hiring">
        <div className="stack" style={{ gap: 16 }}>
          <PostJob />
          {jobPosts.length > 0 && (
            <div className="card">
              <div className="card-title">
                <h2>Your job posts</h2>
              </div>
              {jobPosts.map((p) => (
                <div key={p.id} className="meter-row" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <strong>{ROLES[p.role].label}</strong>
                    <span className="small muted">
                      {' '}
                      &middot; {BOARDS[p.board].label} &middot; {money(p.pay)}/day &middot; {p.endsDay - day} days left
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => closeJobPost(p.id)}>
                    Close
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <h2>Applicants ({applicants.length})</h2>
          {applicants.length === 0 && (
            <div className="card empty">{jobPosts.length ? 'No one yet. People apply overnight, so check back tomorrow.' : 'Post a job to get applicants.'}</div>
          )}
          <AnimatePresence initial={false}>
            {applicants.map((a) => (
              <ApplicantCard
                key={a.id}
                a={a}
                onOffer={() => {
                  setOfferId(a.id);
                  setLastOffering(a);
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <Modal open={offerId !== null}>
        {modalApplicant && (
          <OfferModal
            key={modalApplicant.id}
            applicant={modalApplicant}
            onClose={() => {
              setOfferId(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
