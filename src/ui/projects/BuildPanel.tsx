import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DAY_HARD_END, useGame } from '../../game/store';
import { DEEP_NIGHT, LATE_NIGHT, WORKDAY_END } from '../../game/balance';
import { allTasksDone, EVENTS, FIX_MINUTES_PER_BUG, hoursLeft, MAX_POLISH, siteQuality } from '../../game/projects';
import type { Project } from '../../game/types';
import { CLAUDE_PLANS, claudeEffects } from '../../game/claude';
import { officeEffects } from '../../game/office';
import { Button } from '../components/Button';
import { softSpring, spring } from '../motion';

const FEEDBACK_TEXT: Record<string, string> = {
  bugs: 'They found bugs. Fix them, then send it again.',
  content: 'They need real text and photos. You’ve added a task to write them.',
  design: 'The look doesn’t feel like them. Change the design to match their style.',
  sections: 'They want sections their customers expect. Check the “Popular” ones.',
  quality: 'It feels rough. Polish it up before sending again.',
};

export function BuildPanel({ project }: { project: Project }) {
  const { skills, minute, activeCall, claude, office, furniture, workOnProject, testProject, fixProjectBugs, polishProject, resolveProjectEvent, submitProject } = useGame();
  const onCall = !!activeCall && activeCall.phase !== 'ended';
  const { build, testMinutes } = claudeEffects(claude);
  const playerSpeed = officeEffects(office, furniture).playerSpeed;
  const left = hoursLeft(project, skills.design.level, skills.development.level, build * playerSpeed);
  const done = allTasksDone(project);
  const quality = siteQuality(project);
  const canWork = !onCall && minute + 60 <= DAY_HARD_END && !project.pendingEvent && !done;
  const untilSix = Math.max(1, Math.floor((WORKDAY_END - minute) / 60));
  const event = project.pendingEvent ? EVENTS[project.pendingEvent] : null;
  const late = minute >= LATE_NIGHT;
  const deep = minute >= DEEP_NIGHT;
  const hasCoffee = officeEffects(office, furniture).latePenalty < 6;
  const eventRef = useRef<HTMLDivElement>(null);

  // A surprise stops your work, so make sure you can see it.
  useEffect(() => {
    if (project.pendingEvent) eventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [project.pendingEvent]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      {project.lastFeedback && project.revisions > 0 && (
        <div className="banner">
          <strong>Changes requested ({project.revisions}/2).</strong> {FEEDBACK_TEXT[project.lastFeedback]}
        </div>
      )}

      <AnimatePresence>
        {event && (
          <motion.div ref={eventRef} className="event-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
            <h3>{event.title}</h3>
            <p style={{ margin: '6px 0 12px' }}>{event.text}</p>
            <div className="stack" style={{ gap: 6 }}>
              {event.choices.map((c) => (
                <button key={c.id} className="choice" onClick={() => resolveProjectEvent(project.id, c.id)}>
                  {c.label}
                  {c.hint && <span className="hint">{c.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card">
        <div className="card-title">
          <h2>Tasks</h2>
          <span className="small muted num">{done ? 'All done' : `~${Math.ceil(left)} hrs left`}</span>
        </div>
        {project.tasks.map((t) => {
          const pct = Math.min(1, t.done / t.hours);
          return (
            <div key={t.id} className={`task ${pct >= 1 ? 'done' : ''}`}>
              <div className="task-head">
                <span>
                  {pct >= 1 ? '✓ ' : ''}
                  {t.label}
                </span>
                <span className="faint">{t.skill === 'design' ? 'Design' : 'Dev'}</span>
              </div>
              <div className={`progress ${t.skill === 'development' ? 'dev' : ''} ${pct > 0 && pct < 1 ? 'live' : ''}`}>
                <motion.div initial={false} animate={{ width: `${pct * 100}%` }} transition={softSpring} />
              </div>
            </div>
          );
        })}
        <div className="row wrap" style={{ marginTop: 14 }}>
          <Button variant="primary" disabled={!canWork} onClick={() => workOnProject(project.id, 1)}>
            Work 1 hr
          </Button>
          <Button disabled={!canWork} onClick={() => workOnProject(project.id, 3)}>
            Work 3 hrs
          </Button>
          {minute < WORKDAY_END - 60 && (
            <Button disabled={!canWork} onClick={() => workOnProject(project.id, untilSix)}>
              Work until 6 PM
            </Button>
          )}
        </div>
        {claude !== 'none' && (
          <p className="small faint" style={{ marginTop: 8 }}>
            {CLAUDE_PLANS[claude].name} is helping: you build {Math.round((build - 1) * 100)}% faster{testMinutes < 60 ? ' and bug tests are half as long' : ''}.
          </p>
        )}
        {event && <p className="small" style={{ color: 'var(--warn)', marginTop: 8 }}>Deal with the surprise above before you keep working.</p>}
        {late && !done && (
          <p className="small" style={{ color: 'var(--warn)', marginTop: 8 }}>
            {deep ? 'It’s the middle of the night. Work is a lot sloppier and buggier now.' : 'It’s late. Tired work is sloppier and buggier.'}
            {hasCoffee ? ' Your coffee machine takes the edge off.' : ''}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Quality check</h2>
        </div>
        <div className="meter-row">
          <span className="muted">Quality so far</span>
          <span className="num" style={{ fontWeight: 600 }}>{quality ? `${quality}/100` : '—'}</span>
        </div>
        <div className="progress" style={{ marginBottom: 8 }}>
          <motion.div initial={false} animate={{ width: `${quality}%` }} transition={softSpring} />
        </div>
        <div className="meter-row">
          <span className="muted">Known bugs</span>
          <span className="num" style={{ fontWeight: 600, color: project.foundBugs ? 'var(--bad)' : undefined }}>{project.foundBugs}</span>
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Button size="sm" disabled={onCall || minute + testMinutes > DAY_HARD_END || !!project.pendingEvent} onClick={() => testProject(project.id)} title="Look for hidden bugs">
            Test on phone &amp; laptop &middot; {testMinutes === 60 ? '1 hr' : `${testMinutes} min`}
          </Button>
          <Button size="sm" disabled={onCall || project.foundBugs === 0 || minute + FIX_MINUTES_PER_BUG > DAY_HARD_END} onClick={() => fixProjectBugs(project.id)}>
            Fix bugs &middot; {project.foundBugs * FIX_MINUTES_PER_BUG} min
          </Button>
          <Button
            size="sm"
            disabled={onCall || !done || project.polish >= MAX_POLISH || minute + 60 > DAY_HARD_END}
            onClick={() => polishProject(project.id)}
            title="Small details that make it feel finished"
          >
            Polish &middot; 1 hr ({project.polish}/{MAX_POLISH})
          </Button>
        </div>
        <p className="small faint" style={{ marginTop: 8 }}>
          Coding can create hidden bugs. Testing finds most of them. The client will find the rest.
        </p>
      </div>

      <Button
        variant="primary"
        block
        style={{ height: 44 }}
        disabled={!done || onCall || !!project.pendingEvent || minute + 10 > DAY_HARD_END}
        onClick={() => submitProject(project.id)}
      >
        {done ? 'Send to client for review' : 'Finish all tasks to send it'}
      </Button>
      {done && project.foundBugs > 0 && <p className="small" style={{ color: 'var(--bad)', marginTop: -8 }}>You still have {project.foundBugs} known bugs. The client will notice.</p>}
    </div>
  );
}
