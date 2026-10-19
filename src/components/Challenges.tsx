import { useEffect, useState } from 'react';
import type { Equation } from '../data/equations';
import { actions, useStore } from '../core/store';
import { Icon } from './Controls';
import { Rich } from './Tex';

/**
 * Guided experiments. In guided mode one challenge is presented at a time with a hint and an
 * expected observation; in discovery mode they appear as a compact checklist. Many challenges are
 * detected automatically by the experience; any can also be marked done by hand.
 */
export function Challenges({ eq, mode }: { eq: Equation; mode: 'guided' | 'list' }) {
  const completed = useStore((s) => s.completed);
  const firstOpen = Math.max(0, eq.challenges.findIndex((c) => !completed[c.id]));
  const [i, setI] = useState(firstOpen);
  const [showHint, setShowHint] = useState(false);
  const [showObs, setShowObs] = useState(false);
  const doneCount = eq.challenges.filter((c) => completed[c.id]).length;
  const ch = eq.challenges[Math.min(i, eq.challenges.length - 1)];
  const isDone = !!completed[ch.id];

  useEffect(() => {
    setShowHint(false);
    setShowObs(false);
  }, [i]);
  useEffect(() => {
    if (isDone) setShowObs(true);
  }, [isDone]);

  if (mode === 'list') {
    return (
      <details className="challenge-list">
        <summary>
          Guided experiments <span className="cl-count">{doneCount}/{eq.challenges.length}</span>
        </summary>
        <ul>
          {eq.challenges.map((c) => (
            <li key={c.id} className={completed[c.id] ? 'done' : ''}>
              <button
                type="button"
                className="cl-check"
                aria-pressed={!!completed[c.id]}
                title={completed[c.id] ? 'Mark as not done' : 'Mark as done'}
                onClick={() => (completed[c.id] ? actions.uncomplete(c.id) : actions.complete(c.id))}
              >
                {completed[c.id] && Icon.check}
              </button>
              <div>
                <div className="cl-prompt">{c.prompt}</div>
                <div className="cl-hint">{c.hint}</div>
                {completed[c.id] && <div className="cl-obs">{c.observe}</div>}
              </div>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <section className={`guide ${isDone ? 'is-done' : ''}`} aria-label="Guided experiment">
      <div className="guide-head">
        <span className="guide-kicker">
          Guided experiment {i + 1} / {eq.challenges.length}
        </span>
        <div className="guide-dots" aria-hidden>
          {eq.challenges.map((c, k) => (
            <span key={c.id} className={`${completed[c.id] ? 'done' : ''} ${k === i ? 'cur' : ''}`} />
          ))}
        </div>
      </div>
      <p className="guide-prompt">
        {isDone && <span className="guide-check">{Icon.check}</span>}
        <Rich text={ch.prompt} />
      </p>
      {showHint && !isDone && <p className="guide-hint">{ch.hint}</p>}
      {showObs && (
        <p className="guide-obs">
          <span>What to notice</span>
          {ch.observe}
        </p>
      )}
      <div className="guide-actions">
        {!isDone && !showHint && (
          <button type="button" className="chip" onClick={() => setShowHint(true)}>
            Hint
          </button>
        )}
        {!showObs && (
          <button type="button" className="chip" onClick={() => setShowObs(true)}>
            What should I see?
          </button>
        )}
        {!isDone && (
          <button type="button" className="chip" onClick={() => actions.complete(ch.id)}>
            Mark done
          </button>
        )}
        <span className="grow" />
        <button type="button" className="chip icon" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous experiment">
          {Icon.prev}
        </button>
        <button
          type="button"
          className="chip icon"
          disabled={i >= eq.challenges.length - 1}
          onClick={() => setI(i + 1)}
          aria-label="Next experiment"
        >
          {Icon.next}
        </button>
      </div>
    </section>
  );
}
