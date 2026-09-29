import type { Business } from '../../game/types';
import { formatHour } from '../../game/time';

type Tone = '' | 'good' | 'bad' | 'warn' | 'accent';

export function statusBadge(b: Business, today: number): { text: string; tone: Tone } {
  switch (b.status) {
    case 'new':
      return { text: 'New', tone: 'accent' };
    case 'contacted':
      return { text: `Tried ${b.attempts}×`, tone: '' };
    case 'callback':
      if (b.callback?.day === today) return { text: `Call back ${formatHour(b.callback.hour)}`, tone: 'warn' };
      return { text: b.callback ? `Call back day ${b.callback.day}` : 'Call back', tone: '' };
    case 'not_interested':
      return { text: 'Said no', tone: 'bad' };
    case 'do_not_call':
      return { text: 'Do not call', tone: 'bad' };
    case 'interested':
      return { text: 'Interested', tone: 'good' };
  }
}
