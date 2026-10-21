/**
 * 服务门面（Service Locator）
 * 各功能模块在自己的 init(app) 中注册实现，其它模块只通过 services.get(name) 调用，
 * 从而避免模块之间的静态循环依赖，也让"功能可降级"（未注册时调用方自行判断 has()）。
 */

export function createServices(app) {
  const impls = new Map();
  const missingWarned = new Set();

  function register(name, impl) {
    impls.set(name, impl);
    if (app && app.debug) console.debug(`[services] 注册: ${name}`);
    return impl;
  }

  function get(name) {
    const impl = impls.get(name);
    if (!impl && !missingWarned.has(name)) {
      missingWarned.add(name);
      console.warn(`[services] 服务未注册: ${name}`);
    }
    return impl || null;
  }

  function has(name) {
    return impls.has(name);
  }

  /** 安全调用：服务不存在时返回 fallback，不抛错 */
  function call(name, method, ...args) {
    const impl = impls.get(name);
    if (!impl || typeof impl[method] !== 'function') return undefined;
    try {
      return impl[method](...args);
    } catch (err) {
      console.error(`[services] ${name}.${method} 调用失败:`, err);
      return undefined;
    }
  }

  function names() {
    return Array.from(impls.keys());
  }

  return { register, get, has, call, names, _impls: impls };
}

export default createServices;
