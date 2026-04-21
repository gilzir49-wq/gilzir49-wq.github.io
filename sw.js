const CACHE = 'command-center-v9';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/firebase-sync.js',
  './js/push-notifications.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
    // לא קוראים ל-skipWaiting כאן — נחכה לאישור המשתמש
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── הודעה מהאפליקציה: "אשרתי — עדכן עכשיו" ────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push notification received ─────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 מרכז פיקוד', {
      body: data.body || 'יש לך תזכורת',
      icon: './icons/icon.svg',
      badge: './icons/icon.svg',
      dir: 'rtl',
      lang: 'he',
      data: { url: data.url || './' }
    })
  );
});

// ── Notification click → open app ─────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(e.notification.data?.url || './');
    })
  );
});
