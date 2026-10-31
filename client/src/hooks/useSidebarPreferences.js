import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'wordvault.sidebar.preferences';
const DEFAULTS = Object.freeze({ mode: 'button', position: 'left' });
const MODES = new Set(['hover', 'button']);
const POSITIONS = new Set(['left', 'right']);

function normalize(value) {
  return {
    mode: MODES.has(value?.mode) ? value.mode : DEFAULTS.mode,
    position: POSITIONS.has(value?.position) ? value.position : DEFAULTS.position,
  };
}

function read() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let snapshot = null;
const listeners = new Set();

function getSnapshot() {
  if (!snapshot) snapshot = read();
  return snapshot;
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    snapshot = read();
    listeners.forEach((notify) => notify());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function setSidebarPreferences(patch) {
  snapshot = normalize({ ...getSnapshot(), ...patch });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Storage can be unavailable in private modes; the session still updates. */
  }
  listeners.forEach((notify) => notify());
}

export function useSidebarPreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
  const setPreferences = useCallback((patch) => setSidebarPreferences(patch), []);
  return [preferences, setPreferences];
}
