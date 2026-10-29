import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, auth } from './firebase';
import { firestoreService } from './firestoreService';
import { FCM_VAPID_PUBLIC_KEY, authFetch } from './appConfig';

let activeTokenId = null;
let nativeListenersRegistered = false;
let swRegistrationCache = null;

function hashTokenId(token) {
  let h = 5381;
  const str = String(token || '');
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return `tok_${(h >>> 0).toString(16)}_${str.slice(-14).replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * Configura os canais de alta prioridade do Android (toca som mesmo bloqueado, vibra e aparece na barra/tela bloqueada)
 */
export async function setupAndroidNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'logistrack_urgente_v2',
      name: 'Alertas Operacionais Urgentes',
      description: 'Devoluções, aprovações e alertas de rota com som e vibração',
      importance: 5, // IMPORTANCE_HIGH / MAX (toca som e mostra pop-up na tela bloqueada)
      visibility: 1, // VISIBILITY_PUBLIC
      sound: 'alerta_logistrack',
      vibration: true,
      lights: true,
      lightColor: '#3B82F6'
    });

    await LocalNotifications.createChannel({
      id: 'logistrack_financeiro_v2',
      name: 'Reembolsos e Pagamentos PIX',
      description: 'Solicitações e comprovantes de pagamento PIX',
      importance: 5,
      visibility: 1,
      sound: 'moeda_logistrack',
      vibration: true,
      lights: true,
      lightColor: '#10B981'
    });
  } catch (err) {
    console.warn('[Push] Falha ao criar canais Android:', err);
  }
}

export async function getSystemNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await PushNotifications.checkPermissions();
      return status.receive === 'granted' ? 'granted' : status.receive === 'denied' ? 'denied' : 'default';
    } catch {
      return 'default';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function ensureServiceWorkerRegistration() {
  if (Capacitor.isNativePlatform()) return null;
  if (swRegistrationCache) return swRegistrationCache;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    swRegistrationCache = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return swRegistrationCache;
  } catch (err) {
    console.warn('[Push] Falha ao registrar Service Worker:', err);
    return null;
  }
}

/**
 * Registra o dispositivo (APK Android ou Navegador Windows/Mobile) para receber notificações do sistema
 */
export async function registerDeviceForNotifications(currentUser, onNavigate) {
  if (!currentUser?.role) return { ok: false, reason: 'no_user' };

  // --- FLUXO 1: APK ANDROID NATIVO ---
  if (Capacitor.isNativePlatform()) {
    try {
      await setupAndroidNotificationChannels();
      await LocalNotifications.requestPermissions().catch(() => {});

      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        return { ok: false, reason: 'denied' };
      }

      if (!nativeListenersRegistered) {
        nativeListenersRegistered = true;

        PushNotifications.addListener('registration', async (tokenObj) => {
          const token = tokenObj?.value;
          if (!token) return;
          const tokenId = hashTokenId(token);
          activeTokenId = tokenId;
          localStorage.setItem('lt_fcm_token_id', tokenId);
          await firestoreService.salvarTokenFcm({
            tokenId,
            token,
            uid: auth.currentUser?.uid || null,
            role: currentUser.role,
            subRole: currentUser.subRole || null,
            placa: currentUser.placa || null,
            platform: 'android-apk'
          });
        });

        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          // Quando o app está aberto em 1º plano, garante notificação também na barra do Android + vibração
          try {
            const soundType = notification?.data?.soundType || 'default';
            await LocalNotifications.schedule({
              notifications: [{
                id: Math.floor(Math.random() * 900000) + 10000,
                title: notification.title || 'LogisTrack',
                body: notification.body || '',
                channelId: soundType === 'coin' ? 'logistrack_financeiro_v2' : 'logistrack_urgente_v2',
                extra: notification.data || {}
              }]
            });
          } catch {}
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const targetUrl = action?.notification?.data?.url;
          if (targetUrl && typeof onNavigate === 'function') {
            onNavigate(targetUrl);
          }
        });
      }

      await PushNotifications.register();
      return { ok: true, platform: 'android-apk' };
    } catch (err) {
      console.warn('[Push] Erro ao registrar FCM no APK:', err);
      return { ok: false, reason: err.message };
    }
  }

  // --- FLUXO 2: NAVEGADOR WINDOWS DESKTOP & MOBILE WEB ---
  if (typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    return { ok: false, reason: perm };
  }

  const swReg = await ensureServiceWorkerRegistration();

  // Escuta cliques vindos do card nativo do Windows (Service Worker)
  if ('serviceWorker' in navigator && !window.__ltSwNavListener) {
    window.__ltSwNavListener = true;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE_TO' && event.data.url && typeof onNavigate === 'function') {
        onNavigate(event.data.url);
      }
    });
  }

  try {
    const supported = await isSupported();
    if (supported && swReg && FCM_VAPID_PUBLIC_KEY) {
      const messaging = getMessaging(app);
      const webToken = await getToken(messaging, {
        vapidKey: FCM_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: swReg
      });
      if (webToken) {
        const tokenId = hashTokenId(webToken);
        activeTokenId = tokenId;
        localStorage.setItem('lt_fcm_token_id', tokenId);
        await firestoreService.salvarTokenFcm({
          tokenId,
          token: webToken,
          uid: auth.currentUser?.uid || null,
          role: currentUser.role,
          subRole: currentUser.subRole || null,
          placa: currentUser.placa || null,
          platform: 'web'
        });
      }
    }
  } catch (err) {
    console.warn('[Push] Web Push FCM fallback para Notification API local:', err.message);
  }

  return { ok: true, platform: 'web' };
}

/**
 * Remove token FCM ao deslogar para que celular/PC não receba alertas de outro perfil
 */
export async function unregisterCurrentDeviceToken() {
  try {
    const id = activeTokenId || localStorage.getItem('lt_fcm_token_id');
    if (id) {
      await firestoreService.removerTokenFcm(id);
      localStorage.removeItem('lt_fcm_token_id');
      activeTokenId = null;
    }
  } catch {}
}

/**
 * Exibe card nativo imediato do Sistema Operacional (Windows canto inferior direito / barra Android)
 */
export async function triggerImmediateOsNotification({ title, body, tag, url, soundType = 'default' }) {
  try {
    if (Capacitor.isNativePlatform()) {
      await setupAndroidNotificationChannels();
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 900000) + 10000,
          title,
          body,
          channelId: soundType === 'coin' ? 'logistrack_financeiro_v2' : 'logistrack_urgente_v2',
          extra: { url: url || '/' }
        }]
      });
      if (navigator?.vibrate) navigator.vibrate([350, 150, 350]);
      return;
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    if (navigator?.vibrate) navigator.vibrate([300, 150, 300]);

    const swReg = await ensureServiceWorkerRegistration();
    if (swReg?.active) {
      swReg.active.postMessage({
        type: 'SHOW_SYSTEM_NOTIFICATION',
        title,
        body,
        tag,
        url
      });
      return;
    }

    const n = new Notification(title, {
      body,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      tag: tag || `lt-${Date.now()}`,
      renotify: true
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (err) {
    console.warn('[Push] Erro ao exibir notificação OS:', err);
  }
}

/**
 * Envia Push remoto via servidor para acordar celulares bloqueados e PCs com aba fechada
 */
export function dispatchRemotePush(payload) {
  authFetch('/api/push-send', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).catch((err) => {
    console.warn('[Push] Falha silenciosa ao disparar push remoto:', err?.message);
  });
}
