/**
 * LexiCore custom service worker — merged into the next-pwa generated sw.js.
 *
 * next-pwa v5 automatically picks up worker/index.ts (or worker/index.js) and
 * appends its compiled output to the Workbox-generated service worker.
 *
 * Handles:
 *   - push events  — shows OS notification with title, body, icon
 *   - notificationclick — opens the target URL in a focused window/tab
 */

// Push event — fired when the server sends a push message via Web Push Protocol.
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() as {
    title?: string;
    body?:  string;
    url?:   string;
  } ?? {};

  const title = data.title ?? 'LexiCore';
  const options: NotificationOptions = {
    body:    data.body  ?? '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    data:    { url: data.url ?? '/vocab' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(title, options),
  );
});

// Notification click — bring focus to the app at the notification's URL.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url: string = (event.notification.data as { url?: string })?.url ?? '/vocab';

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope & {
      clients: Clients;
    }).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If there's already a window open at the target URL, focus it.
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        // Otherwise open a new window.
        return (self as unknown as ServiceWorkerGlobalScope & { clients: Clients })
          .clients.openWindow(url);
      }),
  );
});
