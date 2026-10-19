import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { navigate, useRoute, type Route } from './core/router';
import { actions, getState, useStore } from './core/store';
import { audio } from './core/audio';
import { useReducedMotion } from './core/hooks';
import { EQ_BY_ID, EQUATIONS } from './data/equations';
import { EXPERIENCES } from './experiences/registry';
import { ExperienceProvider } from './components/ExperienceShell';
import { TopNav } from './components/TopNav';
import { HelpOverlay, IndexOverlay, SettingsOverlay } from './components/Overlays';
import { Intro } from './components/Intro';
import { Universe } from './components/Universe';

export type OverlayKind = null | 'index' | 'help' | 'settings';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  componentDidCatch(error: Error) {
    console.error('Experience crashed:', error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="error-box" role="alert">
          <h2>This experiment hit a problem</h2>
          <p>{this.state.error.message}</p>
          <p>The rest of the site still works. You can retry or return to the universe.</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              Retry
            </button>
            <button className="btn" onClick={() => navigate({ name: 'universe' })}>
              Back to the universe
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

export function App() {
  const route = useRoute();
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const [portal, setPortal] = useState<{ x: number; y: number; a: string; b: string; key: number } | null>(null);
  const sound = useStore((s) => s.settings.sound);
  const reduced = useReducedMotion();

  useEffect(() => {
    audio.setMuted(!sound);
  }, [sound]);

  // Audio may only start after a user gesture: begin on the first interaction anywhere
  // (visitors who deep-link past the intro), unless that interaction is the mute toggle itself.
  useEffect(() => {
    const first = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-sound-toggle]')) return;
      if (getState().settings.sound) audio.start();
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced', reduced);
  }, [reduced]);

  // record visits & set document title
  useEffect(() => {
    if (route.name === 'equation') {
      const eq = EQ_BY_ID[route.id];
      if (eq) {
        actions.visit(eq.id);
        document.title = `${eq.name} — 17 Equations That Changed the World`;
        audio.setMood((eq.num - 1) / 16);
      }
    } else document.title = '17 Equations That Changed the World';
    window.scrollTo(0, 0);
    setOverlay(null);
  }, [route]);

  /** Animated "portal" into an equation from a point on screen. */
  const enter = useCallback(
    (id: string, x?: number, y?: number) => {
      const eq = EQ_BY_ID[id];
      if (!eq) return;
      audio.swell();
      if (reduced || x === undefined || y === undefined) {
        navigate({ name: 'equation', id });
        return;
      }
      setPortal({ x, y, a: eq.palette.a, b: eq.palette.b, key: Date.now() });
      window.setTimeout(() => navigate({ name: 'equation', id }), 430);
      window.setTimeout(() => setPortal(null), 950);
    },
    [reduced],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (overlay) setOverlay(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (route.name === 'intro') return;
      const k = e.key.toLowerCase();
      if (route.name === 'equation' && (k === 'arrowright' || k === 'arrowleft') && !overlay) {
        const i = EQUATIONS.findIndex((q) => q.id === route.id);
        const n = EQUATIONS[(i + (k === 'arrowright' ? 1 : EQUATIONS.length - 1)) % EQUATIONS.length];
        navigate({ name: 'equation', id: n.id });
      } else if (k === 'i') setOverlay((o) => (o === 'index' ? null : 'index'));
      else if (k === '?' || k === 'h') setOverlay((o) => (o === 'help' ? null : 'help'));
      else if (k === 'm') actions.setSettings({ sound: !getState().settings.sound });
      else if (k === 'u') navigate({ name: 'universe' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, overlay]);

  return (
    <div className="app">
      {route.name !== 'intro' && <TopNav route={route} onOverlay={setOverlay} />}
      <main className="app-main" id="main">
        <RouteView route={route} enter={enter} />
      </main>
      {overlay === 'index' && <IndexOverlay onClose={() => setOverlay(null)} onEnter={(id) => enter(id)} />}
      {overlay === 'help' && <HelpOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && <SettingsOverlay onClose={() => setOverlay(null)} />}
      {portal && (
        <div className="portal" key={portal.key} aria-hidden>
          <div className="portal-disc" style={{ left: portal.x, top: portal.y, ['--pa' as string]: portal.a, ['--pb' as string]: portal.b }} />
        </div>
      )}
      <div className="grain" aria-hidden />
    </div>
  );
}

function RouteView({ route, enter }: { route: Route; enter: (id: string, x?: number, y?: number) => void }) {
  if (route.name === 'intro') return <Intro />;
  if (route.name === 'universe') return <Universe onEnter={enter} />;
  const Exp = EXPERIENCES[route.id];
  const eq = EQ_BY_ID[route.id];
  if (!Exp || !eq)
    return (
      <div className="error-box">
        <h2>Unknown equation</h2>
        <button className="btn" onClick={() => navigate({ name: 'universe' })}>
          Back to the universe
        </button>
      </div>
    );
  return (
    <ErrorBoundary resetKey={route.id}>
      <Suspense
        fallback={
          <div className="loading" style={{ ['--a' as string]: eq.palette.a }}>
            <div>
              <div className="loading-orbit" />
              Assembling {eq.name}
            </div>
          </div>
        }
      >
        <ExperienceProvider id={route.id} key={route.id}>
          <Exp />
        </ExperienceProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
