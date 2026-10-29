import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

export const APP_FLAVOR = import.meta.env.VITE_APP_FLAVOR || 'web'; // 'motorista' | 'gestao' | 'web'
export const IS_MOTORISTA_APK = APP_FLAVOR === 'motorista';
export const IS_GESTAO_APK = APP_FLAVOR === 'gestao';
export const IS_NATIVE_APK = Capacitor.isNativePlatform();

export const PROD_WEB_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'https://logistrackapp.vercel.app';

export const API_BASE_URL = IS_NATIVE_APK
  ? PROD_WEB_ORIGIN.replace(/\/+$/, '')
  : '';

export const FCM_VAPID_PUBLIC_KEY =
  import.meta.env.VITE_FCM_VAPID_KEY ||
  'BE-KQmuDUA0lhLGGyppWBC6xYyu-YifvYyeiuJi1nzi0dHXd10IABrflhLiA0dKr5As70pQ0Om1S0Zi5CXCICuU';

export function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      headers.set('Authorization', `Bearer ${idToken}`);
    }
  } catch (err) {
    console.warn('[authFetch] Não foi possível obter token Firebase:', err);
  }

  return fetch(apiUrl(path), {
    ...options,
    headers
  });
}
