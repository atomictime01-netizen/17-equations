/** Small luminous line-glyphs that identify each equation in the universe map. */
export function Glyph({ kind }: { kind: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let body: JSX.Element;
  switch (kind) {
    case 'triangle':
      body = (
        <g {...common}>
          <path d="M14 44 L40 44 L14 24 Z" />
          <rect x="14" y="44" width="26" height="8" opacity="0.5" />
          <path d="M14 24 L40 44" />
          <path d="M14 39h5v5" opacity="0.7" />
        </g>
      );
      break;
    case 'log':
      body = (
        <g {...common}>
          <path d="M10 46 C 14 20, 30 16, 54 14" />
          {[12, 19, 26, 33, 40, 47, 54].map((x, i) => (
            <path key={x} d={`M${x} 52 v-${i % 3 === 0 ? 6 : 3}`} opacity="0.7" />
          ))}
        </g>
      );
      break;
    case 'curve':
      body = (
        <g {...common}>
          <path d="M8 44 C 20 10, 34 54, 56 18" />
          <path d="M18 18 L46 40" opacity="0.6" />
          <circle cx="31" cy="30" r="2.5" fill="currentColor" />
        </g>
      );
      break;
    case 'orbit':
      body = (
        <g {...common}>
          <ellipse cx="32" cy="32" rx="22" ry="11" transform="rotate(-20 32 32)" />
          <circle cx="32" cy="32" r="5" fill="currentColor" />
          <circle cx="51" cy="25" r="2.5" fill="currentColor" />
        </g>
      );
      break;
    case 'spiral':
      body = (
        <g {...common}>
          <circle cx="32" cy="32" r="18" opacity="0.5" />
          <path d="M8 32h48M32 8v48" opacity="0.4" />
          <path d="M32 32 L46 18" />
          <path d="M40 32 A 8 8 0 0 0 37.5 26" />
        </g>
      );
      break;
    case 'cube':
      body = (
        <g {...common}>
          <path d="M20 22 L36 16 L50 22 L50 40 L34 48 L20 42 Z" />
          <path d="M20 22 L34 28 L50 22 M34 28 V48" opacity="0.7" />
        </g>
      );
      break;
    case 'bell':
      body = (
        <g {...common}>
          <path d="M6 48 C 20 48, 24 14, 32 14 C 40 14, 44 48, 58 48" />
          {[20, 26, 32, 38, 44].map((x) => (
            <path key={x} d={`M${x} 48 v-${x === 32 ? 30 : x === 26 || x === 38 ? 18 : 6}`} opacity="0.35" />
          ))}
        </g>
      );
      break;
    case 'wave':
      body = (
        <g {...common}>
          <circle cx="32" cy="32" r="6" />
          <circle cx="32" cy="32" r="14" opacity="0.65" />
          <circle cx="32" cy="32" r="22" opacity="0.35" />
        </g>
      );
      break;
    case 'spectrum':
      body = (
        <g {...common}>
          {[14, 22, 30, 38, 46].map((x, i) => (
            <path key={x} d={`M${x} 50 V${50 - [28, 10, 18, 6, 12][i]}`} strokeWidth={3} />
          ))}
          <path d="M8 24 C 14 12, 20 36, 26 24 S 38 12, 44 24 S 54 36, 58 22" opacity="0.6" />
        </g>
      );
      break;
    case 'vortex':
      body = (
        <g {...common}>
          <path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16" />
        </g>
      );
      break;
    case 'field':
      body = (
        <g {...common}>
          <circle cx="20" cy="32" r="4" fill="currentColor" />
          <circle cx="44" cy="32" r="4" />
          <path d="M24 30 C 30 20, 34 20, 40 30 M24 34 C 30 44, 34 44, 40 34 M24 32 H40" opacity="0.7" />
        </g>
      );
      break;
    case 'particles':
      body = (
        <g {...common}>
          <rect x="10" y="16" width="44" height="32" rx="3" opacity="0.6" />
          <path d="M32 16 v10 M32 38 v10" strokeDasharray="2 3" />
          {[
            [16, 22], [22, 30], [17, 40], [26, 24], [40, 36], [48, 22], [44, 42],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />
          ))}
        </g>
      );
      break;
    case 'burst':
      body = (
        <g {...common}>
          <circle cx="32" cy="32" r="3" fill="currentColor" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r1 = 8;
            const r2 = i % 2 ? 18 : 24;
            return <path key={i} d={`M${32 + r1 * Math.cos(a)} ${32 + r1 * Math.sin(a)} L${32 + r2 * Math.cos(a)} ${32 + r2 * Math.sin(a)}`} />;
          })}
        </g>
      );
      break;
    case 'psi':
      body = (
        <g {...common}>
          <path d="M10 46 H54" opacity="0.4" />
          <path d="M10 46 V14 M54 46 V14" opacity="0.6" />
          <path d="M10 34 C 18 14, 24 14, 32 34 S 46 54, 54 34" />
        </g>
      );
      break;
    case 'bits':
      body = (
        <g {...common}>
          <path d="M32 12 L18 30 M32 12 L46 30 M18 30 L10 48 M18 30 L26 48" />
          {[
            [32, 12], [18, 30], [46, 30], [10, 48], [26, 48],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="currentColor" />
          ))}
        </g>
      );
      break;
    case 'bifurcation':
      body = (
        <g {...common}>
          <path d="M8 34 H24 C 30 34, 32 24, 38 22 M24 34 C 30 34, 32 44, 38 46" />
          <path d="M38 22 C 42 22, 44 16, 50 15 M38 22 C 42 22, 44 28, 50 28 M38 46 C 42 46, 44 40, 50 39 M38 46 C 42 46, 44 52, 50 52" opacity="0.7" />
          <path d="M52 12 V54" opacity="0.3" strokeDasharray="1 2" />
        </g>
      );
      break;
    case 'surface':
      body = (
        <g {...common}>
          <path d="M8 48 L28 48 C 36 48, 44 30, 56 14" />
          <path d="M8 40 C 18 40, 30 36, 40 26 S 52 14, 56 12" opacity="0.6" />
          <path d="M8 48 L28 48 L56 20" opacity="0.35" />
        </g>
      );
      break;
    default:
      body = <circle cx="32" cy="32" r="10" {...common} />;
  }
  return (
    <svg viewBox="0 0 64 64" className="glyph" aria-hidden>
      {body}
    </svg>
  );
}
