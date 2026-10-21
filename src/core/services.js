/* ==========================================================================
 * 服务定位器 —— 模块间解耦
 * 各模块 init(app) 时注册服务；其它模块通过 services.get/call 使用，
 * 避免直接依赖具体的 app 属性名，也便于延迟加载与降级。
 * ========================================================================== */

export function createServices() {
  /** @type {Map<string, any>} */
  const map = new Map();

  function register(name, impl) {
    if (!name) return;
    map.set(name, impl);
    return impl;
  }

  function get(name, fallback = null) {
    return map.has(name) ? map.get(name) : fallback;
  }

  function has(name) { return map.has(name); }

  function call(name, method, ...args) {
    const impl = map.get(name);
    if (!impl) return undefined;
    const fn = impl[method];
    if (typeof fn !== 'function') return undefined;
    try { return fn.apply(impl, args); } catch (err) {
      console.error(`[services] ${name}.${method} 调用失败:`, err);
      return undefined;
    }
  }

  function names() { return Array.from(map.keys()); }

  function remove(name) { map.delete(name); }

  return { register, get, has, call, names, remove };
}
