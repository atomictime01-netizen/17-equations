// Assembles the deployable site: landing + pricing at the root, the app under /app/.
// Usage: npm run site:build   (output: site-dist/)
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const out = 'site-dist';
rmSync(out, { recursive: true, force: true });
// Relative base keeps the app working from any sub-path (GitHub Pages, Netlify, a folder on disk).
execSync(`npx vite build --base=./ --outDir ${out}/app --emptyOutDir`, { stdio: 'inherit' });
cpSync('site', out, { recursive: true });
console.log(`\nSite ready in ${out}/  (landing: /, pricing: /pricing.html, app: /app/)`);
