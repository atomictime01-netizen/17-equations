# Contributing

Thanks for helping. Bug reports, fixes, clearer explanations and new experiments are all welcome.

## Set up

```bash
git clone https://github.com/atomictime01-netizen/17-equations.git
cd 17-equations
npm install
npm run dev        # http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (no service worker, so changes show immediately) |
| `npm test` | Vitest suites for the mathematical models and the narrative content |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Type-check and production build of the app into `dist/` |

## Where things live

- `src/math/`: pure, tested models. New numerical code goes here with a test that checks it against an independent result.
- `src/experiences/`: one lazy-loaded component per equation.
- `src/data/equations.ts`: the narrative content. Keep historical claims hedged where credit is shared.
- `src/components/About.tsx`: the sections below the globe (what makes it different, pricing, FAQ).

## Pull requests

1. Open an issue first for anything large, so we agree on the approach.
2. Keep a PR to one change. Run `npm run typecheck` and `npm test` before pushing.
3. For visual changes, include a screenshot (desktop and a phone width).
4. State simplifications honestly: if a model leaves something out, say so under "Limits & caveats".
5. By contributing you agree your work is released under the [MIT licence](LICENSE).

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
