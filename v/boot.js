/**
 * 引导加载器：three.js 本地优先（回退 CDN），应用代码按 6 片 gzip 拉取后解压执行
 *
 * 为什么要分片：应用代码 gzip 后约 141KB，切成 6 片可并行下载（HTTP/2 多路复用），
 * 并把首屏进度反馈做细。解压用 DecompressionStream（Chrome/Edge 80+、Safari 16.4+）。
 *
 * 关键坑：boot.js 在 /v/ 下，而页面在根 —— fetch 的相对路径基准是【页面 URL】不是模块 URL，
 * 所以所有资源请求都用 new URL(..., import.meta.url) 作为基准。
 */
(async function boot() {
  const PARTS = 6;
  const THREE_VER = '0.160.1';
  const CDN = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VER + '/';
  /** 模块自身目录作为资源基准 */
  const BASE = new URL('.', import.meta.url);
  const $ = (id) => document.getElementById(id);
  const log = (m) => { const el = $('loading-text'); if (el) el.textContent = m; };
  const bar = (p) => { const el = $('loading-bar'); if (el) el.style.width = Math.round(p * 100) + '%'; };

  /** base64 → Uint8Array */
  function b64ToBytes(b64) {
    const clean = b64.replace(/[\s]/g, '');
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** 顺序拉取分片 → 解码 → 按序拼接 */
  async function loadParts(prefix, count, label, onProgress) {
    const arrs = [];
    for (let i = 0; i < count; i++) {
      const r = await fetch(new URL(prefix + '.p' + i + '.txt?v=' + Date.now(), BASE));
      if (!r.ok) throw new Error(label + ' 分片 ' + i + ' HTTP ' + r.status);
      const t = await r.text();
      arrs.push(b64ToBytes(t));
      onProgress && onProgress((i + 1) / count);
    }
    const total = arrs.reduce((s, a) => s + a.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const a of arrs) { all.set(a, off); off += a.length; }
    return all.buffer;
  }

  async function gunzipToUrl(buf, label) {
    log('解压 ' + label + '…');
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    const out = await new Response(stream).arrayBuffer();
    return URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
  }

  /** 探测本地 three 是否可用 */
  async function localThreeAvailable() {
    try {
      const r = await fetch(new URL('three.js?v=' + Date.now(), BASE), { headers: { Range: 'bytes=0-0' } });
      return r.ok || r.status === 206;
    } catch (_) { return false; }
  }

  function writeImportMap(map) {
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({ imports: map });
    document.head.appendChild(im);
  }

  try {
    let threeMap;
    if (await localThreeAvailable()) {
      log('加载三维引擎（本地）…');
      const tBase = new URL('three.js', BASE).href;
      threeMap = { 'three': tBase };
      const ADDONS = [
        'controls/OrbitControls.js',
        'utils/BufferGeometryUtils.js',
        'environments/RoomEnvironment.js',
        'postprocessing/EffectComposer.js',
        'postprocessing/RenderPass.js',
        'postprocessing/UnrealBloomPass.js',
        'postprocessing/OutputPass.js',
      ];
      for (const a of ADDONS) threeMap['three/addons/' + a] = tBase;
    } else {
      log('加载三维引擎（CDN）…');
      threeMap = {
        three: CDN + 'build/three.module.js',
        'three/addons/': CDN + 'examples/jsm/',
      };
    }
    writeImportMap(threeMap);
    bar(0.3);

    log('加载应用代码…');
    const aBuf = await loadParts('app', PARTS, '应用代码', (p) => bar(0.3 + p * 0.6));
    const aUrl = await gunzipToUrl(aBuf, '应用代码');
    bar(0.95);

    log('启动场景…');
    await import(aUrl);
    bar(1);
  } catch (err) {
    console.error('[boot] 加载失败:', err);
    const box = $('fatal-error');
    const txt = $('fatal-error-text');
    if (box) {
      box.hidden = false;
      if (txt) {
        txt.textContent = '资源加载失败：' + (err && err.message ? err.message : err) +
          '\n\n请确认通过 HTTP(S) 访问（不能直接双击 file:// 打开）。';
      }
    }
    const l = $('loading');
    if (l) l.style.display = 'none';
  }
})();
