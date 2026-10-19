import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Each experience is code-split so only the one being visited is loaded. */
export const EXPERIENCES: Record<string, LazyExoticComponent<ComponentType>> = {
  pythagoras: lazy(() => import('./E01Pythagoras')),
  logarithms: lazy(() => import('./E02Logarithms')),
  calculus: lazy(() => import('./E03Calculus')),
  gravity: lazy(() => import('./E04Gravity')),
  complex: lazy(() => import('./E05Complex')),
  'euler-polyhedra': lazy(() => import('./E06Polyhedra')),
  normal: lazy(() => import('./E07Normal')),
  wave: lazy(() => import('./E08Wave')),
  fourier: lazy(() => import('./E09Fourier')),
  'navier-stokes': lazy(() => import('./E10Fluid')),
  maxwell: lazy(() => import('./E11Maxwell')),
  thermodynamics: lazy(() => import('./E12Thermo')),
  relativity: lazy(() => import('./E13Relativity')),
  schrodinger: lazy(() => import('./E14Schrodinger')),
  shannon: lazy(() => import('./E15Shannon')),
  chaos: lazy(() => import('./E16Chaos')),
  'black-scholes': lazy(() => import('./E17BlackScholes')),
};
