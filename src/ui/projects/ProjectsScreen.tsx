import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../../game/store';
import { FEATURES } from '../../game/deals';
import { progress } from '../../game/projects';
import { retainerFee } from '../../game/pricing';
import type { Project } from '../../game/types';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/Tabs';
import { money } from '../components/AnimatedNumber';
import { fadeUp, softSpring, spring } from '../motion';
import { ProjectDetail } from './ProjectDetail';

export const STATUS_LABEL: Record<Project['status'], { text: string; tone: string }> = {
  not_started: { text: 'Planning', tone: 'accent' },
  in_progress: { text: 'Building', tone: 'accent' },
  review: { text: 'With client', tone: '' },
  delivered: { text: 'Delivered', tone: 'good' },
};

export const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`${n} stars`}>
    {'★'.repeat(n)}
    <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</span>
  </span>
);

export function ProjectsScreen() {
  const { projects, businesses, day, reputation } = useGame();
  const [tab, setTab] = useState<'active' | 'portfolio'>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = projects.find((p) => p.id === openId);

  const active = projects.filter((p) => p.status !== 'delivered');
  const delivered = projects.filter((p) => p.status === 'delivered');
  const avgStars = delivered.length ? delivered.reduce((s, p) => s + (p.stars ?? 0), 0) / delivered.length : 0;
  const shown = tab === 'active' ? active : delivered;
  const retainers = delivered.filter((p) => p.retainer);
  const retainerIncome = retainers.reduce((sum, p) => sum + (p.retainer?.monthly ?? 0), 0);

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div key={open.id} {...fadeUp}>
          <ProjectDetail project={open} onBack={() => setOpenId(null)} />
        </motion.div>
      ) : (
        <motion.div key="list" className="screen" {...fadeUp}>
          <div className="screen-head">
            <div>
              <h1>Projects</h1>
              <p className="muted">
                Reputation {reputation}
                {retainers.length > 0 && (
                  <>
                    {' '}
                    &middot; {retainers.length} retainer{retainers.length > 1 ? 's' : ''} bringing in {money(retainerIncome)}/month
                  </>
                )}
                {delivered.length > 0 && (
                  <>
                    {' '}
                    &middot; average <Stars n={Math.round(avgStars)} /> from {delivered.length} site{delivered.length > 1 ? 's' : ''}
                  </>
                )}
              </p>
            </div>
            <Tabs
              id="project-tab"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: `Active (${active.length})` },
                { value: 'portfolio', label: `Portfolio (${delivered.length})` },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <div className="card empty" style={{ padding: 64 }}>
              <Icon name="layout" size={28} />
              <p style={{ marginTop: 10 }}>{tab === 'active' ? 'No active projects. Win a deal in Messages first.' : 'Finished sites will show up here.'}</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {shown.map((p, i) => {
                const biz = businesses.find((b) => b.id === p.businessId)!;
                const daysLeft = p.dueDay - day;
                const status = STATUS_LABEL[p.status];
                return (
                  <motion.button
                    key={p.id}
                    className="card stack project-card"
                    style={{ gap: 10 }}
                    onClick={() => setOpenId(p.id)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.04 }}
                    whileTap={{ scale: 0.985 }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <h2>{biz.name}</h2>
                      <span className={`badge ${status.tone}`}>{status.text}</span>
                    </div>
                    <div className="chip-list">
                      <span className="badge">{p.pages} pages</span>
                      {p.features.map((f) => (
                        <span key={f} className="badge">{FEATURES[f].label}</span>
                      ))}
                    </div>
                    {p.status === 'delivered' ? (
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <Stars n={p.stars ?? 0} />
                        <span className="num" style={{ fontWeight: 600 }}>{p.plan === 'retainer' ? `${money(retainerFee(p.price))}/mo` : money(p.price)}</span>
                      </div>
                    ) : (
                      <>
                        <div className={`progress ${p.status === 'in_progress' ? 'live' : ''}`}>
                          <motion.div initial={false} animate={{ width: `${progress(p) * 100}%` }} transition={softSpring} />
                        </div>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <span className={`small ${daysLeft < 0 ? '' : 'muted'}`} style={daysLeft < 0 ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>
                            {daysLeft < 0 ? `${-daysLeft} days late` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} days`}
                          </span>
                          <span className="small muted num">
                            {p.plan === 'retainer' ? `${money(retainerFee(p.price))}/mo once live` : `${money(p.price - p.depositPaid)} still owed`}
                          </span>
                        </div>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
