import { useId, useState, type ReactNode } from 'react';
import { Tex } from './Tex';
import { audio } from '../core/audio';

export interface SliderProps {
  label: string;
  tex?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unit?: string;
  tip?: string;
  log?: boolean; // logarithmic slider mapping
  disabled?: boolean;
  marks?: { value: number; label: string }[];
}

/** Labelled range input with an accurate live readout and optional logarithmic mapping. */
export function Slider({ label, tex, value, min, max, step, onChange, format, unit, tip, log, disabled, marks }: SliderProps) {
  const id = useId();
  const toPos = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min));
  const fromPos = (p: number) => (log ? Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min))) : min + p * (max - min));
  const pos = Math.min(1, Math.max(0, toPos(value)));
  const display = format ? format(value) : String(value);
  return (
    <div className={`ctl slider ${disabled ? 'is-disabled' : ''}`}>
      <div className="ctl-row">
        <label htmlFor={id} className="ctl-label">
          {tex && <Tex tex={tex} className="ctl-sym" />}
          <span>{label}</span>
          {tip && <InfoTip text={tip} />}
        </label>
        <output htmlFor={id} className="ctl-value">
          {display}
          {unit && <span className="ctl-unit">{unit}</span>}
        </output>
      </div>
      <div className="range-wrap" style={{ ['--pos' as string]: pos }}>
        <input
          id={id}
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(pos * 1000)}
          disabled={disabled}
          aria-valuetext={`${display}${unit ? ' ' + unit : ''}`}
          onChange={(e) => {
            const p = Number(e.target.value) / 1000;
            let v = fromPos(p);
            if (step && !log) v = Math.round((v - min) / step) * step + min;
            if (step && log) v = Math.round(v / step) * step || step;
            v = Math.min(max, Math.max(min, Number(v.toPrecision(12))));
            onChange(v);
            audio.tick(p);
          }}
        />
        {marks && (
          <div className="range-marks" aria-hidden>
            {marks.map((m) => (
              <span key={m.label} style={{ left: `${toPos(m.value) * 100}%` }} title={m.label}>
                <i />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  small,
}: {
  label?: string;
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`ctl seg ${small ? 'seg-small' : ''}`} role="radiogroup" aria-label={label}>
      {label && <div className="ctl-label seg-label">{label}</div>}
      <div className="seg-track">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            title={o.title}
            className={o.value === value ? 'on' : ''}
            onClick={() => {
              onChange(o.value);
              audio.click();
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, tip }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; tip?: string }) {
  return (
    <label className="ctl toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
          audio.click();
        }}
      />
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
      {tip && <InfoTip text={tip} />}
    </label>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'ghost',
  title,
  disabled,
  pressed,
  icon,
}: {
  children?: ReactNode;
  onClick: () => void;
  variant?: 'ghost' | 'primary' | 'quiet';
  title?: string;
  disabled?: boolean;
  pressed?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${pressed ? 'is-pressed' : ''}`}
      onClick={() => {
        onClick();
        audio.click();
      }}
      title={title}
      aria-label={!children ? title : undefined}
      aria-pressed={pressed}
      disabled={disabled}
    >
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export interface ReadoutItem {
  label: string;
  value: ReactNode;
  tex?: string;
  accent?: boolean;
  hint?: string;
}

export function Readouts({ items, cols = 2 }: { items: ReadoutItem[]; cols?: number }) {
  return (
    <dl className="readouts" style={{ ['--cols' as string]: cols }} aria-live="polite">
      {items.map((it) => (
        <div key={it.label} className={`readout ${it.accent ? 'accent' : ''}`} title={it.hint}>
          <dt>
            {it.tex && <Tex tex={it.tex} />} <span>{it.label}</span>
          </dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warn' | 'event'; children: ReactNode }) {
  return (
    <div className={`callout callout-${tone}`} role="status">
      {children}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={`About: ${text}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="infotip-pop" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

export function ControlGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="ctl-group">
      {title && <h4 className="ctl-group-title">{title}</h4>}
      {children}
    </section>
  );
}

/** Small inline SVG icons used by toolbars. */
export const Icon = {
  play: <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>,
  pause: <svg viewBox="0 0 24 24" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>,
  reset: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor" /></svg>,
  step: <svg viewBox="0 0 24 24" aria-hidden><path d="M6 5v14l9-7zM16 5h3v14h-3z" fill="currentColor" /></svg>,
  star: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 2.9 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" /></svg>,
  starOutline: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 2.9 1.1-6.3L2.9 9.5l6.3-.9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>,
  prev: <svg viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  next: <svg viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  grid: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  help: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 16.8v.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  gear: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  sound: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  mute: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  home: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="2.2" fill="currentColor" /><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 3" /><circle cx="19" cy="9" r="1.4" fill="currentColor" /><circle cx="6" cy="16" r="1.1" fill="currentColor" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  expand: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  audio: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 12h2l2-6 3 12 3-9 2 6 2-3h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};
