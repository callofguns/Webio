import { useEffect, useState } from 'react';
import { DAY_HARD_END, useGame } from '../../game/store';
import { buildDays, FEATURE_ORDER, FEATURES, knownBy, marketPrice, QUOTE_MINUTES, toGameTime } from '../../game/deals';
import type { Business, Deal, Feature } from '../../game/types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Tabs } from '../components/Tabs';
import { Icon } from '../components/Icon';
import { money } from '../components/AnimatedNumber';

function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="stepper">
      <Button size="sm" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Less">&minus;</Button>
      <span className="val num">
        {value}
        {suffix}
      </span>
      <Button size="sm" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">+</Button>
    </div>
  );
}

type Props = { deal: Deal; biz: Business; onClose: () => void };

export function QuoteBuilder({ open, ...props }: Props & { open: boolean }) {
  // The form mounts fresh each time it opens, so it starts from what you know now.
  return (
    <Modal open={open} wide onClose={props.onClose}>
      {open && <QuoteForm {...props} />}
    </Modal>
  );
}

function QuoteForm({ deal, biz, onClose }: Props) {
  const { skills, day, minute, sendQuote } = useGame();
  // You only know what they've replied about by now.
  const known = knownBy(deal, toGameTime(day, minute));
  const devLevel = skills.development.level;
  // Copywriting only counts as "known" once you've asked about their content.
  const knownNeeds: Feature[] = known.features ? deal.needs.features.filter((f) => f !== 'copywriting') : [];
  const knownContentNeed = known.content && !deal.needs.hasContent;

  const start = deal.quote;
  const [pages, setPages] = useState(start?.pages ?? (known.features ? deal.needs.pages : 4));
  // Pre-tick what you already know they need (and can build).
  const [features, setFeatures] = useState<Feature[]>(
    () =>
      start?.features ??
      [...knownNeeds, ...(knownContentNeed ? (['copywriting'] as Feature[]) : [])].filter(
        (f) => FEATURES[f].devLevel <= devLevel,
      ),
  );
  const [days, setDays] = useState(start?.days ?? 10);
  const [deposit, setDeposit] = useState<'0' | '25' | '50'>(String(start?.depositPct ?? 50) as '0' | '25' | '50');
  const suggested = marketPrice(pages, features);
  const [price, setPrice] = useState(start?.price ?? suggested);
  const [touchedPrice, setTouchedPrice] = useState(!!start);
  const estimate = buildDays(pages, features);

  // Until you type your own price, keep it at the suggested price.
  useEffect(() => {
    if (!touchedPrice) setPrice(suggested);
  }, [suggested, touchedPrice]);

  useEffect(() => {
    if (!start) setDays(Math.max(estimate, 3));
  }, [estimate, start]);

  const toggle = (f: Feature) => setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const tooLate = minute + QUOTE_MINUTES > DAY_HARD_END;
  const rushed = days < estimate;

  return (
    <>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Quote for {biz.name}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </Button>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Writing it up takes {QUOTE_MINUTES} minutes. {known.features ? '' : deal.known.features ? 'They haven’t replied about it yet, so this is a guess.' : 'You haven’t asked what they need, so this is a guess.'}
        </p>

        <div className="modal-body" style={{ marginTop: 12 }}>
          <div className="form-row">
            <div>
              <div style={{ fontWeight: 500 }}>Pages</div>
              {known.features && <div className="small faint">They mentioned about {deal.needs.pages}</div>}
            </div>
            <Stepper value={pages} min={1} max={12} onChange={setPages} />
          </div>

          <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Features</div>
            <div className="feature-grid">
              {FEATURE_ORDER.map((f) => {
                const info = FEATURES[f];
                const locked = info.devLevel > devLevel;
                const needed = knownNeeds.includes(f) || (f === 'copywriting' && knownContentNeed);
                const on = features.includes(f);
                return (
                  <button key={f} className={`feature-toggle ${on ? 'on' : ''}`} disabled={locked} onClick={() => toggle(f)}>
                    <span className="box">{on && <Icon name="check" size={12} />}</span>
                    <span className="f-main">
                      {info.label}
                      <span className="f-sub">{locked ? `Needs Development Lv ${info.devLevel}` : `+${money(info.price)}`}</span>
                    </span>
                    {needed && <span className="badge accent">Needed</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <div>
              <div style={{ fontWeight: 500 }}>Ready in</div>
              <div className="small faint" style={{ color: rushed ? 'var(--bad)' : undefined }}>
                {rushed ? `Rushed! It takes about ${estimate} days to build.` : `About ${estimate} days of work`}
                {known.deadline && ` · they want it within ${deal.needs.deadlineDays}`}
              </div>
            </div>
            <Stepper value={days} min={2} max={60} onChange={setDays} suffix="d" />
          </div>

          <div className="form-row">
            <div>
              <div style={{ fontWeight: 500 }}>Deposit up front</div>
              <div className="small faint">Money now, but careful clients don&rsquo;t love it</div>
            </div>
            <Tabs
              id="deposit"
              value={deposit}
              onChange={setDeposit}
              options={[
                { value: '0', label: 'None' },
                { value: '25', label: '25%' },
                { value: '50', label: '50%' },
              ]}
            />
          </div>

          <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Price</div>
                <div className="small faint">
                  Typical price: {money(suggested)}
                  {known.budget && deal.budgetHint && ` · they said ${money(deal.budgetHint[0])}–${money(deal.budgetHint[1])}`}
                </div>
              </div>
              <div className="price-input">
                <span className="muted">$</span>
                <input
                  className="input num"
                  type="number"
                  min={50}
                  step={50}
                  value={price}
                  onChange={(e) => {
                    setTouchedPrice(true);
                    setPrice(Math.max(0, Number(e.target.value) || 0));
                  }}
                />
              </div>
            </div>
            <input
              type="range"
              min={Math.round(suggested * 0.4)}
              max={Math.round(suggested * 2)}
              step={50}
              value={price}
              onChange={(e) => {
                setTouchedPrice(true);
                setPrice(Number(e.target.value));
              }}
              aria-label="Price"
            />
          </div>
        </div>

        <div className="row modal-foot" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">
            {Number(deposit) > 0 ? `${money((price * Number(deposit)) / 100)} up front if they accept` : 'Paid when the site is done'}
          </span>
          <Button
            variant="primary"
            disabled={price < 50 || tooLate}
            onClick={() => {
              sendQuote(deal.id, { pages, features, price, days, depositPct: Number(deposit) });
              onClose();
            }}
          >
            Send quote
          </Button>
        </div>
    </>
  );
}
