/* Service Worker de Notificações Nativas do Sistema (Windows Desktop & Mobile Browser) */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe Web Push do Firebase Cloud Messaging (mesmo com navegador minimizado ou aba fechada)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'LogisTrack', body: event.data.text() } };
  }

  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || data.title || 'LogisTrack • Alerta Operacional';
  const body = notif.body || data.body || 'Nova atualização na operação.';
  const tag = notif.tag || data.tag || `lt-${Date.now()}`;
  const url = data.url || payload.fcmOptions?.link || '/';

  const options = {
    body,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [350, 150, 350, 150, 400],
    data: { url }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Permite disparo local imediato pela aplicação via postMessage (garante card nativo do Windows na hora)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SYSTEM_NOTIFICATION') {
    const { title, body, tag, url } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'LogisTrack', {
        body: body || '',
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: tag || `lt-local-${Date.now()}`,
        renotify: true,
        requireInteraction: false,
        vibrate: [300, 150, 300],
        data: { url: url || '/' }
      })
    );
  }
});

// Ao clicar na notificação do Windows ou celular, foca a aba existente ou abre na rota exata
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE_TO', url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
