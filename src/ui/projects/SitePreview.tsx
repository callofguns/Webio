// A mini mockup of the client's website, drawn from the design choices.
// Sections you haven't built yet show as grey placeholders.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { FONTS, HEADLINES, PALETTES, SECTION_ORDER, SECTIONS, SERVICES, type Design, type Palette } from '../../game/design';
import type { Business, Feature } from '../../game/types';
import { spring } from '../motion';

/** Width the site is drawn at before being shrunk to fit. */
const SITE_WIDTH = 1000;

interface Props {
  biz: Business;
  design: Design;
  features: Feature[];
  /** 0-1. Blocks past this point show as placeholders. Use 1 for a finished mockup. */
  built: number;
  /** No real text or photos yet. */
  placeholderContent?: boolean;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Grey bars that stand in for paragraphs. */
function Lines({ n = 3, color, widths = [100, 92, 70] }: { n?: number; color: string; widths?: number[] }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height: 10, borderRadius: 5, background: color, opacity: 0.25, width: `${widths[i % widths.length]}%` }} />
      ))}
    </div>
  );
}

function Img({ p, h = 180, tint = 0 }: { p: Palette; h?: number; tint?: number }) {
  const shades = [p.primary, p.muted, p.text];
  return (
    <div style={{ height: h, borderRadius: 12, background: p.surface, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: shades[tint % 3], opacity: 0.18 }} />
      <div style={{ position: 'absolute', left: '18%', bottom: '18%', width: '40%', height: '38%', borderRadius: 999, background: shades[tint % 3], opacity: 0.25 }} />
      <div style={{ position: 'absolute', right: '14%', top: '20%', width: 34, height: 34, borderRadius: 999, background: p.primary, opacity: 0.35 }} />
    </div>
  );
}

function Block({ title, p, bg, children }: { title?: string; p: Palette; bg: string; children: ReactNode }) {
  return (
    <section style={{ background: bg, padding: '48px 56px' }}>
      {title && <h3 style={{ margin: '0 0 24px', fontSize: 28, color: p.text, fontFamily: 'var(--site-heading)' }}>{title}</h3>}
      {children}
    </section>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <section style={{ padding: '40px 56px', background: '#eef0f3', borderTop: '2px dashed #cfd4dc' }}>
      <div style={{ color: '#8a91a0', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{label} &middot; not built yet</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 70, borderRadius: 10, background: '#dfe3e9' }} />
        ))}
      </div>
    </section>
  );
}

