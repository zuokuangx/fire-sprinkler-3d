# 消防水喷淋系统 · 三维可视化教学系统

纯前端 WebGL（three.js r160）实现的**湿式自动喷水灭火系统**三维教学可视化。
零后端、零构建，支持桌面与手机。

## 在线访问

**https://fire-sprinkler-3d.vercel.app**

## 功能

| 模块 | 内容 |
|---|---|
| 三维场景 | 5 个楼层（B1/1F/2F/3F/RF）、200 个闭式喷头、485 节点管网（719.5 m）、15 类消防设备 |
| 图层管理 | 建筑结构 / 喷淋管道 / 响应喷头 / 设备阀组 / 尺寸标注 / 文字标注 / 特效，逐层开关 |
| 视角 | 轴测、正立面、俯视、剖视；楼层聚焦；爆炸视图；建筑透视 |
| 水力计算 | Hazen-Williams（C=120，20% 局部损失），逐段流量/流速/水头损失/压力，24 行计算表 |
| 工况推演 | 火情工况（40 s）、水力工况（20 s）、末端试水（25 s），含喷头感温→玻璃球破裂→报警阀开启→压力开关→水力警铃→消防泵启动全链路联动 |
| 教学导览 | 15 步分步讲解，自动切换视角与图层 |
| 知识库 | 27 个知识点 / 5 大类，含 GB 50084-2017、GB 50261、GB 25201、GB 50974 条文 |
| 系统原理图 | 17 节点 2D 原理流程，实时状态高亮 |
| 设备信息卡 | 点击任意设备查看完整铭牌参数与关联知识点 |

## 技术栈

- **three.js r160**（本地 vendor，无 CDN 依赖）
- 原生 ES Module + importmap，无打包器（源码版）
- ACESFilmic 色调映射 + PMREM 环境光 + UnrealBloom（桌面）
- 自定义 GLSL 水流/水雾/火焰着色器
- 响应式：≥1280 桌面三栏 / 768–1279 平板 / <768 手机（底部导航 + 抽屉面板）

## 目录

```
src/
  core/      engine（渲染/相机/控制器）、materials、layers、selection、device、services、events
  data/      levels、building、network、equipment、knowledge、consistency
  world/     building、piping、equipment、labels、annotations
  sim/       hydraulics、water、fire
  ui/        shell、hud、panels、schematic、mobile、tour
styles/      main.css、print.css
vendor/three/ three.module.min.js + examples/jsm
dist/        index.html（单文件离线版）
publish/     线上部署产物（v/ 目录 + 根入口）
tools/       构建与部署脚本
```

## 本地运行

```bash
python -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

或直接双击 `dist/index.html`（单文件离线版，无需服务器）。

## 部署

```bash
node tools/deploy-pipeline.cjs
```

自动完成：源码静态化 → esbuild 打包 → gzip 切 24 片 → 上传 Vercel → 创建生产部署。

## 规范依据

- **GB 50084-2017** 自动喷水灭火系统设计规范
- **GB 50261-2017** 自动喷水灭火系统施工及验收规范
- **GB 25201-2010** 建筑消防设施的维护管理
- **GB 50974-2014** 消防给水及消火栓系统技术规范

## License

MIT
