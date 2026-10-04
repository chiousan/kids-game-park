/* 只在 https（GitHub Pages）啟用離線快取；本機開檔不需要 */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 不支援就算了 */ });
  });
}
