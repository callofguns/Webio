import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from './game/store';
import { Sidebar, type ScreenId } from './ui/Sidebar';
import { TopBar } from './ui/TopBar';
import { StartScreen } from './ui/screens/StartScreen';
import { Dashboard } from './ui/screens/Dashboard';
import { PhoneScreen } from './ui/phone/PhoneScreen';
import { SkillsScreen } from './ui/screens/SkillsScreen';
import { ComingSoon } from './ui/screens/ComingSoon';
import { DaySummary } from './ui/screens/DaySummary';
import { fadeUp } from './ui/motion';

export default function App() {
  const profile = useGame((s) => s.profile);
  const [screen, setScreen] = useState<ScreenId>('dashboard');

  if (!profile) return <StartScreen />;

  return (
    <div className="app">
      <Sidebar current={screen} onChange={setScreen} />
      <TopBar />
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={screen} {...fadeUp}>
            {screen === 'dashboard' && <Dashboard onNavigate={setScreen} />}
            {screen === 'phone' && <PhoneScreen />}
            {screen === 'skills' && <SkillsScreen />}
            {(screen === 'messages' || screen === 'projects' || screen === 'team' || screen === 'office') && <ComingSoon screen={screen} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <DaySummary />
    </div>
  );
}
