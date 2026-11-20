import { EQ_BY_ID, EQUATIONS } from '../data/equations';
import { navigate } from '../core/router';
import { Glyph } from './Glyph';
import { Rich, Tex } from './Tex';

const TIP_URL = 'https://buymeacoffee.com/atomictime';
const REPO_URL = 'https://github.com/atomictime01-netizen/17-equations';

/** Real test names from src/math/math.test.ts, each tagged with the equation it checks. */
const TESTS: [string, string, string][] = [
  ['fourier', 'Fourier', 'FFT matches the naive DFT'],
  ['black-scholes', 'Black–Scholes', 'Crank–Nicolson PDE solution agrees with the closed form'],
  ['schrodinger', 'Schrödinger', 'harmonic oscillator energies ħω(n + ½)'],
  ['gravity', 'Gravitation', 'Earth–Sun force and one-year orbit'],
  ['maxwell', 'Maxwell', 'Yee FDTD pulse travels at c'],
  ['navier-stokes', 'Navier–Stokes', 'projection leaves a divergence-free field'],
  ['wave', 'Wave', '2-D membrane energy is conserved without damping'],
  ['chaos', 'Chaos', 'Lyapunov exponent is ln 2 at r = 4'],
];

/** The tabs every experience has, in the order a visitor meets them. */
const LAYERS: { name: string; what: string }[] = [
  { name: 'See it', what: 'An opening demonstration plays before you touch anything.' },
  { name: 'Understand', what: 'Every symbol in the equation, named and explained.' },
  { name: 'Experiment', what: 'Controls, live readouts and guided experiments.' },
  { name: 'Why it mattered', what: 'History, applications, connections and caveats.' },
  { name: 'Go deeper', what: 'Derivations and notes on the numerical method.' },
];

const FAQ: [string, string][] = [
  ['Is it free?', 'Yes, all of it. There is no paywall, no account and no premium tier. Tips are optional and unlock nothing.'],
  ['Is my data safe?', 'The app makes no network calls while you use it. Progress, bookmarks and settings stay in this browser’s local storage, and “reset progress” in Settings clears them.'],
  ['Does it work offline?', 'Yes. After the first visit a service worker keeps about 2 MB cached, and supporting browsers offer to install it as an app.'],
  ['Can I use it in a classroom, or commercially?', 'Yes. The code is MIT licensed: use, change and host it, keeping the copyright and licence notice. This is general information, not legal advice.'],
  ['Are the simulations exact?', 'They are real numerical models, not scripted animations, but they are simplified. Each one lists what it leaves out under “Limits & caveats”. Nothing here is investment advice.'],
  ['How do I contribute?', 'Report a bug or send a fix on GitHub; CONTRIBUTING.md has the setup. A star or a share with a teacher helps too.'],
];

