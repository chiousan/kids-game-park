/* 只在 https（GitHub Pages）啟用離線快取；本機開檔不需要。
 * 新版本接手時自動重新整理一次，iPad 不用手動關掉再開就能看到新版。 */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  var hadController = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloaded) { hadController = true; return; }
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 不支援就算了 */ });
  });
}
