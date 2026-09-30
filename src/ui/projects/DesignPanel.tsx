import { useGame } from '../../game/store';
import {
  FONTS,
  LAYOUTS,
  PALETTES,
  RECOMMENDED_SECTIONS,
  SECTION_ORDER,
  SECTIONS,
  TASTE_HINTS,
  VIBE_LABELS,
  type Design,
  type FontId,
  type LayoutId,
  type PaletteId,
  type SectionId,
  type Vibe,
} from '../../game/design';
import { reworkHours } from '../../game/projects';
import { toGameTime } from '../../game/deals';
import { INDUSTRIES } from '../../game/businesses';
import type { Business, Project } from '../../game/types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

function VibeTags({ vibes }: { vibes: Vibe[] }) {
  return (
    <span className="vibe-tags">
      {vibes.map((v) => (
        <span key={v}>{VIBE_LABELS[v]}</span>
      ))}
    </span>
  );
}

export function DesignPanel({ project, biz }: { project: Project; biz: Business }) {
  const { skills, day, minute, setDesign, askStyle } = useGame();
  const level = skills.design.level;
  const d = project.design;
  const now = toGameTime(day, minute);
  const building = project.status === 'in_progress' && project.tasks.some((t) => t.skill === 'design' && t.done > 0);
  const recommended = RECOMMENDED_SECTIONS[biz.industry];
  const styleAnswered = project.tasteAt !== null && project.tasteAt <= now;

  const update = (patch: Partial<Design>) => setDesign(project.id, { ...d, ...patch });
  const cost = (patch: Partial<Design>) => (building ? reworkHours(d, { ...d, ...patch }) : 0);
  const toggleSection = (s: SectionId) =>
    update({ sections: d.sections.includes(s) ? d.sections.filter((x) => x !== s) : SECTION_ORDER.filter((x) => x === s || d.sections.includes(x)) });

  const lockedHint = (need: number) => `Needs Design Lv ${need}`;
  /** Shows the rework cost instead of the description when switching would cost time. */
  const sub = (description: string, patch: Partial<Design>) => {
    const h = cost(patch);
    return h > 0 ? `+${h}h rework` : description;
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Design</h2>
        {building && <span className="small faint">Changes now cost rework time</span>}
      </div>

      <div className="banner info" style={{ marginBottom: 14 }}>
        {styleAnswered ? (
          <>
            <strong>{biz.ownerName.split(' ')[0]} said:</strong> &ldquo;{TASTE_HINTS[project.taste]}&rdquo;
          </>
        ) : project.tasteAt !== null ? (
          'You asked about their style. Waiting for a reply…'
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Not sure what they like? Ask them.</span>
            <Button size="sm" onClick={() => askStyle(project.id)}>
              <Icon name="chat" size={14} /> Ask
            </Button>
          </div>
        )}
      </div>

      <div className="field-label">Layout</div>
      <div className="option-grid">
        {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => {
          const o = LAYOUTS[id];
          const locked = o.level > level;
          return (
            <button key={id} className={`option ${d.layout === id ? 'on' : ''}`} disabled={locked} onClick={() => update({ layout: id })}>
              <span className="o-name">{o.name}</span>
              <span className="o-sub">{locked ? lockedHint(o.level) : sub(o.description, { layout: id })}</span>
              <VibeTags vibes={o.vibes} />
            </button>
          );
        })}
      </div>

      <div className="field-label">Colors</div>
      <div className="option-grid">
        {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
          const o = PALETTES[id];
          const locked = o.level > level;
          return (
            <button key={id} className={`option ${d.palette === id ? 'on' : ''}`} disabled={locked} onClick={() => update({ palette: id })}>
              <span className="swatches">
                {[o.bg, o.surface, o.primary, o.text].map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="o-name">{o.name}</span>
              <span className="o-sub">{locked ? lockedHint(o.level) : sub(o.description, { palette: id })}</span>
              <VibeTags vibes={o.vibes} />
            </button>
          );
        })}
      </div>

      <div className="field-label">Fonts</div>
      <div className="option-grid">
        {(Object.keys(FONTS) as FontId[]).map((id) => {
          const o = FONTS[id];
          const locked = o.level > level;
          return (
            <button key={id} className={`option ${d.font === id ? 'on' : ''}`} disabled={locked} onClick={() => update({ font: id })}>
              <span className="o-name" style={{ fontFamily: o.heading, fontSize: 15 }}>{o.name}</span>
              <span className="o-sub">{locked ? lockedHint(o.level) : sub(o.description, { font: id })}</span>
              <VibeTags vibes={o.vibes} />
            </button>
          );
        })}
      </div>

      <div className="field-label">
        Home page sections <span className="small faint">{d.sections.length} picked &middot; 4&ndash;6 is best</span>
      </div>
      <div className="option-grid">
        {SECTION_ORDER.map((s) => {
          const on = d.sections.includes(s);
          return (
            <button key={s} className={`option ${on ? 'on' : ''}`} onClick={() => toggleSection(s)}>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span className="o-name">{SECTIONS[s].name}</span>
                {recommended.includes(s) && <span className="badge accent">Popular</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="small faint" style={{ marginTop: 10 }}>
        &ldquo;Popular&rdquo; = what people expect on a {INDUSTRIES[biz.industry].label.toLowerCase()} website.
      </p>
    </div>
  );
}
