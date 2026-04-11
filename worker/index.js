/**
 * LexiCore custom service worker — merged into the next-pwa generated sw.js.
 *
 * next-pwa v5 automatically picks up worker/index.js and appends its compiled
 * output to the Workbox-generated service worker at build time.
 *
 * Handles:
 *   - push events         — shows an OS notification
 *   - notificationclick   — opens the target URL in a focused window/tab
 */

// Push event — fired when the server sends a Web Push message.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'LexiCore';
  const options = {
    body:    data.body  || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    data:    { url: data.url || '/vocab' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — focus an existing window or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/vocab';

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