export function About() {
  const p = EQ_BY_ID['pythagoras'];
  const challenge = p.challenges.find((c) => c.auto) ?? p.challenges[0];
  const sch = EQ_BY_ID['schrodinger'];

  return (
    <div className="about" id="about">
      {/* ── 1. what makes it different ── */}
      <section className="ab-sec ab-diff" aria-labelledby="ab-diff-h">
        <header className="ab-head">
          <div className="uni-kicker">Under the hood</div>
          <h2 id="ab-diff-h" className="ab-title">
            Instruments, <em>not illustrations</em>
          </h2>
          <p className="ab-lede">Every equation is driven by a working model. Change a variable and the mathematics, the numbers and the picture move together.</p>
        </header>

        <div className="ab-claim">
          <div className="ab-claim-text">
            <h3>The solvers are real, and tested.</h3>
            <p>
              Navier–Stokes runs a fluid solver in a Web Worker. The wave equation steps with a Courant-safe time step. The Fourier lab’s FFT is checked against a direct DFT.{' '}
              <b>35 automated tests</b> compare each model with an independent result.
            </p>
          </div>
          <figure className="ab-term" aria-label="Excerpt from the project's test run">
            <div className="ab-term-bar">
              <span />
              <span />
              <span />
              <code>npm test</code>
            </div>
            <ul>
              {TESTS.map(([id, label, name]) => (
                <li key={name} style={{ ['--a' as string]: EQ_BY_ID[id].palette.a }}>
                  <i aria-hidden>✓</i>
                  <span className="t-eq">{label}</span>
                  <span className="t-name">{name}</span>
                </li>
              ))}
            </ul>
            <div className="ab-term-sum">
              Tests <b>35 passed</b> (35)
            </div>
          </figure>
        </div>

        <div className="ab-claim flip">
          <div className="ab-claim-text">
            <h3>Nothing leaves your browser.</h3>
            <p>No account, no API keys, no analytics. Fonts, KaTeX, Three.js and the map of the Earth are bundled, so after the first visit it runs with the network switched off.</p>
          </div>
          <dl className="ab-readout">
            <div>
              <dt>Network requests while you explore</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>Accounts needed</dt>
              <dd>0</dd>
            </div>
            <div>
              <dt>Cached for offline use</dt>
              <dd>
                ≈2<small> MB</small>
              </dd>
            </div>
            <div>
              <dt>Where your progress lives</dt>
              <dd className="word">this browser</dd>
            </div>
          </dl>
        </div>

        <div className="ab-claim">
          <div className="ab-claim-text">
            <h3>The experiments notice what you did.</h3>
            <p>Guided experiments watch the model and tick themselves off when you actually get there. Prefer to wander? Switch to discovery mode in Settings.</p>
          </div>
          <figure className="ab-chal" style={{ ['--a' as string]: p.palette.a, ['--b' as string]: p.palette.b }}>
            <div className="ab-chal-top">
              <span className="ab-chal-glyph">
                <Glyph kind={p.glyph} />
              </span>
              <span>
                {String(p.num).padStart(2, '0')} · {p.name}
              </span>
            </div>
            <p className="ab-chal-prompt">
              <Rich text={challenge.prompt} />
            </p>
            <p className="ab-chal-hint">
              Hint: <Rich text={challenge.hint} />
            </p>
            <div className="ab-chal-done">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <b>Detected.</b> <Rich text={challenge.observe} />
              </span>
            </div>
          </figure>
        </div>
      </section>

      {/* ── 2. the layers inside every equation ── */}
      <section className="ab-sec ab-layers" aria-labelledby="ab-layers-h" style={{ ['--a' as string]: sch.palette.a, ['--b' as string]: sch.palette.b }}>
        <div className="ab-layers-eq">
          <div className="uni-kicker">Inside every equation</div>
          <h2 id="ab-layers-h" className="ab-title">
            Five layers, <em>one model</em>
          </h2>
          <div className="ab-layers-tex">
            <Tex tex={sch.tex} display />
          </div>
          <p className="ab-lede">Open any of the seventeen and you get the same path, from watching to understanding to breaking it yourself.</p>
        </div>
        <ol className="ab-path">
          {LAYERS.map((l, i) => (
            <li key={l.name} style={{ ['--i' as string]: i }}>
              <span className="ab-node" aria-hidden />
              <strong>{l.name}</strong>
              <span>{l.what}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 3. honest comparison ── */}
      <section className="ab-sec" aria-labelledby="ab-cmp-h">
        <header className="ab-head narrow">
          <div className="uni-kicker">Compared honestly</div>
          <h2 id="ab-cmp-h" className="ab-title">
            Where it wins, <em>and where it doesn’t</em>
          </h2>
        </header>
        <div className="ab-tablewrap" tabIndex={0} role="region" aria-label="Comparison with other ways to learn; scrolls sideways on small screens">
          <table className="ab-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Aspect</span>
                </th>
                <th scope="col" className="us">
                  17 Equations
                </th>
                <th scope="col">Explainer videos</th>
                <th scope="col">Graphing tools</th>
                <th scope="col">Textbooks &amp; Wikipedia</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">You</th>
                <td className="us">Poke a ready-made model</td>
                <td>Watch, and pause to think</td>
                <td>Build the model yourself</td>
                <td>Read, derive, check</td>
              </tr>
              <tr>
                <th scope="row">Best at</th>
                <td className="us">Feeling how one variable moves the rest</td>
                <td>Narrative and intuition, on far more topics</td>
                <td>Open-ended play with any function</td>
                <td>Rigour, coverage and citations</td>
              </tr>
              <tr>
                <th scope="row">Weak at</th>
                <td className="us">Only 17 topics; simplified models; not a curriculum</td>
                <td>You can’t change the parameters</td>
                <td>No guidance on what to plot</td>
                <td>Nothing moves</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. pricing: free, plus an optional tip ── */}
      <section className="ab-sec ab-free" id="support" aria-labelledby="ab-free-h">
        <div className="ab-free-main">
          <div className="uni-kicker">Pricing</div>
          <h2 id="ab-free-h" className="ab-free-big">
            Free<span>.</span>
          </h2>
          <p className="ab-lede">One version, and you already have all of it. Open source under the MIT licence.</p>
          <ul className="ab-glyphs" aria-label="All seventeen labs are included">
            {EQUATIONS.map((e) => (
              <li key={e.id} title={e.name} style={{ ['--a' as string]: e.palette.a }}>
                <Glyph kind={e.glyph} />
              </li>
            ))}
          </ul>
          <ul className="ab-incl">
            <li>All 17 labs, every guided experiment and derivation</li>
            <li>Offline use, and installable as an app</li>
            <li>No account, no paywall, no ads, no tracking</li>
            <li>The full source, to read, run, change and host</li>
          </ul>
        </div>
        <aside className="ab-tip" aria-labelledby="ab-tip-h">
          <svg className="ab-tip-cup" viewBox="0 0 48 48" aria-hidden>
            <path d="M10 18h24v12a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M34 21h3a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M17 7c-2 3 2 4 0 7M24 6c-2 3 2 4 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          </svg>
          <h3 id="ab-tip-h">Liked it? Buy me a coffee.</h3>
          <p>A tip pays for the hours behind the next lab. It is never required and it unlocks nothing; the labs stay free either way.</p>
          <a className="btn btn-primary ab-tip-btn" href={TIP_URL} target="_blank" rel="noopener noreferrer">
            Buy me a coffee
          </a>
          <p className="ab-tip-alt">
            Or help for free: <a href={REPO_URL} target="_blank" rel="noopener noreferrer">star the repo</a>, share it with a teacher, or report a bug.
          </p>
        </aside>
      </section>

      {/* ── 5. questions ── */}
      <section className="ab-sec" aria-labelledby="ab-faq-h">
        <header className="ab-head narrow">
          <div className="uni-kicker">Questions</div>
          <h2 id="ab-faq-h" className="ab-title">
            Short <em>answers</em>
          </h2>
        </header>
        <div className="ab-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── closing ── */}
      <section className="ab-sec ab-end" aria-labelledby="ab-end-h">
        <h2 id="ab-end-h" className="ab-title">
          Start with the one <em>you half remember</em>
        </h2>
        <div className="ab-end-row">
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'equation', id: 'pythagoras' })}>
            Begin with Pythagoras
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => document.querySelector('.universe')?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to the globe
          </button>
        </div>
      </section>

      <footer className="ab-foot">
        <span>
          MIT licensed · made by{' '}
          <a href="https://github.com/atomictime01-netizen" target="_blank" rel="noopener noreferrer">
            atomictime01-netizen
          </a>
        </span>
        <nav aria-label="Project links">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener noreferrer">
            Changelog
          </a>
          <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
            Licence
          </a>
          <a href={TIP_URL} target="_blank" rel="noopener noreferrer">
            Buy me a coffee
          </a>
        </nav>
      </footer>
    </div>
  );
}
