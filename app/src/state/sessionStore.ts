// Tiny global session holder so services can read the current user without React.
import type { Session } from '../services/types';

let current: Session | null = null;
const listeners = new Set<(s: Session | null) => void>();

export const getSession = () => current;
export function setSession(s: Session | null) {
  current = s;
  listeners.forEach((l) => l(s));
}
export function subscribeSession(fn: (s: Session | null) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function requireSession(): Session {
  if (!current) throw new Error('notSignedIn');
  return current;
}

/** True while the sign-up flow writes the new profile (auth listener must not interfere). */
export const registering = { on: false };
