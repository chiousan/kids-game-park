"""產生 sw.js：列出要離線快取的檔案，版本號依內容自動計算。
修改任何遊戲檔案後執行：python tools/gen_sw.py"""
import os, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
for d, _, fs in os.walk(ROOT):
    rel = os.path.relpath(d, ROOT).replace('\\', '/')
    if (rel.startswith('.') and rel != '.') or rel.startswith('tools'):
        continue
    for f in fs:
        if f.startswith('.') or f in ('sw.js', 'robots.txt', 'README.md'):
            continue
        p = f if rel == '.' else rel + '/' + f
        files.append(p)
files.sort()
h = hashlib.sha1()
for p in files:
    h.update(p.encode()); h.update(open(os.path.join(ROOT, p), 'rb').read())
ver = h.hexdigest()[:10]
lst = ',\n  '.join("'" + p + "'" for p in ['./'] + files)
sw = """/* 離線快取：第一次開啟後，沒有網路也能玩（版本號由內容自動產生） */
var CACHE = 'gg-%s';
var FILES = [
  %s
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request);
  }));
});
""" % (ver, lst)
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8', newline='\n').write(sw)
print(len(files), 'files, version', ver)
