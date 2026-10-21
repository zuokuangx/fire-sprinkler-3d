/**
 * 图层管理
 * 固定图层：building | pipes | sprinklers | equipment | labels | fx | grid | annotations
 * - 每个图层是一个 THREE.Group，挂在 engine.root 下。
 * - 楼层 group（level.group）挂在 building 图层下，管网/设备通过 attachLevel 挂到楼层 group，
 *   这样爆炸视图移动楼层时，管网与设备自动跟随。
 */

import * as THREE from 'three';

export const LAYER_DEFS = [
  { name: 'building', label: '建筑结构', icon: 'building', desc: '墙体、楼板、吊顶、门窗' },
  { name: 'pipes', label: '喷淋管道', icon: 'pipe', desc: '配水干管、配水管、支管、立管' },
  { name: 'sprinklers', label: '响应喷头', icon: 'sprinkler', desc: '闭式喷头（下垂型/直立型）' },
  { name: 'equipment', label: '设备与阀组', icon: 'valve', desc: '报警阀、水泵、水池、水箱等' },
  { name: 'annotations', label: '尺寸标注', icon: 'ruler', desc: '喷头间距、距墙距离、标高' },
  { name: 'labels', label: '文字标注', icon: 'tag', desc: '房间名、设备位号' },
  { name: 'fx', label: '特效', icon: 'spark', desc: '水雾、烟气、火焰、光效' },
  { name: 'grid', label: '参考网格', icon: 'grid', desc: '地面网格与坐标轴' },
];

export function createLayers(app) {
  const registry = new Map();   // name -> Group
  const levelGroups = new Map(); // levelId -> Group
  const mirrorLevels = new Map(); // layerName -> Map<levelId, Group>

  function register(name, group) {
    if (!group) {
      group = new THREE.Group();
      group.name = `layer:${name}`;
    }
    const old = registry.get(name);
    if (old && old.parent) old.parent.remove(old);
    registry.set(name, group);
    group.name = `layer:${name}`;
    group.userData.layer = name;
    if (app.engine && app.engine.root) app.engine.root.add(group);
    return group;
  }

  function get(name) {
    let g = registry.get(name);
    if (!g) g = register(name);
    return g;
  }

  function setVisible(name, visible) {
    const g = registry.get(name);
    if (!g) return;
    g.visible = !!visible;
    app.state.layerVisible[name] = !!visible;
    if (app.events) app.events.emit('layer:visibility', { name, visible: !!visible });
  }

  function isVisible(name) {
    const g = registry.get(name);
    return g ? g.visible : false;
  }

  /** 初始化全部图层 + 每层 group */
  function initAll(levelList) {
    for (const def of LAYER_DEFS) {
      const g = register(def.name);
      g.visible = true;
      app.state.layerVisible[def.name] = true;
    }
    // 楼层 group 挂到 building 图层
    const building = get('building');
    for (const level of levelList) {
      let lg = levelGroups.get(level.id);
      if (!lg) {
        lg = new THREE.Group();
        lg.name = `level:${level.id}`;
        lg.userData.levelId = level.id;
        lg.userData.isLevelGroup = true;
        levelGroups.set(level.id, lg);
        building.add(lg);
      }
      level.group = lg;
    }
    return building;
  }

  /**
   * 把某组内容挂到指定楼层 group（随楼层爆炸移动）
   *
   * 关键：楼层 group 本身挂在 building 图层下，若直接挂进去，
   * 那 pipes/sprinklers 图层开关就失效了。因此这里做"影子楼层"机制：
   *   · 每个图层为每层创建一个镜像 group（layer:pipe 下的 level:L1），
   *     其 position.y 与真实楼层 group 同步（爆炸时一起动）
   *   · attachLevel(levelId, group, 'pipes') 就把 group 挂进 pipes 图层的镜像楼层里
   *
   * @param {string} levelId
   * @param {THREE.Object3D} group 要挂载的内容
   * @param {string} [layerName] 归属图层（默认 building）
   */
  function attachLevel(levelId, group, layerName = 'building') {
    const layer = get(layerName);
    if (layerName === 'building') {
      const lg = levelGroups.get(levelId) || layer;
      lg.add(group);
      return group;
    }
    // 影子楼层
    let mirror = mirrorLevels.get(layerName);
    if (!mirror) {
      mirror = new Map();
      mirrorLevels.set(layerName, mirror);
    }
    let mg = mirror.get(levelId);
    if (!mg) {
      mg = new THREE.Group();
      mg.name = `mirror:${layerName}:${levelId}`;
      mg.userData.levelId = levelId;
      mg.userData.isMirrorLevel = true;
      layer.add(mg);
      mirror.set(levelId, mg);
    }
    mg.add(group);
    return group;
  }

  /** 楼层位移时同步影子楼层的 Y（由 engine.setExplode 调用） */
  function syncMirror(levelId, y) {
    for (const mirror of mirrorLevels.values()) {
      const mg = mirror.get(levelId);
      if (mg) mg.position.y = y;
    }
  }

  /** 同步所有影子楼层（全量） */
  function syncAllMirrors() {
    for (const [levelId, lg] of levelGroups) {
      syncMirror(levelId, lg.position.y);
    }
  }

  function levelGroup(levelId) {
    return levelGroups.get(levelId) || null;
  }

  function names() {
    return Array.from(registry.keys());
  }

  function each(fn) {
    registry.forEach((g, n) => fn(g, n));
  }

  /** 设置整个图层透明度（用于"透视建筑"） */
  function setLayerOpacity(name, opacity) {
    const g = registry.get(name);
    if (!g) return;
    g.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
        m.transparent = true;
        m.opacity = m.userData.baseOpacity * opacity;
        m.depthWrite = opacity > 0.6;
        m.needsUpdate = true;
      }
    });
  }

  return {
    LAYER_DEFS, register, get, setVisible, isVisible, initAll,
    attachLevel, syncMirror, syncAllMirrors, levelGroup, names, each, setLayerOpacity, registry,
  };
}

export default createLayers;
