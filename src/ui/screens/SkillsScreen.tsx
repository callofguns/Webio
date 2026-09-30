import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { xpForLevel } from '../../game/balance';
import type { SkillId } from '../../game/types';
import { FONTS, LAYOUTS, PALETTES } from '../../game/design';
import { FEATURES } from '../../game/deals';

/** What each level of a skill unlocks, worked out from the game data. */
function unlocks(skill: SkillId): { level: number; names: string[] }[] {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, name: string) => level > 1 && byLevel.set(level, [...(byLevel.get(level) ?? []), name]);
  if (skill === 'design') {
    for (const o of [...Object.values(LAYOUTS), ...Object.values(PALETTES), ...Object.values(FONTS)]) add(o.level, o.name);
  } else if (skill === 'development') {
    for (const f of Object.values(FEATURES)) add(f.devLevel, f.label);
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, names]) => ({ level, names }));
}
import { softSpring } from '../motion';

const SKILLS: { id: SkillId; name: string; text: string }[] = [
  { id: 'sales', name: 'Sales', text: 'Grows with every call and deal. Higher levels make owners warm up to you faster.' },
  { id: 'design', name: 'Design', text: 'Grows when you design sites. Each level makes design work 20% faster and better looking.' },
  { id: 'development', name: 'Development', text: 'Grows when you code sites. Each level makes coding 20% faster with fewer bugs.' },
];

export function SkillsScreen() {
  const skills = useGame((s) => s.skills);
  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>Skills</h1>
          <p className="muted">You get better by doing. Courses and training come later.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {SKILLS.map((sk) => {
          const { level, xp } = skills[sk.id];
          const need = xpForLevel(level);
          return (
            <div key={sk.id} className="card stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2>{sk.name}</h2>
                <span className="badge accent">Level {level}</span>
              </div>
              <p className="muted">{sk.text}</p>
              <div className="progress">
                <motion.div initial={false} animate={{ width: `${(xp / need) * 100}%` }} transition={softSpring} />
              </div>
              <p className="small faint num">
                {Math.floor(xp)} / {need} XP
              </p>
              {unlocks(sk.id).map((u) => (
                <p key={u.level} className="small" style={{ color: level >= u.level ? 'var(--good)' : 'var(--text-2)' }}>
                  {level >= u.level ? '\u2713' : `Lv ${u.level}:`} {u.names.join(', ')}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
