/**
 * sw-push.js — standalone push event handlers.
 *
 * NOTE: next-pwa v5 uses worker/index.ts (compiled + merged) rather than this
 * file. This file exists as documentation and as a fallback if the build
 * process changes.
 *
 * For the active implementation, see: worker/index.ts
 */

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'LexiCore';
  const options = {
    body:    data.body ?? '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    data:    { url: data.url ?? '/vocab' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/vocab';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
