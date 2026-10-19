import { useEffect, useState } from 'react';

export type Route = { name: 'intro' } | { name: 'universe' } | { name: 'equation'; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('e/')) return { name: 'equation', id: h.slice(2) };
  if (h === 'universe') return { name: 'universe' };
  return { name: 'intro' };
}

export function routeToHash(r: Route) {
  if (r.name === 'equation') return `#/e/${r.id}`;
  if (r.name === 'universe') return '#/universe';
  return '#/';
}

export function navigate(r: Route) {
  const h = routeToHash(r);
  if (window.location.hash !== h) window.location.hash = h;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
