import { EQ_BY_ID, EQUATIONS } from '../data/equations';
import { navigate, type Route } from '../core/router';
import { actions, useStore } from '../core/store';
import { audio } from '../core/audio';
import { Icon } from './Controls';
import type { OverlayKind } from '../App';

export function TopNav({ route, onOverlay }: { route: Route; onOverlay: (o: OverlayKind) => void }) {
  const visited = useStore((s) => s.visited);
  const completed = useStore((s) => s.completed);
  const sound = useStore((s) => s.settings.sound);
  const currentId = route.name === 'equation' ? route.id : null;
  const current = currentId ? EQ_BY_ID[currentId] : null;
  const idx = current ? EQUATIONS.indexOf(current) : -1;

  const go = (d: number) => {
    const n = EQUATIONS[(idx + d + EQUATIONS.length) % EQUATIONS.length];
    navigate({ name: 'equation', id: n.id });
  };

  return (
    <nav className="topnav" aria-label="Primary">
      <button type="button" className="brand" onClick={() => navigate({ name: 'universe' })} title="Return to the universe (U)">
        <span className="brand-mark">17</span>
        <span className="brand-text">
          Equations that
          <br />
          changed the world
        </span>
      </button>
      {current && <span className="nav-current">{String(current.num).padStart(2, '0')} · {current.name}</span>}
      <div className="nav-progress" aria-label="Your progress through the 17 equations">
        {EQUATIONS.map((e) => {
          const total = e.challenges.length;
          const done = e.challenges.filter((c) => completed[c.id]).length;
          const cls = [
            'nav-dot',
            visited[e.id] ? 'visited' : '',
            done === total ? 'complete' : '',
            e.id === currentId ? 'current' : '',
          ].join(' ');
          return (
            <button
              key={e.id}
              type="button"
              className={cls}
              style={{ ['--dot' as string]: e.palette.a }}
              title={`${e.num}. ${e.name} — ${done}/${total} experiments`}
              aria-label={`${e.num}. ${e.name}${visited[e.id] ? ', visited' : ''}, ${done} of ${total} experiments done`}
              aria-current={e.id === currentId ? 'page' : undefined}
              onClick={() => navigate({ name: 'equation', id: e.id })}
            />
          );
        })}
      </div>
      <div className="nav-actions">
        {current && (
          <>
            <button type="button" className="icon-btn" onClick={() => go(-1)} title="Previous equation (←)" aria-label="Previous equation">
              {Icon.prev}
            </button>
            <button type="button" className="icon-btn" onClick={() => go(1)} title="Next equation (→)" aria-label="Next equation">
              {Icon.next}
            </button>
          </>
        )}
        <button type="button" className="icon-btn" onClick={() => navigate({ name: 'universe' })} title="Universe map (U)" aria-label="Universe map">
          {Icon.home}
        </button>
        <button type="button" className="icon-btn" onClick={() => onOverlay('index')} title="Equation index (I)" aria-label="Equation index">
          {Icon.grid}
        </button>
        <button
          type="button"
          className="icon-btn"
          data-sound-toggle
          onClick={() => {
            const wasRunning = audio.ready;
            audio.start();
            // first press on a never-started engine with sound enabled: just start it
            if (!wasRunning && sound) return;
            actions.setSettings({ sound: !sound });
          }}
          title={sound ? 'Mute sound (M)' : 'Turn sound on (M)'}
          aria-label={sound ? 'Mute sound' : 'Turn sound on'}
          aria-pressed={!sound}
        >
          {sound ? Icon.sound : Icon.mute}
        </button>
        <button type="button" className="icon-btn" onClick={() => onOverlay('help')} title="Help (?)" aria-label="Help">
          {Icon.help}
        </button>
        <button type="button" className="icon-btn" onClick={() => onOverlay('settings')} title="Settings" aria-label="Settings">
          {Icon.gear}
        </button>
      </div>
    </nav>
  );
}
