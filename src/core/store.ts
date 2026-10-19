import { useSyncExternalStore } from 'react';

/** Local, account-free persistence of progress, favourites and settings. */
export interface Settings {
  sound: boolean;
  motion: 'system' | 'reduced' | 'full';
  guided: boolean;
  quality: 'auto' | 'high' | 'low';
}
export interface AppState {
  visited: Record<string, number>;
  completed: Record<string, true>; // challenge ids
  favourites: string[];
  settings: Settings;
  introSeen: boolean;
  /** Bumped when a default changes so stored settings can be migrated once. */
  schema?: number;
}

const KEY = 'seventeen-equations:v1';
const DEFAULTS: AppState = {
  visited: {},
  completed: {},
  favourites: [],
  settings: { sound: true, motion: 'system', guided: false, quality: 'auto' },
  introSeen: false,
  schema: 2,
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    const settings = { ...DEFAULTS.settings, ...(parsed.settings ?? {}) };
    // schema 2: discovery mode became the default learning mode
    if ((parsed.schema ?? 1) < 2) settings.guided = false;
    return { ...DEFAULTS, ...parsed, settings, schema: 2 };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let state: AppState = typeof window === 'undefined' ? structuredClone(DEFAULTS) : load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — progress lasts for the session only */
  }
}

export function getState() {
  return state;
}

export function setState(fn: (s: AppState) => AppState) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(DEFAULTS));
}

export const actions = {
  visit(id: string) {
    setState((s) => (s.visited[id] ? s : { ...s, visited: { ...s.visited, [id]: Date.now() } }));
  },
  complete(challengeId: string) {
    setState((s) => (s.completed[challengeId] ? s : { ...s, completed: { ...s.completed, [challengeId]: true } }));
  },
  uncomplete(challengeId: string) {
    setState((s) => {
      if (!s.completed[challengeId]) return s;
      const c = { ...s.completed };
      delete c[challengeId];
      return { ...s, completed: c };
    });
  },
  toggleFavourite(id: string) {
    setState((s) => ({
      ...s,
      favourites: s.favourites.includes(id) ? s.favourites.filter((f) => f !== id) : [...s.favourites, id],
    }));
  },
  setSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  markIntroSeen() {
    setState((s) => (s.introSeen ? s : { ...s, introSeen: true }));
  },
  resetProgress() {
    setState((s) => ({ ...s, visited: {}, completed: {}, favourites: [] }));
  },
};
