"""產生 sw.js：列出要離線快取的檔案，版本號依內容自動計算。
修改任何遊戲檔案後執行：python tools/gen_sw.py

策略（舊款 iPad 也能可靠更新）：
- 安裝時只快取幾個核心檔（網頁、樣式、程式），檔案少就不容易因為網路不穩而裝不起來。
- 網頁與程式「先抓網路、沒網路才用快取」，有網路時永遠拿到最新版。
- 圖片「先用快取」；新版啟用後在背景一個一個補抓其餘檔案，之後沒網路也能玩。
"""
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
core = ['./'] + [p for p in files if p.endswith(('.html', '.css', '.js', '.webmanifest'))]
rest = [p for p in files if p not in core]
fmt = lambda lst: ',\n  '.join("'" + p + "'" for p in lst)
sw = """/* 離線快取（版本號由內容自動產生）：核心檔安裝時快取，其餘檔案啟用後在背景補抓 */
var CACHE = 'gg-%s';
var CORE = [
  %s
];
var FILES = [
  %s
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
function fillRest() {
  // 一個一個慢慢抓，失敗的下次再補，不影響使用
  return caches.open(CACHE).then(function (c) {
    var i = 0;
    function next() {
      if (i >= FILES.length) return null;
      var f = FILES[i++];
      return c.match(f).then(function (hit) {
        if (hit) return null;
        return fetch(f).then(function (r) { if (r.ok) return c.put(f, r); }).catch(function () {});
      }).then(next);
    }
    return next();
  });
}
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
  fillRest();
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.url.indexOf(self.location.origin) !== 0) return;
  var code = req.mode === 'navigate' || /\\.(html|js|css|webmanifest)(\\?|$)/.test(req.url);
  if (code) {
    // 網頁與程式：先抓網路（拿最新版），沒網路才用快取
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return r;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
    return;
  }
  // 圖片：先用快取，沒有才抓網路並存起來
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return r;
    });
  }));
});
""" % (ver, fmt(core), fmt(rest))
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8', newline='\n').write(sw)
print(len(files), 'files,', len(core), 'core, version', ver)
