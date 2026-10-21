/* ========================================================================== 
 * 事件总线 —— 轻量发布订阅
 * 支持 on/once/off/emit，回调异常隔离，避免单模块报错拖垮整个应用。
 * ========================================================================== */

export function createEvents() {
  /** @type {Map<string, Set<Function>>} */
  const map = new Map();

  function on(name, fn) {
    if (typeof fn !== 'function') return () => {};
    let set = map.get(name);
    if (!set) { set = new Set(); map.set(name, set); }
    set.add(fn);
    return () => off(name, fn);
  }

  function once(name, fn) {
    if (typeof fn !== 'function') return () => {};
    const wrap = (...args) => { off(name, wrap); fn(...args); };
    return on(name, wrap);
  }

  function off(name, fn) {
    const set = map.get(name);
    if (!set) return;
    if (fn) set.delete(fn);
    else set.clear();
    if (set.size === 0) map.delete(name);
  }

  function emit(name, payload) {
    const set = map.get(name);
    if (!set || set.size === 0) return 0;
    let n = 0;
    for (const fn of Array.from(set)) {
      try { fn(payload); n++; } catch (err) {
        console.error(`[events] 监听器执行失败 (${name}):`, err);
      }
    }
    return n;
  }

  function clear() { map.clear(); }

  function names() { return Array.from(map.keys()); }

  return { on, once, off, emit, clear, names };
}
