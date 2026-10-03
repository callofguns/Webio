import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Tabs } from '../components/Tabs';
import { UPCOMING, UPDATE_LOG, VERSION, type ChangeEntry } from '../../version';

type Page = 'log' | 'next';

function Entries({ entries }: { entries: ChangeEntry[] }) {
  return (
    <div className="changelog">
      {entries.map((e) => (
        <section key={e.title}>
          <h3>{e.title}</h3>
          <ul>
            {e.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The settings popup: version number, update log and what is coming. */
export function SettingsMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<Page>('log');
  return (
    <Modal open={open} wide onClose={onClose}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Settings</h2>
        <span className="badge accent num">{VERSION}</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Webio {VERSION}. You&rsquo;re playing the beta, so things may still change.
      </p>
      <div style={{ margin: '14px 0' }}>
        <Tabs
          id="settings"
          value={page}
          onChange={setPage}
          options={[
            { value: 'log', label: 'Update log' },
            { value: 'next', label: 'Coming soon' },
          ]}
        />
      </div>
      <div className="modal-body">
        <Entries entries={page === 'log' ? UPDATE_LOG : UPCOMING} />
      </div>
      <div className="row modal-foot" style={{ justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
