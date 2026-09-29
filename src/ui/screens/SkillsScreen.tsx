import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { xpForLevel } from '../../game/balance';
import type { SkillId } from '../../game/types';
import { softSpring } from '../motion';

const SKILLS: { id: SkillId; name: string; text: string; locked?: string }[] = [
  { id: 'sales', name: 'Sales', text: 'Every call makes you better on the phone. Higher levels make owners warm up to you faster.' },
  { id: 'design', name: 'Design', text: 'Unlocks better layouts, colors and typography for client sites.', locked: 'Grows when you build sites (part 3)' },
  { id: 'development', name: 'Development', text: 'Unlocks features like booking systems and online stores, and makes you build faster.', locked: 'Grows when you build sites (part 3)' },
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
                {xp} / {need} XP{sk.locked && ` · ${sk.locked}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
