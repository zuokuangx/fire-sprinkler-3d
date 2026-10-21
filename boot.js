/**
 * 引导加载器：base64 文本分片 → gzip 解码 → 动态 import
 *
 * 为什么要分片：three.js（680KB）+ 应用代码（459KB）合计 1.1MB。
 * 这里各 gzip（共 318KB）、各切 3 片、再转 base64 存为 .txt（共 425KB）。
 * 浏览器并行拉取 → base64 解码 → 按序拼接 → DecompressionStream 解压 → Blob URL import。
 *
 * 兼容：DecompressionStream 需 Chrome/Edge 80+、Safari 16.4+；不支持时回退直连。
 */
(async function boot() {
  const PARTS = 3;
  const $ = (id) => document.getElementById(id);
  const log = (m) => { const el = $('loading-text'); if (el) el.textContent = m; };
  const bar = (p) => { const el = $('loading-bar'); if (el) el.style.width = Math.round(p * 100) + '%'; };

  /** base64 → Uint8Array */
  function b64ToBytes(b64) {
    const clean = b64.replace(/[\s]/g, '');
    const bin = atob(clean);
    const len = bin.length;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** 并行拉取 n 个 .txt 分片，解码后按序拼接 */
  async function loadParts(prefix, label, onProgress) {
    let done = 0;
    const tasks = [];
    for (let i = 0; i < PARTS; i++) {
      tasks.push(
        fetch(prefix + '.p' + i + '.txt')
          .then((r) => {
            if (!r.ok) throw new Error(label + ' 分片 ' + i + ' HTTP ' + r.status);
            return r.text();
          })
          .then((t) => {
            done++;
            onProgress && onProgress(done / PARTS);
            return b64ToBytes(t);
          })
      );
    }
    const arrs = await Promise.all(tasks);
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

  function importMap(threeUrl) {
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({
      imports: {
        'three': threeUrl,
        'three/addons/controls/OrbitControls.js': threeUrl,
        'three/addons/utils/BufferGeometryUtils.js': threeUrl,
        'three/addons/environments/RoomEnvironment.js': threeUrl,
        'three/addons/postprocessing/EffectComposer.js': threeUrl,
        'three/addons/postprocessing/RenderPass.js': threeUrl,
        'three/addons/postprocessing/UnrealBloomPass.js': threeUrl,
        'three/addons/postprocessing/OutputPass.js': threeUrl,
      },
    });
    document.head.appendChild(im);
  }

  async function fallback() {
    log('使用标准加载模式…');
    importMap('./three.js');
    await import('./app.js');
  }

  try {
    bar(0.04);
    if (typeof DecompressionStream === 'undefined') { await fallback(); return; }

    log('加载三维引擎…');
    const tBuf = await loadParts('three', '三维引擎', (p) => bar(0.04 + p * 0.34));
    const tUrl = await gunzipToUrl(tBuf, '三维引擎');
    importMap(tUrl);
    bar(0.42);

    log('加载应用代码…');
    const aBuf = await loadParts('app', '应用代码', (p) => bar(0.42 + p * 0.46));
    const aUrl = await gunzipToUrl(aBuf, '应用代码');
    bar(0.92);

    log('启动场景…');
    await import(aUrl);
    bar(1);
  } catch (err) {
    console.warn('[boot] 分片加载失败，回退:', err);
    try { await fallback(); } catch (e2) {
      console.error('[boot] 回退失败:', e2);
      const box = $('fatal-error'); const txt = $('fatal-error-text');
      if (box) { box.hidden = false; if (txt) txt.textContent = '资源加载失败：' + (e2.message || e2); }
      const l = $('loading'); if (l) l.style.display = 'none';
    }
  }
})();
