/**
 * Trial / experience mode flag — lets the app run fully without a backend session.
 *
 * The source of truth is a module variable mirrored to sessionStorage so a page
 * reload stays in trial mode (the data store re-seeds fresh on reload). It's a
 * plain (non-React) module so synchronous data-layer code — query/mutation
 * functions in useData — can branch on it without prop drilling.
 */
import { demoStore } from './demoStore';
import type { AuthUser } from '../api/authApi';

const KEY = 'cardpro_demo';

let active = (() => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

/** The pseudo-user shown in the header while in trial mode. */
export const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'trial@cardpro.demo',
  name: 'Khách dùng thử',
};

export const isDemo = (): boolean => active;

export function enterDemoMode(): void {
  active = true;
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* sessionStorage may be unavailable — in-memory flag still works */
  }
  demoStore.reset(); // start every trial from a clean, fully-seeded dataset
}

export function exitDemoMode(): void {
  active = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
