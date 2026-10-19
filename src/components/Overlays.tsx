import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EQUATIONS } from '../data/equations';
import { actions, useStore } from '../core/store';
import { audio } from '../core/audio';
import { navigate } from '../core/router';
import { Btn, Icon, Segmented, Toggle } from './Controls';
import { Tex } from './Tex';

function OverlayFrame({ title, sub, onClose, children, narrow }: { title: string; sub?: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input')?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="icon-btn overlay-close" onClick={onClose} aria-label="Close">
        {Icon.close}
      </button>
      <div className={`overlay-inner ${narrow ? 'narrow' : ''}`} ref={ref}>
        <h2>{title}</h2>
        {sub && <p className="sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

export function IndexOverlay({ onClose, onEnter }: { onClose: () => void; onEnter: (id: string) => void }) {
  const visited = useStore((s) => s.visited);
  const completed = useStore((s) => s.completed);
  const favs = useStore((s) => s.favourites);
  const [filter, setFilter] = useState<'all' | 'favourites' | 'unvisited'>('all');
  const list = EQUATIONS.filter((e) => (filter === 'favourites' ? favs.includes(e.id) : filter === 'unvisited' ? !visited[e.id] : true));
  const totalCh = EQUATIONS.reduce((s, e) => s + e.challenges.length, 0);
  const doneCh = Object.keys(completed).length;
  return (
    <OverlayFrame
      title="The Index"
      sub={`${Object.keys(visited).length} of 17 visited · ${doneCh} of ${totalCh} guided experiments completed`}
      onClose={onClose}
    >
      <div className="index-filter">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All 17' },
            { value: 'favourites', label: `Bookmarked (${favs.length})` },
            { value: 'unvisited', label: 'Not yet visited' },
          ]}
        />
      </div>
      {list.length === 0 && <p className="sub">Nothing here yet — bookmark equations with the ☆ in each experience.</p>}
      <div className="index-grid">
        {list.map((e) => {
          const done = e.challenges.filter((c) => completed[c.id]).length;
          return (
            <button
              key={e.id}
              type="button"
              className="index-card"
              style={{ ['--ca' as string]: e.palette.a }}
              onClick={() => {
                onClose();
                onEnter(e.id);
              }}
            >
              {favs.includes(e.id) && <span className="ic-star">{Icon.star}</span>}
              <span className="ic-num">{String(e.num).padStart(2, '0')} · {e.era}</span>
              <span className="ic-name">{e.name}</span>
              <span className="ic-eq">
                <Tex tex={e.tex} />
              </span>
              <span className="ic-meta">
                <span>{visited[e.id] ? 'Visited' : 'New'}</span>
                <span className="ic-bar">
                  <i style={{ width: `${(done / e.challenges.length) * 100}%` }} />
                </span>
                <span>
                  {done}/{e.challenges.length}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </OverlayFrame>
  );
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <OverlayFrame title="How to explore" sub="Every visual here is driven by a real mathematical model." onClose={onClose} narrow>
      <div className="prose">
        <p className="lede">Each equation is a small laboratory. Change a variable and the mathematics, the numbers and the picture respond together.</p>
        <h3>In each experience</h3>
        <p>
          <strong>See it</strong> — the scene opens by demonstrating the phenomenon. <strong>Experiment</strong> — sliders, buttons and direct
          dragging on the canvas change the model; readouts show live numerical results. <strong>Understand</strong> explains every symbol,{' '}
          <strong>Why it mattered</strong> covers history, applications and links to related equations, and <strong>Go deeper</strong> holds
          derivations and details of the numerical methods.
        </p>
        <p>
          Guided experiments pose a question and detect when you have done it. Switch to <em>discovery mode</em> in Settings to explore freely
          instead.
        </p>
        <h3>Keyboard</h3>
        <dl className="symbols">
          {[
            ['← →', 'Previous / next equation'],
            ['U', 'Universe map'],
            ['I', 'Equation index'],
            ['M', 'Mute / unmute'],
            ['? or H', 'This help'],
            ['Esc', 'Close a panel'],
            ['Tab', 'Move between controls; arrow keys adjust a focused slider'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h3>Honesty about models</h3>
        <p>
          Simulations are faithful to the stated model but simplified: 2-D slices, finite grids, idealised geometry. Each experience lists its
          limitations under “Limits &amp; caveats”. Nothing here is financial advice.
        </p>
        <h3>Privacy</h3>
        <p>Progress, bookmarks and settings are stored only in this browser. No accounts, no tracking, no external services.</p>
      </div>
    </OverlayFrame>
  );
}

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <OverlayFrame title="Settings" onClose={onClose} narrow>
      <div className="controls" style={{ gap: 22 }}>
        <Toggle
          label="Sound — ambient drone and interaction tones"
          checked={settings.sound}
          onChange={(v) => {
            audio.start();
            actions.setSettings({ sound: v });
          }}
        />
        <Segmented
          label="Learning mode"
          value={settings.guided ? 'guided' : 'discovery'}
          onChange={(v) => actions.setSettings({ guided: v === 'guided' })}
          options={[
            { value: 'guided', label: 'Guided — step-by-step experiments' },
            { value: 'discovery', label: 'Discovery — explore freely' },
          ]}
        />
        <Segmented
          label="Motion"
          value={settings.motion}
          onChange={(v) => actions.setSettings({ motion: v })}
          options={[
            { value: 'system', label: 'Follow system' },
            { value: 'reduced', label: 'Reduced' },
            { value: 'full', label: 'Full' },
          ]}
        />
        <Segmented
          label="Rendering quality"
          value={settings.quality}
          onChange={(v) => actions.setSettings({ quality: v })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'high', label: 'High' },
            { value: 'low', label: 'Battery saver' },
          ]}
        />
        <div className="btn-row">
          <Btn
            onClick={() => {
              onClose();
              navigate({ name: 'intro' });
            }}
          >
            Replay introduction
          </Btn>
          {!confirm ? (
            <Btn onClick={() => setConfirm(true)}>Reset progress &amp; bookmarks…</Btn>
          ) : (
            <>
              <Btn
                variant="primary"
                onClick={() => {
                  actions.resetProgress();
                  setConfirm(false);
                }}
              >
                Yes, reset local progress
              </Btn>
              <Btn onClick={() => setConfirm(false)}>Cancel</Btn>
            </>
          )}
        </div>
        <p className="responds" style={{ marginTop: 0 }}>
          Everything is stored only in this browser’s local storage.
        </p>
      </div>
    </OverlayFrame>
  );
}
