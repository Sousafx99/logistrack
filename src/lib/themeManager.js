import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const THEME_STORAGE_KEY = 'logistrack-theme'; // 'light' | 'dark' | 'system'
const listeners = new Set();

export function getThemePreference() {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {}
  return 'light'; // Tema Claro Creme como padrão legível de alto contraste
}

export function resolveEffectiveTheme(pref = getThemePreference()) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(pref = getThemePreference()) {
  if (typeof document === 'undefined') return 'light';
  const effective = resolveEffectiveTheme(pref);
  const root = document.documentElement;

  if (effective === 'dark') {
    root.classList.add('dark');
    root.dataset.theme = 'dark';
  } else {
    root.classList.remove('dark');
    root.dataset.theme = 'light';
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', effective === 'dark' ? '#090a0f' : '#EAE3D2');
  }

  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: effective === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: effective === 'dark' ? '#090a0f' : '#EAE3D2' }).catch(() => {});
  }

  listeners.forEach(cb => {
    try { cb({ preference: pref, effective }); } catch {}
  });

  return effective;
}

export function setThemePreference(pref) {
  const valid = ['light', 'dark', 'system'].includes(pref) ? pref : 'light';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, valid);
  } catch {}
  return applyTheme(valid);
}

export function cycleThemePreference() {
  const current = getThemePreference();
  const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  setThemePreference(next);
  return next;
}

export function subscribeThemeChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

if (typeof window !== 'undefined') {
  applyTheme(getThemePreference());
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (mql?.addEventListener) {
    mql.addEventListener('change', () => {
      if (getThemePreference() === 'system') applyTheme('system');
    });
  }
}
