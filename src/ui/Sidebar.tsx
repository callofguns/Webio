import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../game/store';
import { dealStatus, toGameTime } from '../game/deals';
import { Icon, type IconName } from './components/Icon';
import { Logo } from './components/Logo';
import { spring } from './motion';

export type ScreenId = 'dashboard' | 'phone' | 'messages' | 'projects' | 'team' | 'office' | 'skills';

/** Each part of the game has its own color (see the --c-* tokens in styles.css). */
export const SECTION_COLOR: Record<ScreenId, string> = {
  dashboard: 'var(--c-home)',
  phone: 'var(--c-phone)',
  messages: 'var(--c-texts)',
  projects: 'var(--c-projects)',
  team: 'var(--c-team)',
  office: 'var(--c-office)',
  skills: 'var(--c-skills)',
};

const ITEMS: { id: ScreenId; label: string; short?: string; icon: IconName; soon?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'home' },
  { id: 'phone', label: 'Phone', icon: 'phone' },
  { id: 'messages', label: 'Messages', short: 'Texts', icon: 'chat' },
  { id: 'projects', label: 'Projects', icon: 'layout' },
  { id: 'team', label: 'Team', icon: 'users' },
  { id: 'office', label: 'Office', icon: 'building', soon: true },
  { id: 'skills', label: 'Skills', icon: 'star' },
];

export function Sidebar({ current, onChange }: { current: ScreenId; onChange: (s: ScreenId) => void }) {
  const agency = useGame((s) => s.profile?.agencyName);
  // Conversations where the client is waiting on you.
  const yourTurn = useGame((s) => s.deals.filter((d) => dealStatus(d, toGameTime(s.day, s.minute)) === 'your_turn').length);
  const applicants = useGame((s) => s.applicants.length);
  const counts: Partial<Record<ScreenId, number>> = { messages: yourTurn, team: applicants };

  return (
    <nav className="sidebar">
      <div className="brand">
        <Logo />
        <div>
          {agency}
          <small>web design studio</small>
        </div>
      </div>
      {ITEMS.map((item) => (
        <motion.button
          key={item.id}
          className={`nav-item ${current === item.id ? 'active' : ''}`}
          style={{ '--hue-item': SECTION_COLOR[item.id] } as CSSProperties}
          onClick={() => onChange(item.id)}
          aria-current={current === item.id ? 'page' : undefined}
          whileHover="wiggle"
          whileTap={{ scale: 0.96 }}
        >
          {current === item.id && <motion.div layoutId="nav-pill" className="nav-bg frame-sel" transition={spring} />}
          <motion.span
            className="nav-icon"
            variants={{ wiggle: { rotate: [0, -12, 9, -4, 0], transition: { duration: 0.5 } } }}
          >
            <Icon name={item.icon} />
          </motion.span>
          <span className="nav-label">{item.label}</span>
          <span className="nav-short">{item.short ?? item.label}</span>
          {counts[item.id] ? (
            <motion.span key={counts[item.id]} className="count" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
              {counts[item.id]}
            </motion.span>
          ) : (
            item.soon && <span className="soon">Soon</span>
          )}
        </motion.button>
      ))}
    </nav>
  );
}