export function SitePreview({ biz, design, features, built, placeholderContent }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const p = PALETTES[design.palette];
  const f = FONTS[design.font];
  const scale = width ? width / SITE_WIDTH : 0.5;
  const headline = placeholderContent ? 'Your headline goes here' : HEADLINES[biz.industry];
  const services = placeholderContent ? ['Service one', 'Service two', 'Service three'] : SERVICES[biz.industry];
  const slug = biz.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const has = (x: Feature) => features.includes(x);
  const cta = has('booking') ? 'Book now' : has('online_store') ? 'Shop now' : 'Get in touch';
  const btn: CSSProperties = { background: p.primary, color: p.onPrimary, borderRadius: 10, padding: '14px 24px', fontWeight: 700, fontSize: 16, display: 'inline-block' };
  const ghost: CSSProperties = { ...btn, background: 'transparent', color: p.text, border: `2px solid ${p.text}33` };

  // ----- Hero, depending on layout -----
  const heroText = (color: string, align: 'left' | 'center' = 'left', size = 52) => (
    <div style={{ textAlign: align }}>
      <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.1, color, fontFamily: 'var(--site-heading)', fontWeight: 700, letterSpacing: '-0.01em' }}>{headline}</h1>
      <p style={{ margin: '18px 0 26px', fontSize: 19, color, opacity: 0.75 }}>
        {placeholderContent ? 'A short sentence about the business will go here.' : `${biz.name} — proudly serving the neighborhood.`}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
        <span style={btn}>{cta}</span>
        <span style={{ ...ghost, color, borderColor: `${color}44` }}>Learn more</span>
      </div>
    </div>
  );

  const heroes: Record<Design['layout'], ReactNode> = {
    classic: (
      <section style={{ padding: '64px 56px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40, alignItems: 'center', background: p.bg }}>
        {heroText(p.text)}
        <Img p={p} h={300} />
      </section>
    ),
    bold: (
      <section style={{ padding: '96px 56px', background: p.primary }}>
        {heroText(p.onPrimary, 'center', 64)}
      </section>
    ),
    minimal: (
      <section style={{ padding: '110px 56px 80px', background: p.bg, borderBottom: `1px solid ${p.text}22` }}>
        <div style={{ fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase', color: p.muted, marginBottom: 18 }}>{biz.name}</div>
        <div style={{ maxWidth: 720 }}>{heroText(p.text, 'left', 58)}</div>
      </section>
    ),
    cards: (
      <section style={{ padding: '64px 56px', background: p.surface }}>
        {heroText(p.text, 'center', 48)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 40 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: p.bg, borderRadius: 16, padding: 14 }}>
              <Img p={p} h={110} tint={i} />
            </div>
          ))}
        </div>
      </section>
    ),
    split: (
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 420, background: p.bg }}>
        <div style={{ background: p.primary, opacity: 0.85, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 40, borderRadius: 12, background: p.onPrimary, opacity: 0.15 }} />
        </div>
        <div style={{ padding: '64px 48px', display: 'flex', alignItems: 'center' }}>{heroText(p.text, 'left', 46)}</div>
      </section>
    ),
  };

  // ----- Body blocks, in page order -----
  const blocks: { key: string; label: string; node: ReactNode }[] = [];
  const bgFor = (i: number) => (i % 2 === 0 ? p.bg : p.surface);
  const sections = SECTION_ORDER.filter((s) => design.sections.includes(s) && s !== 'contact');

  const add = (key: string, label: string, render: (bg: string) => ReactNode) => blocks.push({ key, label, node: render(bgFor(blocks.length + 1)) });

  for (const s of sections) {
    switch (s) {
      case 'services':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="What we do" p={p} bg={bg}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {services.map((name) => (
                <div key={name} style={{ background: bg === p.bg ? p.surface : p.bg, borderRadius: 14, padding: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: p.primary, opacity: 0.85, marginBottom: 14 }} />
                  <div style={{ fontWeight: 700, fontSize: 18, color: p.text, marginBottom: 10 }}>{name}</div>
                  <Lines n={2} color={p.text} />
                </div>
              ))}
            </div>
          </Block>
        ));
        break;
      case 'about':
        add(s, SECTIONS[s].name, (bg) => (
          <Block p={p} bg={bg}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
              <Img p={p} h={220} tint={1} />
              <div>
                <h3 style={{ margin: '0 0 18px', fontSize: 28, color: p.text, fontFamily: 'var(--site-heading)' }}>About us</h3>
                <Lines n={4} color={p.text} widths={[100, 96, 88, 60]} />
              </div>
            </div>
          </Block>
        ));
        break;
      case 'gallery':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="Our work" p={p} bg={bg}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Img key={i} p={p} h={130} tint={i} />
              ))}
            </div>
          </Block>
        ));
        break;
      case 'testimonials':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="What people say" p={p} bg={bg}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              {['Sam R.', 'Jordan P.'].map((n) => (
                <div key={n} style={{ background: bg === p.bg ? p.surface : p.bg, borderRadius: 14, padding: 22 }}>
                  <div style={{ color: p.primary, fontSize: 20, marginBottom: 10 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <Lines n={2} color={p.text} />
                  <div style={{ marginTop: 14, fontWeight: 700, color: p.text }}>{n}</div>
                </div>
              ))}
            </div>
          </Block>
        ));
        break;
      case 'pricing':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="Prices" p={p} bg={bg}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {['$29', '$59', '$99'].map((price, i) => (
                <div key={price} style={{ borderRadius: 14, padding: 22, background: i === 1 ? p.primary : bg === p.bg ? p.surface : p.bg, color: i === 1 ? p.onPrimary : p.text }}>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>{price}</div>
                  <div style={{ margin: '12px 0' }}>
                    <Lines n={3} color={i === 1 ? p.onPrimary : p.text} />
                  </div>
                </div>
              ))}
            </div>
          </Block>
        ));
        break;
      case 'team':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="Meet the team" p={p} bg={bg}>
            <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
              {[biz.ownerName.split(' ')[0], 'Alex', 'Jamie'].map((n) => (
                <div key={n} style={{ textAlign: 'center' }}>
                  <div style={{ width: 110, height: 110, borderRadius: 999, background: p.primary, opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontWeight: 700, color: p.text }}>{n}</div>
                </div>
              ))}
            </div>
          </Block>
        ));
        break;
      case 'faq':
        add(s, SECTIONS[s].name, (bg) => (
          <Block title="Questions" p={p} bg={bg}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${p.text}1f` }}>
                <div style={{ width: '60%' }}>
                  <Lines n={1} color={p.text} />
                </div>
                <span style={{ color: p.primary, fontSize: 24, fontWeight: 700 }}>+</span>
              </div>
            ))}
          </Block>
        ));
        break;
    }
  }

  // Features that show up as their own block.
  if (has('menu'))
    add('menu', 'Menu', (bg) => (
      <Block title="Menu" p={p} bg={bg}>
        {['Starters', 'Mains', 'Desserts'].map((c) => (
          <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px dotted ${p.text}44`, color: p.text, fontSize: 18 }}>
            <span>{c}</span>
            <span style={{ color: p.primary, fontWeight: 700 }}>$12</span>
          </div>
        ))}
      </Block>
    ));
  if (has('booking'))
    add('booking', 'Booking', (bg) => (
      <Block title="Book an appointment" p={p} bg={bg}>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
            <div key={d} style={{ flex: 1, textAlign: 'center', padding: '18px 0', borderRadius: 12, fontWeight: 700, background: i === 2 ? p.primary : bg === p.bg ? p.surface : p.bg, color: i === 2 ? p.onPrimary : p.text }}>
              {d}
            </div>
          ))}
        </div>
      </Block>
    ));
  if (has('online_store') || has('listings'))
    add('store', has('listings') ? 'Listings' : 'Shop', (bg) => (
      <Block title={has('listings') ? 'Homes for sale' : 'Shop online'} p={p} bg={bg}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Img p={p} h={120} tint={i} />
              <div style={{ marginTop: 10, fontWeight: 700, color: p.text }}>{has('listings') ? `$${340 + i * 45}k` : `$${8 + i * 4}.00`}</div>
            </div>
          ))}
        </div>
      </Block>
    ));
  if (has('blog'))
    add('blog', 'Blog', (bg) => (
      <Block title="Latest news" p={p} bg={bg}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Img p={p} h={110} tint={i} />
              <div style={{ marginTop: 12 }}>
                <Lines n={2} color={p.text} />
              </div>
            </div>
          ))}
        </div>
      </Block>
    ));
  if (design.sections.includes('contact') || has('contact_form') || has('maps'))
    add('contact', 'Contact', (bg) => (
      <Block title="Get in touch" p={p} bg={bg}>
        <div style={{ display: 'grid', gridTemplateColumns: has('maps') ? '1fr 1fr' : '1fr', gap: 30 }}>
          {has('contact_form') ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {['Name', 'Email', 'Message'].map((l) => (
                <div key={l} style={{ height: l === 'Message' ? 90 : 44, borderRadius: 10, border: `2px solid ${p.text}22`, background: p.bg, padding: '10px 14px', color: p.muted }}>{l}</div>
              ))}
              <span style={{ ...btn, justifySelf: 'start' }}>Send</span>
            </div>
          ) : (
            <div style={{ fontSize: 22, color: p.text, fontWeight: 700 }}>Call us: {biz.phone}</div>
          )}
          {has('maps') && (
            <div style={{ borderRadius: 14, background: p.surface, minHeight: 200, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${p.text}14 2px, transparent 2px), linear-gradient(90deg, ${p.text}14 2px, transparent 2px)`, backgroundSize: '40px 40px' }} />
              <div style={{ position: 'absolute', left: '48%', top: '40%', width: 26, height: 26, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: p.primary }} />
            </div>
          )}
        </div>
      </Block>
    ));

  // Header + hero count as the first block.
  const total = blocks.length + 1;
  const isBuilt = (i: number) => built >= 1 || (i + 1) / total <= built + 1e-9;

  return (
    <div className="site-frame">
      <div className="site-chrome">
        <span />
        <span />
        <span />
        <div className="site-url">{slug}.com</div>
      </div>
      <div ref={ref} className="site-viewport">
        <motion.div
          style={
            {
              width: SITE_WIDTH,
              zoom: scale,
              background: p.bg,
              color: p.text,
              fontFamily: f.body,
              '--site-heading': f.heading,
            } as CSSProperties
          }
          key={`${design.palette}-${design.font}-${design.layout}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={spring}
        >
          {isBuilt(0) ? (
            <>
              <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 56px', background: design.layout === 'bold' ? p.primary : p.bg, color: design.layout === 'bold' ? p.onPrimary : p.text }}>
                <div style={{ fontWeight: 800, fontSize: 22, fontFamily: 'var(--site-heading)' }}>{biz.name}</div>
                <div style={{ display: 'flex', gap: 26, fontSize: 16, opacity: 0.8 }}>
                  {design.sections.slice(0, 4).map((s) => (
                    <span key={s}>{SECTIONS[s].name}</span>
                  ))}
                </div>
              </nav>
              {heroes[design.layout]}
            </>
          ) : (
            <Skeleton label="Header & home page" />
          )}
          {blocks.map((b, i) => (
            <div key={b.key}>{isBuilt(i + 1) ? b.node : <Skeleton label={b.label} />}</div>
          ))}
          <footer style={{ padding: '28px 56px', background: p.text, color: p.bg, fontSize: 15, opacity: 0.92 }}>
            &copy; {biz.name} &middot; {biz.phone}
          </footer>
        </motion.div>
      </div>
    </div>
  );
}
