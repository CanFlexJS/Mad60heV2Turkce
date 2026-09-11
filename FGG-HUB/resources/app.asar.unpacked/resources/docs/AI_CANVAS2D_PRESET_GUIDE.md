# Canvas 2D 命令式预设 AI 生成规范

**版本**: v1.0.1

本文档是为 AI 模型准备的生成规范，用于生成 PixelPrime 键盘灯光效果的**纯 Canvas 2D 命令式预设**代码。

> **⚠️ AI 强制要求：生成的代码中禁止出现任何注释**（包括单行 `//` 注释、多行 `/* */` 注释、JSDoc `/** */` 注释）。代码必须是无注释的纯逻辑代码。

---

## 目录

1. [概述](#概述)
2. [预设对象结构](#预设对象结构)
3. [Canvas 2D 上下文](#canvas-2d-上下文)
4. [输入数据](#输入数据)
5. [参数系统](#参数系统)

## 预设对象结构

```js
{
  /** 预设唯一标识，格式：kebab-case，如 'neon-flow' */
  id: 'neon-flow',

  /** 预设显示名称，推荐中文 + Emoji，如 '🌊 霓虹流光' */
  name: '🌊 霓虹流光',

  /** 图标，使用 Emoji */
  icon: '🌊',

  /** 一句话描述预设效果 */
  description: '流动的霓虹光带效果',

  /**
   * 分类（对应代码中的 PresetCategory 类型）
   * - ambient:  氛围动画（无需音频）← 默认
   * - spectrum: 频谱可视化（需要音频）
   * - rhythm:   节奏律动（需要音频）
   * - waveform: 波形可视化（需要音频）
   * - screen:   屏幕映射（需要屏幕捕获）
   * - hybrid:   混合模式
   */
  category: 'ambient',

  /** 固定为 'imperative' */
  mode: 'imperative',

  /** 标记为纯 canvas2d 预设，在 Worker 中运行，窗口最小化不掉帧 */
  canvas2d: true,

  /**
   * 数据源声明（仅需要音频时才填写）
   * 不需要音频时省略此字段
   */
  // requires: { audio: true },

  /** 用户可调节的参数列表 */
  params: [/* 见参数系统 */],

  /** 初始化函数：准备状态对象（offscreen canvas、粒子数组等） */
  setup(ctx, params) { /* ... */ return { /* state */ } },

  /** 渲染函数：每帧调用，用 ctx.canvas2d 绘制（约 60fps） */
  render(ctx, state, input, params) { /* ... */ },

  /** 清理函数：释放资源 */
  cleanup(ctx, state) { /* ... */ }
}
```

---

## Canvas 2D 上下文

### ctx 对象

```js
ctx.width       // 画布宽度，固定 800
ctx.height      // 画布高度，固定 500
ctx.canvas2d    // CanvasRenderingContext2D（核心，所有绘制都用它）
```

### ctx.canvas2d 关键特性

- 叠加在 LeaferJS 图层上方
- **每帧 `render()` 前系统自动 `clearRect`**，无需手动清空
<!-- - 若需要拖尾/累积效果，使用 offscreen canvas 配合 `drawImage` -->

> **重要**：只使用 `ctx.canvas2d` 进行绘制。不使用 `ctx.Rect`、`ctx.Ellipse`、`ctx.app.tree.add()` 等 LeaferJS API。

---

## 输入数据

### InputData（render 的第三个参数）

```js
input.deltaTime    // 距上一帧的时间差（毫秒），通常 12-20ms
input.elapsedTime  // 从预设启动至今的总时间（毫秒）
```

### 音频数据（仅 `requires: { audio: true }` 时有值）

```js
input.audio?.bass          // 低音能量 0-1
input.audio?.mid           // 中音能量 0-1
input.audio?.treble        // 高音能量 0-1
input.audio?.average       // 全频段平均能量 0-1
input.audio?.frequencyData // Uint8Array，每值 0-255
input.audio?.binCount      // 频点总数（通常 128 或 256）
```

---

## 参数系统

### 默认参数（每个预设必须包含）

每个预设的 `params` 数组**必须**包含以下两个默认参数，放在 `params` 数组的**末尾**：

| key | name | type | default | 说明 |
| --- | --- | --- | --- | --- |
| `bgColor` | 背景色 | color | `'#000000'` | 画布底色，颜色选择器。默认纯黑 |
| `brightness` | 亮度 | number (0-100, step 1) | 100 | 整体亮度百分比。0 = 全灭，100 = 全亮 |

在 `params` 数组中的声明：

```js
params: [
  // ... 预设自身的参数 ...
  { key: 'bgColor', name: '背景色', type: 'color', default: '#000000' },
  { key: 'brightness', name: '亮度', type: 'number', min: 0, max: 100, step: 1, default: 100 },
],
```

### 在 render 中应用默认参数

```js
render(ctx, state, input, params) {
  const c2d = ctx.canvas2d
  const W = ctx.width
  const H = ctx.height
  const bgColor = params.bgColor ?? '#000000'
  const brightness = (params.brightness ?? 100) / 100

  // 1. 填充背景色（非纯黑时绘制底色，纯黑保持透明即可）
  if (bgColor !== '#000000') {
    c2d.fillStyle = bgColor
    c2d.fillRect(0, 0, W, H)
  }

  // 2. 绘制效果时，将颜色乘以 brightness 系数
  //    HSL 模式：缩放 lightness
  //    c2d.fillStyle = `hsl(${hue}, 80%, ${60 * brightness}%)`
  //    RGB 模式：缩放各通道
  //    c2d.strokeStyle = `rgba(${r * brightness}, ${g * brightness}, ${b * brightness}, alpha)`
}
```

> **要点**：`bgColor` 在所有绘制之前最先应用（作为底色），`brightness` 影响所有后续绘制的颜色亮度。

---

### 在代码中读取参数

```js
// 始终提供后备默认值（与 params 定义中的 default 一致）
const amplitude = params.amplitude ?? 40
const glowColor = params.glowColor ?? '#4cc9f0'
const shape     = params.shape     ?? 'circle'
const showTrail = params.showTrail ?? true
const count     = Math.round(params.count ?? 10) // 整数用 Math.round
```

---
### 必须满足

- 使用**纯 JavaScript**，不要使用 TypeScript 类型注解、接口、`import type` 等语法
- 文件扩展名为 `.js`
- `mode` 固定为 `'imperative'`
- **只使用 `ctx.canvas2d` 进行绘制**，不使用 `ctx.Rect`、`ctx.Ellipse`、`ctx.app.tree.add()` 等 LeaferJS API
- `setup` 必须返回包含所有状态的普通对象
- `render` 返回 `void`，不能有任何异步操作
- 默认分类为 `'ambient'`（氛围动画），**不使用音频除非用户明确要求**
- 若使用音频数据，必须先检查：`if (!audio) return`，并设置 `requires: { audio: true }`
- 所有参数读取必须提供后备默认值：`params.key ?? defaultValue`
- 所有坐标在画布范围内（x: 0–ctx.width, y: 0–ctx.height）
- 画布尺寸使用 `ctx.width` / `ctx.height`，**禁止硬编码** `800`/`500`
- `id` 使用 kebab-case 格式，全局唯一
- `name` 使用中文 + Emoji，4–10 个字符
- **所有常量、工具函数、配色方案必须定义在预设对象内部**（`setup` / `render` / `cleanup` 中），不允许在预设对象外部定义任何 `const`、`let`、`function`。常量可放在 `setup()` 中并存入 state，工具函数可作为 `render()` 内部函数或存入 state

### cleanup 规则

- Canvas 2D 预设**通常不需要**在 `cleanup` 中做特殊操作（系统自动清理画布）
- 如果在 `state` 中引用了 offscreen canvas，由 GC 自动回收即可
- 如果用了 `setInterval`/`setTimeout`（不推荐），必须在 `cleanup` 中 clear

### 禁止事项

- 禁止使用 TypeScript 语法（类型注解、接口、泛型、`as`、`import type` 等）
- 禁止使用 LeaferJS 图形 API（`ctx.Rect`、`ctx.Ellipse`、`ctx.Star`、`ctx.app.tree.add()` 等）
- 禁止在 `render()` 中使用 `async/await` 或 Promise
- 禁止访问 `window`、`document`（offscreen canvas 除外：`document.createElement('canvas')` 合法）
- 禁止在 `setup`/`render`/`cleanup` 中使用 `console.log`（调试期间除外）
- 禁止在每帧 `render()` 中重新创建渐变对象（需缓存，或仅在参数变化时重建）
- **禁止默认添加音频响应**，除非用户明确要求
- **禁止在预设对象外部定义变量**：`const`、`let`、`var`、`function` 声明只能出现在 `setup()`、`render()`、`cleanup()` 函数体内部。颜色常量、配色表、工具函数等都必须放在对象内部（通常在 `setup()` 中初始化并存入 state）

### 性能禁止事项（低端机兼容，必须遵守）

以下行为会在低配置设备上导致严重卡顿，**严格禁止**：

#### ❌ 禁止：在循环内对每个元素单独 stroke() + shadowBlur

`shadowBlur` 是 Canvas 2D 中开销最大的属性，每次 `stroke()` 都会触发一次软件模糊计算。在粒子循环中使用时，100 个粒子 = 100 次模糊，低端机会立即卡顿。

```js
// ❌ 错误：每粒子一次 stroke，shadowBlur 计算 N 次
c2d.shadowBlur = 15
for (const p of state.particles) {
  c2d.beginPath()
  c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2)
  c2d.stroke()  // 每次 stroke 都触发一次模糊计算
}

// ✅ 正确：同色粒子合并为一条路径，只 stroke 一次
c2d.shadowBlur = 15
c2d.beginPath()
for (const p of state.particles) {
  c2d.moveTo(p.x + p.r, p.y)
  c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2)
}
c2d.stroke()  // 所有粒子只触发一次模糊计算
```

**多色粒子的替代方案**：用"宽线半透明外晕 + 细线全亮芯线"模拟发光，完全避免 `shadowBlur`：

```js
// ✅ 替代方案：双层线模拟发光，无 shadowBlur
for (const p of state.particles) {
  c2d.strokeStyle = `hsla(${p.hue}, 80%, 60%, 0.25)`
  c2d.lineWidth = p.size * 3
  c2d.beginPath()
  c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2)
  c2d.stroke()

  c2d.strokeStyle = `hsla(${p.hue}, 80%, 90%, 1)`
  c2d.lineWidth = p.size * 0.5
  c2d.beginPath()
  c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2)
  c2d.stroke()
}
```

#### ❌ 禁止：每帧调用 getImageData / putImageData

`getImageData` 会强制 GPU→CPU 数据回读，是帧率杀手。除非实现屏幕采样类效果，否则禁止使用。

```js
// ❌ 严禁在 render() 中每帧调用
const imgData = c2d.getImageData(0, 0, ctx.width, ctx.height)
```

#### ❌ 禁止：不限量生成粒子

粒子数组必须在**生成阶段**就限流，不能等到渲染后再裁剪。

```js
// ❌ 错误：先让数组无限增长，渲染完再裁剪
while (state.spawnTimer >= interval) {
  state.spawnTimer -= interval
  state.particles.push({ ... })  // 没有上限检查
}
// ... 渲染 ...
if (state.particles.length > 500) state.particles.splice(0, ...)  // 太晚了

// ✅ 正确：生成时就判断上限
while (state.spawnTimer >= interval) {
  state.spawnTimer -= interval
  if (state.particles.length >= maxParticles) break  // 先检查，再生成
  state.particles.push({ ... })
}
```

#### ❌ 禁止：不限制单帧 deltaTime

卡顿帧的 `deltaTime` 可能高达 200ms+，不加限制会导致粒子爆发式生成：

```js
// ❌ 错误：直接用 deltaTime，卡顿后爆发粒子
const dt = input.deltaTime * 0.001

// ✅ 正确：限制最大步长为 50ms
const dt = Math.min(input.deltaTime, 50) * 0.001
```

---

### 性能建议（推荐但非强制）

- 粒子数量上限：低速率效果建议 200，高速率建议不超过 300
- `spawnRate` 参数的 `max` 值建议不超过 40，避免生成速率超出消亡速率
- 音频平滑系数（smoothing）建议 0.1–0.4，不要设为 0
- 避免在 `render()` 中分配大型数组，应在 `setup()` 中预分配（如 `Float32Array`）
- 善用 `save()` / `restore()` 隔离绘制状态，避免状态泄漏
- offscreen canvas 的拖尾衰减值 `trailDecay` 建议 0.02–0.5（越小拖尾越长）
- 每帧创建渐变开销较大，如果渐变参数不变，可在 `setup` 中缓存
- `canvas.filter` 属性（如 `blur(8px)`）同样很贵，避免每帧修改

---
