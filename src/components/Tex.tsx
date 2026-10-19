import katex from 'katex';
import { Fragment, memo, useMemo, type ReactNode } from 'react';

const cache = new Map<string, string>();
function render(tex: string, display: boolean) {
  const key = (display ? 'D:' : 'I:') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

/** KaTeX-rendered mathematics. Includes MathML for screen readers. */
export const Tex = memo(function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  return <span className={`tex ${display ? 'tex-display' : ''} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

/**
 * Minimal rich text: $inline math$, **bold**, *italic*. Used for authored narrative content.
 */
export const Rich = memo(function Rich({ text }: { text: string }) {
  const nodes = useMemo(() => parse(text), [text]);
  return <>{nodes}</>;
});

function parse(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\$([^$]+)\$|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) out.push(<Tex key={k++} tex={m[1]} />);
    else if (m[2] !== undefined) out.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={k++}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}
