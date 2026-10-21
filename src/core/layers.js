/* ==========================================================================
 * 图层管理 —— 可见性 + 楼层跟随 + 阴影镜像
 *
 * 关键设计：
 *  - 楼层内的管道/喷头/设备不能直接加入固定图层（否则不跟随楼层爆炸位移）
 *  - 用 attachLevel(levelId, group, layerName) 把它们挂到「楼层的镜像组」
 *  - setVisible(layer) 时同步遍历所有镜像组，统一开关
 * ========================================================================== */

export function createLayers(app) {
  /** 图层名 → Set<Object3D> */
  const groups = new Map();
  /** 楼层 id → 镜像 Group（与楼层同位置，承载非建筑类对象） */
  const mirrorLevels = new Map();
  /** 图层可见性缓存 */
  const visibility = new Map();

  const NAMES = ['building', 'pipes', 'sprinklers', 'equipment', 'labels', 'annotations', 'grid', 'fx'];
  for (const n of NAMES) { groups.set(n, new Set()); visibility.set(n, true); }

  function ensureGroup(name) {
    let s = groups.get(name);
    if (!s) { s = new Set(); groups.set(name, s); }
    return s;
  }

  /** 把对象加入某图层 */
  function attach(layerName, obj) {
    if (!obj) return obj;
    ensureGroup(layerName).add(obj);
    obj.userData.layer = layerName;
    obj.visible = visibility.get(layerName) !== false;
    return obj;
  }

  /**
   * 把对象挂到楼层的镜像组，但仍归属 layerName 图层。
   * 这样楼层执行爆炸/抬起时，管网与设备会跟随位移。
   */
  function attachLevel(levelId, obj, layerName = 'building') {
    if (!obj) return obj;
    let mirror = mirrorLevels.get(levelId);
    if (!mirror) {
      mirror = new (app.THREE.Group)();
      mirror.name = `mirror:${levelId}`;
      mirrorLevels.set(levelId, mirror);
    }
    mirror.add(obj);
    return attach(layerName, obj);
  }

  /** 记录某楼层的基准 Y（用于爆炸位移） */
  function bindLevelGroup(levelId, group) {
    if (!group) return;
    group.userData.baseY = group.position.y || 0;
    group.userData.isLevelGroup = true;
    if (!mirrorLevels.has(levelId)) {
      const mirror = new (app.THREE.Group)();
      mirror.name = `mirror:${levelId}`;
      mirrorLevels.set(levelId, mirror);
    }
  }

  /** 楼层爆炸时同步镜像组的 Y */
  function syncMirror(levelId, dy) {
    const mirror = mirrorLevels.get(levelId);
    if (mirror) mirror.position.y = dy || 0;
  }

  function syncAllMirrors(getOffset) {
    for (const [id, mirror] of mirrorLevels) {
      mirror.position.y = getOffset ? (getOffset(id) || 0) : 0;
    }
  }

  /** 设置图层可见性 */
  function setVisible(name, on) {
    if (!groups.has(name)) return false;
    visibility.set(name, !!on);
    for (const obj of groups.get(name)) {
      if (obj) obj.visible = !!on;
    }
    app.events.emit('layer:visibility', { name, visible: !!on });
    return true;
  }

  function isVisible(name) { return visibility.get(name) !== false; }

  function toggle(name) {
    const next = !isVisible(name);
    setVisible(name, next);
    return next;
  }

  function list() {
    return NAMES.map((n) => ({ name: n, visible: isVisible(n), count: (groups.get(n) || new Set()).size }));
  }

  function stats() {
    const out = {};
    for (const n of NAMES) out[n] = (groups.get(n) || new Set()).size;
    return out;
  }

  function getMirror(levelId) { return mirrorLevels.get(levelId) || null; }

  return {
    NAMES, groups, mirrorLevels,
    attach, attachLevel, bindLevelGroup, syncMirror, syncAllMirrors,
    setVisible, isVisible, toggle, list, stats, getMirror,
  };
}
