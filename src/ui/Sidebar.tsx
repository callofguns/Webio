import { motion } from 'motion/react';
import { useGame } from '../game/store';
import { Icon, type IconName } from './components/Icon';
import { spring } from './motion';

export type ScreenId = 'dashboard' | 'phone' | 'messages' | 'projects' | 'team' | 'office' | 'skills';

const ITEMS: { id: ScreenId; label: string; icon: IconName; soon?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'phone', label: 'Phone', icon: 'phone' },
  { id: 'messages', label: 'Messages', icon: 'chat', soon: true },
  { id: 'projects', label: 'Projects', icon: 'layout', soon: true },
  { id: 'team', label: 'Team', icon: 'users', soon: true },
  { id: 'office', label: 'Office', icon: 'building', soon: true },
  { id: 'skills', label: 'Skills', icon: 'star' },
];

export function Sidebar({ current, onChange }: { current: ScreenId; onChange: (s: ScreenId) => void }) {
  const agency = useGame((s) => s.profile?.agencyName);
  const interested = useGame((s) => s.businesses.filter((b) => b.status === 'interested').length);

  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brand-mark">W</div>
        <div>
          {agency}
          <small>Web design agency</small>
        </div>
      </div>
      {ITEMS.map((item) => (
        <button key={item.id} className={`nav-item ${current === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)}>
          {current === item.id && <motion.div layoutId="nav-pill" className="nav-bg" transition={spring} />}
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.id === 'messages' && interested > 0 ? (
            <span className="count">{interested}</span>
          ) : (
            item.soon && <span className="soon">Soon</span>
          )}
        </button>
      ))}
    </nav>
  );
}
