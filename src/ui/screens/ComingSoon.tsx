import { Icon } from '../components/Icon';

const INFO: Record<string, { title: string; text: string; part: number }> = {
  messages: {
    title: 'Messages',
    part: 2,
    text: 'Text interested businesses, learn what they need, send quotes and negotiate prices before they sign.',
  },
  projects: {
    title: 'Projects',
    part: 3,
    text: 'Build websites for your clients by choosing layouts, colors, features and content. Better skills unlock better options.',
  },
  team: {
    title: 'Team',
    part: 4,
    text: 'Post job ads, interview candidates and hire people to make calls, design and code for you.',
  },
  office: {
    title: 'Office',
    part: 5,
    text: 'Move out of your bedroom into a co-working desk, then a real office. Better offices make your team faster.',
  },
};

export function ComingSoon({ screen }: { screen: string }) {
  const info = INFO[screen];
  const interested = screen === 'messages';
  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>{info.title}</h1>
          <p className="muted">Coming in part {info.part} of the build.</p>
        </div>
      </div>
      <div className="card empty" style={{ padding: 48 }}>
        <div style={{ color: 'var(--text-3)', marginBottom: 12 }}>
          <Icon name="lock" size={28} />
        </div>
        <p className="muted" style={{ maxWidth: 420, margin: '0 auto' }}>{info.text}</p>
        {interested && (
          <p className="small faint" style={{ marginTop: 12 }}>
            Businesses that say yes on the phone are saved and will be waiting here.
          </p>
        )}
      </div>
    </div>
  );
}
