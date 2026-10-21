/**
 * 引导加载器：从 gzip 分片加载 three 与 app
 *
 * 为什么：three.js（680KB）+ 应用代码（459KB）共 1.1MB，直接传输体量大。
 * 这里用 gzip 存储（共 ~318KB），浏览器端用 DecompressionStream 解压后
 * 以 Blob URL 动态 import，首次加载额外开销约 50ms，但传输体积降低 70%。
 *
 * 兼容性：DecompressionStream（Chrome 80+ / Safari 16.4+ / Edge 80+）。
 * 不支持时回退到未压缩版（app.js / three.js）。
 */
(async function boot() {
  const $ = (id) => document.getElementById(id);
  const log = (m) => { const el = $('loading-text'); if (el) el.textContent = m; };
  const setBar = (p) => { const el = $('loading-bar'); if (el) el.style.width = Math.round(p * 100) + '%'; };

  /** 加载并解压 gz，返回 Blob URL */
  async function loadGz(url, label, onProgress) {
    log('加载 ' + label + '…');
    const res = await fetch(url);
    if (!res.ok) throw new Error(label + ' HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    let buf;
    if (onProgress && res.body && total) {
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        onProgress(Math.min(0.95, got / total));
      }
      const all = new Uint8Array(got);
      let off = 0;
      for (const c of chunks) { all.set(c, off); off += c.length; }
      buf = all.buffer;
    } else {
      buf = await res.arrayBuffer();
    }
    log('解压 ' + label + '…');
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    const out = await new Response(stream).arrayBuffer();
    return URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
  }

  /** 回退：直接用未压缩的 ESM 文件 */
  async function fallback() {
    log('使用标准加载模式…');
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({
      imports: {
        'three': './three.js',
        'three/addons/controls/OrbitControls.js': './three.js',
        'three/addons/utils/BufferGeometryUtils.js': './three.js',
        'three/addons/environments/RoomEnvironment.js': './three.js',
        'three/addons/postprocessing/EffectComposer.js': './three.js',
        'three/addons/postprocessing/RenderPass.js': './three.js',
        'three/addons/postprocessing/UnrealBloomPass.js': './three.js',
        'three/addons/postprocessing/OutputPass.js': './three.js',
      },
    });
    document.head.appendChild(im);
    await import('./app.js');
  }

  try {
    setBar(0.05);
    if (typeof DecompressionStream === 'undefined') {
      await fallback();
      return;
    }

    // 1) three
    const threeUrl = await loadGz('three.js.gz', '三维引擎', (p) => setBar(0.05 + p * 0.35));
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
    setBar(0.45);

    // 2) app
    const appUrl = await loadGz('app.js.gz', '应用代码', (p) => setBar(0.45 + p * 0.45));
    setBar(0.92);

    // 3) 启动
    log('启动场景…');
    await import(appUrl);
    setBar(1);
  } catch (err) {
    console.error('[boot] gzip 加载失败，尝试回退:', err);
    try {
      await fallback();
    } catch (err2) {
      console.error('[boot] 回退也失败:', err2);
      const box = $('fatal-error');
      const txt = $('fatal-error-text');
      if (box) {
        box.hidden = false;
        if (txt) txt.textContent = '资源加载失败：' + (err2 && err2.message ? err2.message : err2) +
          '\n\n请确认通过 HTTP(S) 访问（不能双击 file:// 打开），或使用 dist/index.html 单文件离线版。';
      }
      const loading = $('loading');
      if (loading) loading.style.display = 'none';
    }
  }
})();
