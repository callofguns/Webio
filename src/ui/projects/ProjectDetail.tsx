import { useState } from 'react';
import { DAY_HARD_END, useGame } from '../../game/store';
import { contentMissing, progress, siteQuality } from '../../game/projects';
import type { Project } from '../../game/types';
import { Button } from '../components/Button';
import { Tabs } from '../components/Tabs';
import { money } from '../components/AnimatedNumber';
import { DesignPanel } from './DesignPanel';
import { BuildPanel } from './BuildPanel';
import { SitePreview } from './SitePreview';
import { Stars } from './ProjectsScreen';
import { useIsMobile } from '../useIsMobile';

const STEPS: { status: Project['status']; label: string }[] = [
  { status: 'not_started', label: 'Plan' },
  { status: 'in_progress', label: 'Build' },
  { status: 'review', label: 'Review' },
  { status: 'delivered', label: 'Paid' },
];

function Steps({ status }: { status: Project['status'] }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <div className="steps">
      {STEPS.map((s, i) => (
        <div key={s.status} className="row" style={{ gap: 6 }}>
          {i > 0 && <span className="step-line" />}
          <span className={`step ${i === current ? 'on' : i < current ? 'done' : ''}`}>
            <span className="n">{i < current ? '✓' : i + 1}</span>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
  const { businesses, day, minute, activeCall, startProject, wait } = useGame();
  const biz = businesses.find((b) => b.id === project.businessId)!;
  const [tab, setTab] = useState<'build' | 'design'>('build');
  const daysLeft = project.dueDay - day;
  const first = biz.ownerName.split(' ')[0];
  const onCall = !!activeCall && activeCall.phase !== 'ended';
  const showTab = project.pendingEvent ? 'build' : tab;
  const mobile = useIsMobile();
  // On phones the preview sits on top and can be hidden to save space.
  const [previewOpen, setPreviewOpen] = useState(true);

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} style={{ padding: 0, marginBottom: 6, color: 'var(--text-2)' }}>
            &larr; All projects
          </Button>
          <h1>{biz.name}</h1>
          <p className="muted">
            {money(project.price)} &middot;{' '}
            {project.status === 'delivered'
              ? `delivered on day ${project.deliveredDay}`
              : daysLeft < 0
                ? `${-daysLeft} days late`
                : `due in ${daysLeft} days (day ${project.dueDay})`}
          </p>
        </div>
        <Steps status={project.status} />
      </div>

      <div className="project-layout">
        <div className="stack" style={{ gap: 16 }}>
          {project.status === 'not_started' && (
            <>
              <DesignPanel project={project} biz={biz} />
              <Button variant="primary" block style={{ height: 44 }} onClick={() => startProject(project.id)}>
                Start building &rarr;
              </Button>
            </>
          )}

          {project.status === 'in_progress' && (
            <>
              <Tabs
                id="build-tab"
                value={showTab}
                onChange={setTab}
                options={[
                  { value: 'build', label: 'Build' },
                  { value: 'design', label: 'Design' },
                ]}
              />
              {showTab === 'build' ? <BuildPanel project={project} /> : <DesignPanel project={project} biz={biz} />}
            </>
          )}

          {project.status === 'review' && (
            <div className="card stack" style={{ gap: 12 }}>
              <h2>With the client</h2>
              <p className="muted">
                {first} is looking at the site. Their answer will show up in Messages. Make some calls while you wait.
              </p>
              <div className="row">
                <Button size="sm" disabled={onCall || minute >= DAY_HARD_END} onClick={() => wait(60)}>
                  Wait 1 hr
                </Button>
              </div>
            </div>
          )}

          {project.status === 'delivered' && (
            <div className="card stack" style={{ gap: 10 }}>
              <h2>Delivered</h2>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Client rating</span>
                <Stars n={project.stars ?? 0} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Quality</span>
                <span className="num">{siteQuality(project)}/100</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Paid</span>
                <span className="num" style={{ fontWeight: 600 }}>{money(project.price)}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Rounds of changes</span>
                <span className="num">{project.revisions}</span>
              </div>
              <p className="small faint">It&rsquo;s in your portfolio now. Good reviews make new clients trust you.</p>
            </div>
          )}
        </div>

        <div className="preview-sticky">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 600 }}>
              {project.status === 'not_started' ? 'Mockup' : project.status === 'in_progress' ? `Live preview · ${Math.round(progress(project) * 100)}% built` : 'Live site'}
            </span>
            <span className="row" style={{ gap: 6 }}>
              {contentMissing(project) && <span className="badge warn">Placeholder text</span>}
              {mobile && (
                <Button size="sm" variant="ghost" onClick={() => setPreviewOpen((o) => !o)}>
                  {previewOpen ? 'Hide' : 'Show'}
                </Button>
              )}
            </span>
          </div>
          {(!mobile || previewOpen) && <SitePreview
            biz={biz}
            design={project.design}
            features={project.features}
            built={project.status === 'not_started' ? 1 : progress(project)}
            placeholderContent={contentMissing(project)}
          />}
        </div>
      </div>
    </div>
  );
}
