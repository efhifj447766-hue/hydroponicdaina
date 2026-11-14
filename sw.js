/* Service Worker: แคชเฉพาะไฟล์หน้าเว็บ (app shell) เพื่อให้ติดตั้งและเปิดออฟไลน์ได้
   ไม่แคชข้อมูลเซนเซอร์ — ทุกคำขอ API/WebSocket ผ่านเครือข่ายตรงเสมอ */
const V = 'hydrosense-v5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'js/config.js',
  'js/data-source.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const font = /(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)$/.test(u.hostname);
  if (u.origin !== location.origin && !font) return;      // API ข้ามโดเมน → ไม่แตะ
  if (u.origin === location.origin && u.pathname.includes('/api')) return; // API โดเมนเดียวกัน → ไม่แตะ
  if (font) {                                              // ฟอนต์: stale-while-revalidate
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).catch(() =>
    r.mode === 'navigate' ? caches.match('index.html') : undefined)));
});
