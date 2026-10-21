/**
 * 极简事件总线
 * - 同步派发；订阅者异常被隔离，不会打断其它订阅者。
 * - on() 返回取消订阅函数，便于组件销毁。
 */

export function createEvents(app) {
  const map = new Map();

  function on(type, fn) {
    if (typeof fn !== 'function') return () => {};
    let set = map.get(type);
    if (!set) map.set(type, (set = new Set()));
    set.add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = map.get(type);
    if (set) {
      set.delete(fn);
      if (set.size === 0) map.delete(type);
    }
  }

  function once(type, fn) {
    const wrapped = (payload) => {
      off(type, wrapped);
      fn(payload);
    };
    return on(type, wrapped);
  }

  function emit(type, payload) {
    const set = map.get(type);
    if (!set || set.size === 0) return;
    // 复制一份，允许订阅者在回调中增删订阅
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] "${type}" 订阅者异常:`, err);
        if (type !== 'error') {
          // 避免错误递归：直接派发但不再捕获
          try {
            emit('error', { module: `event:${type}`, err });
          } catch (_) { /* noop */ }
        }
      }
    }
  }

  function clear(type) {
    if (type) map.delete(type);
    else map.clear();
  }

  return { on, off, once, emit, clear, _map: map };
}

export default createEvents;
