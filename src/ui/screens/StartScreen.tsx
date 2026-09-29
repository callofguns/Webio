import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../../game/store';
import { START_MONEY } from '../../game/balance';
import { Button } from '../components/Button';
import { softSpring } from '../motion';

export function StartScreen() {
  const newGame = useGame((s) => s.newGame);
  const [playerName, setPlayerName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const ready = playerName.trim() && agencyName.trim();

  return (
    <div className="start">
      <motion.form
        className="card start-card stack"
        style={{ gap: 18, padding: 28 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={softSpring}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) newGame({ playerName: playerName.trim(), agencyName: agencyName.trim() });
        }}
      >
        <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18 }}>W</div>
        <div>
          <h1>Start your agency</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            You just quit your job to build websites for local businesses. You have ${START_MONEY.toLocaleString()} saved, a laptop and
            a phone. Nobody knows who you are yet.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pn">Your first name</label>
          <input id="pn" className="input" value={playerName} maxLength={20} onChange={(e) => setPlayerName(e.target.value)} placeholder="Alex" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="an">Agency name</label>
          <input id="an" className="input" value={agencyName} maxLength={28} onChange={(e) => setAgencyName(e.target.value)} placeholder="Northside Web Co." />
        </div>
        <Button variant="primary" type="submit" disabled={!ready} block style={{ height: 42 }}>
          Open for business
        </Button>
      </motion.form>
    </div>
  );
}
