import { useState } from 'react';
import { promptInstall, useInstallOption } from './install';
import { Button } from '../ui/components/Button';

/** "Install the app" card. Hidden when already installed or not possible. */
export function InstallCard() {
  const option = useInstallOption();
  const [showSteps, setShowSteps] = useState(false);
  if (!option) return null;

  return (
    <div className="card">
      <div className="card-title">
        <h2>Play it like an app</h2>
      </div>
      <p className="muted">Install Webio on your home screen. It opens full screen and works offline.</p>
      {option === 'prompt' ? (
        <Button variant="primary" style={{ marginTop: 12 }} onClick={() => promptInstall()}>
          Install app
        </Button>
      ) : showSteps ? (
        <ol className="muted small" style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>Tap the Share button in Safari (the square with an arrow).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
      ) : (
        <Button style={{ marginTop: 12 }} onClick={() => setShowSteps(true)}>
          Show me how
        </Button>
      )}
    </div>
  );
}
