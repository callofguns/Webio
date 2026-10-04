import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { OrientationGuard } from './ui/OrientationGuard';
import { listenForInstallPrompt } from './pwa/install';
import './fonts.css';
import './styles.css';

listenForInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* "user" respects the player's reduce-motion setting. */}
    <MotionConfig reducedMotion="user">
      <App />
      <OrientationGuard />
    </MotionConfig>
  </StrictMode>,
);
