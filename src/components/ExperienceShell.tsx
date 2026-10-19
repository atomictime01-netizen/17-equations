import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { EQ_BY_ID, EQUATIONS, type Equation } from '../data/equations';
import { actions, getState, useStore } from '../core/store';
import { audio } from '../core/audio';
import { navigate } from '../core/router';
import { useReducedMotion } from '../core/hooks';
import { Rich, Tex } from './Tex';
import { Btn, Icon } from './Controls';
import { Challenges } from './Challenges';

interface ExperienceCtx {
  eq: Equation;
  goal: (id: string) => void;
}
const Ctx = createContext<ExperienceCtx | null>(null);

export function useExperience() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useExperience outside provider');
  return c;
}

/** Emits a challenge goal once, when `cond` first becomes true. */
export function useGoalWhen(id: string, cond: boolean) {
  const { goal } = useExperience();
  useEffect(() => {
    if (cond) goal(id);
  }, [cond, id, goal]);
}

export function ExperienceProvider({ id, children }: { id: string; children: ReactNode }) {
  const eq = EQ_BY_ID[id];
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number>();
  const goal = useCallback(
    (cid: string) => {
      const ch = eq.challenges.find((c) => c.id === cid);
      if (!ch) return;
      if (getState().completed[cid]) return;
      actions.complete(cid);
      audio.success();
      setToast(ch.prompt);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 3600);
    },
    [eq],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Ctx.Provider value={{ eq, goal }}>
      {children}
      {toast && (
        <div className="goal-toast" role="status">
          <span className="goal-toast-icon">{Icon.check}</span>
          <div>
            <div className="goal-toast-kicker">Experiment complete</div>
            <div>{toast}</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

type Tab = 'explore' | 'understand' | 'impact' | 'deeper';

export interface ShellProps {
  stage: ReactNode;
  toolbar?: ReactNode;
  controls: ReactNode;
  readouts?: ReactNode;
  notice?: ReactNode;
  onReset: () => void;
  legend?: ReactNode;
  stageClassName?: string;
}

export function ExperienceShell({ stage, toolbar, controls, readouts, notice, onReset, legend, stageClassName }: ShellProps) {
  const { eq } = useExperience();
  const [tab, setTab] = useState<Tab>('understand');
  const [intro, setIntro] = useState(true);
  const reduced = useReducedMotion();
  const favourite = useStore((s) => s.favourites.includes(eq.id));
  const guided = useStore((s) => s.settings.guided);
  const stageRef = useRef<HTMLDivElement>(null);
  const idx = EQUATIONS.findIndex((e) => e.id === eq.id);
  const prev = EQUATIONS[(idx + EQUATIONS.length - 1) % EQUATIONS.length];
  const next = EQUATIONS[(idx + 1) % EQUATIONS.length];

  useEffect(() => {
    setIntro(true);
    const t = window.setTimeout(() => setIntro(false), reduced ? 2200 : 3800);
    return () => window.clearTimeout(t);
  }, [eq.id, reduced]);

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div
      className="exp"
      style={{ ['--a' as string]: eq.palette.a, ['--b' as string]: eq.palette.b, ['--c' as string]: eq.palette.c }}
    >
      <section className={`stage ${stageClassName ?? ''}`} ref={stageRef} aria-label={`${eq.name} visualisation`}>
        <div className="stage-canvas">{stage}</div>
        <header className="stage-head">
          <div className="stage-kicker">
            <span className="stage-num">{String(eq.num).padStart(2, '0')}</span>
            <span className="stage-sep" />
            <span>{eq.era}</span>
          </div>
          <h1 className="stage-title">{eq.name}</h1>
          <div className="stage-eq">
            <Tex tex={eq.tex} display />
          </div>
        </header>
        {legend && <div className="stage-legend">{legend}</div>}
        <div className="stage-toolbar" role="toolbar" aria-label="Simulation controls">
          {toolbar}
          <Btn onClick={onReset} title="Reset this experiment" icon={Icon.reset} />
          <Btn onClick={toggleFullscreen} title="Full screen" icon={Icon.expand} />
        </div>
        {notice && <div className="stage-notice">{notice}</div>}
        <div className={`see-it ${intro ? 'show' : ''}`} onClick={() => setIntro(false)} aria-hidden={!intro}>
          <div className="see-it-inner">
            <div className="see-it-kicker">See it</div>
            <p>{eq.see}</p>
          </div>
        </div>
      </section>

      <aside className="panel" aria-label="Explanation and controls">
        <div className="panel-top">
          <div className="panel-title">
            <span className="panel-num">{String(eq.num).padStart(2, '0')}</span>
            <div>
              <div className="panel-name">{eq.name}</div>
              <div className="panel-short">{eq.short}</div>
            </div>
          </div>
          <button
            type="button"
            className={`fav ${favourite ? 'on' : ''}`}
            aria-pressed={favourite}
            title={favourite ? 'Remove bookmark' : 'Bookmark this equation'}
            onClick={() => {
              actions.toggleFavourite(eq.id);
              audio.click();
            }}
          >
            {favourite ? Icon.star : Icon.starOutline}
          </button>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {(
            [
              ['understand', 'Understand'],
              ['impact', 'Why it mattered'],
              ['deeper', 'Go deeper'],
              ['explore', 'Experiment'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              className={tab === t ? 'on' : ''}
              onClick={() => {
                setTab(t);
                audio.click();
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="panel-body" role="tabpanel">
          {tab === 'explore' && (
            <div className="tab-explore">
              {guided && <Challenges eq={eq} mode="guided" />}
              <div className="controls">{controls}</div>
              {readouts && <div className="readout-wrap">{readouts}</div>}
              <p className="responds">
                <Rich text={eq.responds} />
              </p>
              {!guided && <Challenges eq={eq} mode="list" />}
            </div>
          )}
          {tab === 'understand' && (
            <div className="prose">
              <p className="lede">
                <Rich text={eq.plain} />
              </p>
              <div className="eq-block">
                <Tex tex={eq.tex} display />
                {eq.texExtra?.map((t) => <Tex key={t} tex={t} display />)}
              </div>
              <h3>What each symbol means</h3>
              <dl className="symbols">
                {eq.symbols.map((s) => (
                  <div key={s.tex}>
                    <dt>
                      <Tex tex={s.tex} />
                    </dt>
                    <dd>
                      <strong>{s.name}.</strong> <Rich text={s.desc} />
                    </dd>
                  </div>
                ))}
              </dl>
              <h3>The problem</h3>
              <p>
                <Rich text={eq.problem} />
              </p>
              <h3>The breakthrough</h3>
              <p>
                <Rich text={eq.breakthrough} />
              </p>
            </div>
          )}
          {tab === 'impact' && (
            <div className="prose">
              <p className="lede">
                <Rich text={eq.impact} />
              </p>
              <h3>History</h3>
              <p className="people">{eq.people}</p>
              <p>
                <Rich text={eq.history} />
              </p>
              <h3>Where it shows up</h3>
              <div className="apps">
                {eq.applications.map((a) => (
                  <article key={a.title} className="app-card">
                    <h4>{a.title}</h4>
                    <p>
                      <Rich text={a.body} />
                    </p>
                  </article>
                ))}
              </div>
              <h3>Connected equations</h3>
              <ul className="links">
                {eq.connections.map((c) => {
                  const other = EQ_BY_ID[c.to];
                  if (!other) return null;
                  return (
                    <li key={c.to}>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ ['--la' as string]: other.palette.a }}
                        onClick={() => navigate({ name: 'equation', id: other.id })}
                      >
                        <span className="link-num">{String(other.num).padStart(2, '0')}</span>
                        <span className="link-name">{other.name}</span>
                        <span className="link-arrow">{Icon.next}</span>
                      </button>
                      <p>
                        <Rich text={c.why} />
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="caveat">
                <h4>Limits &amp; caveats</h4>
                <p>
                  <Rich text={eq.caveats} />
                </p>
              </div>
            </div>
          )}
          {tab === 'deeper' && (
            <div className="prose">
              {eq.deeper.map((d, i) => (
                <details key={d.title} open={i === 0} className="deeper">
                  <summary>{d.title}</summary>
                  <p>
                    <Rich text={d.body} />
                  </p>
                </details>
              ))}
              <div className="caveat">
                <h4>About this simulation</h4>
                <p>
                  <Rich text={eq.caveats} />
                </p>
              </div>
            </div>
          )}
        </div>
        <footer className="panel-foot">
          <button type="button" className="pn prev" onClick={() => navigate({ name: 'equation', id: prev.id })}>
            {Icon.prev}
            <span>
              <small>Previous</small>
              {prev.name}
            </span>
          </button>
          <button type="button" className="pn next" onClick={() => navigate({ name: 'equation', id: next.id })}>
            <span>
              <small>Next</small>
              {next.name}
            </span>
            {Icon.next}
          </button>
        </footer>
      </aside>
    </div>
  );
}
