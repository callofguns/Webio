import { TRAITS } from '../../game/team';
import type { Trait } from '../../game/types';

export const LEVEL_NAMES = ['', 'Beginner', 'Junior', 'Solid', 'Senior', 'Expert'];

/** Skill shown as 5 dots. */
export function LevelDots({ level, faded }: { level: number; faded?: boolean }) {
  return (
    <span className="level-dots" title={`${LEVEL_NAMES[level]} (level ${level})`} style={faded ? { opacity: 0.55 } : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= level ? 'on' : ''} />
      ))}
      <span className="small muted">{LEVEL_NAMES[level]}</span>
    </span>
  );
}

export function TraitBadges({ traits }: { traits: Trait[] }) {
  return (
    <>
      {traits.map((t) => (
        <span key={t} className={`badge ${TRAITS[t].good ? 'good' : 'bad'}`} title={TRAITS[t].text}>
          {TRAITS[t].label}
        </span>
      ))}
    </>
  );
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('');
}
