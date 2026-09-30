# 贪吃蛇 · Snake

一个用原生 HTML / CSS / JavaScript 实现的网页版贪吃蛇小游戏。零依赖、零构建步骤，双击 `index.html` 即可游玩，同时支持键盘、触屏滑动与屏幕方向键三种操作方式。

---

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [环境配置与安装指南](#环境配置与安装指南)
- [项目结构](#项目结构)
- [使用说明](#使用说明)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [联系方式](#联系方式)

---

## 项目概述

### 项目名称

贪吃蛇（Snake）

### 项目目标

用一个功能完整、可直接上手的小游戏，演示**如何把游戏逻辑、界面渲染、音频与用户输入拆成互相独立、可单独替换的模块**。核心约束有三条：

1. 零第三方依赖、零构建工具，克隆下来就能跑；
2. 分层清晰，逻辑层不感知 DOM，渲染层不修改游戏数据；
3. 在桌面端与移动端都有良好且一致的体验。

### 主要功能

| 分类 | 功能 |
| --- | --- |
| 核心玩法 | 20 × 20 网格；方向键 / WASD 控制移动；随机生成食物；吃到食物身体 +1 节、得分 +10 |
| 结束判定 | 蛇头撞到边界或撞到自身立即结束；若填满整个棋盘则判定为「完美通关」 |
| 动态难度 | 每吃一个食物，移动间隔缩短 4 毫秒（150ms → 最低 68ms），上限 21 级 |
| 游戏控制 | 开始、暂停 / 继续、重新开始；支持空格快速暂停 |
| 数据展示 | 分数、最高分（本地持久化）、当前蛇长、当前速度等级 |
| 音效 | 开局、吃食物、游戏结束三种实时合成音效；吃食物音高随连吃次数递增；带音效总开关 |
| 视觉反馈 | 蛇身沿身体渐变的平滑连续移动、食物呼吸脉动与光晕、吃到食物的扩散光环、分数弹跳、结束时的红色闪屏与棋盘抖动 |
| 响应式 | 宽屏双栏 / 窄屏单栏；棋盘始终为正方形且自适应；触屏或窄窗口自动显示屏幕方向键 |
| 交互方式 | 键盘方向键与 WASD、时间空格暂停、触屏滑动、屏幕虚拟方向键 |

---

## 技术栈

本项目是**纯前端项目**，没有服务端与数据库。

### 前端

| 技术 | 用途 |
| --- | --- |
| HTML5 | 页面语义结构、Canvas 容器、按钮与规则面板 |
| CSS3 | 深色主题、Grid / Flex 布局、`aspect-ratio` 正方形棋盘、`clamp()` / `min()` 流体尺寸、媒体查询、动画与 `prefers-reduced-motion` 兼容 |
| 原生 JavaScript（ES5 语法，IIFE 模块） | 全部游戏逻辑、渲染与交互 |
| Canvas 2D API | 棋盘、蛇身、食物与特效的逐帧绘制 |
| Web Audio API | 实时合成全部音效，不使用任何音频文件 |
| ResizeObserver / requestAnimationFrame | 画布尺寸自适应与主循环驱动 |
| localStorage | 持久化最高分与音效开关偏好 |

### 后端

无。本项目为纯客户端应用，所有逻辑在浏览器中运行，不需要任何服务端接口或数据存储服务。

### 数据库

无。仅使用浏览器 `localStorage` 保存两项本地偏好，键名如下：

| 键名 | 类型 | 说明 |
| --- | --- | --- |
| `snake.bestScore` | 字符串（数字） | 历史最高分，默认 `0` |
| `snake.soundMuted` | `"0"` / `"1"` | 音效是否静音，默认 `"0"`（开启） |

清除浏览器站点数据即可重置这两项记录。

### 其他关键技术

- **平滑移动插值**：逻辑层是格子化的（一格一跳），渲染层根据当前步的完成度 `progress` 对「上一帧位置 → 当前位置」做线性插值，因此视觉上是连续移动而非跳格。
- **事件总线**：逻辑层通过极简的 `on` / `emit` 向外广播 `reset`、`score`、`statechange`、`eat`、`step`、`gameover` 事件，渲染层与音频层只订阅、不改数据。
- **音频自动播放策略适配**：`AudioContext` 懒创建，在用户手势的捕获阶段解锁，兼顾桌面浏览器与 iOS Safari。
- **音频混音保护**：主增益 0.55 留出余量，后级串联 `DynamicsCompressor`（阈值 −14dB、压缩比 6）抑制多音效叠加时的削波。

---

## 环境配置与安装指南

### 前置要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | 不限（Windows / macOS / Linux 均可） |
| 运行时 | 无需 Node.js、无需 Python、无需任何编译环境 |
| 浏览器 | 支持 Canvas 2D 的现代浏览器（Chrome / Edge / Firefox / Safari 近两年版本） |
| 音效 | 需浏览器支持 Web Audio API；不支持时游戏自动禁用音效并提示，不影响游玩 |
| 网络 | 运行期间无需联网 |

### 依赖安装

**无需安装任何依赖。** 项目不包含 `package.json`，不使用 npm / yarn / pnpm，也没有 CDN 外链——所有代码与样式都在仓库内。

### 配置文件设置

**本项目没有任何配置文件，也不需要设置任何环境变量。**

如果你需要调整默认参数，直接修改源码中的常量即可：

| 想调整的内容 | 位置 |
| --- | --- |
| 棋盘大小、初始速度、加速幅度、每个食物的得分 | [js/game.js](js/game.js) 顶部的 `DEFAULTS` 对象 |
| 音效音量、各音效的音高与时长 | [js/audio.js](js/audio.js) 顶部的 `DEFAULTS.volume` 与 `RECIPES` 对象 |
| 主题配色、圆角、棋盘最大尺寸 | [css/style.css](css/style.css) 顶部的 `:root` 变量 |

### 环境变量要求

无。不需要 `.env` 文件，也不需要配置任何环境变量。

### 安装步骤

只有一步——把项目下载到本地：

```bash
git clone <你的仓库地址>
cd study
```

如果只拿到了压缩包，解压到任意目录即可。

---

## 项目结构

```
study/
├── index.html              页面结构：HUD、游戏画布、控制按钮、触屏方向键、规则面板
├── README.md               本文档
├── css/
│   └── style.css           全部样式：设计变量、组件样式、响应式媒体查询
└── js/
    ├── game.js             【逻辑层】SnakeGame —— 状态机、碰撞判定、食物生成、计分
    ├── renderer.js         【渲染层】CanvasRenderer —— 画布绘制、位置插值、特效
    ├── audio.js            【音频层】AudioManager —— 音效合成、音量控制、静音开关
    ├── input.js            【交互层】InputController —— 键盘、滑动、虚拟方向键
    └── main.js             【装配层】把以上四层与 DOM 界面连接起来
```

### 各模块职责

| 文件 | 对外导出 | 职责 | 依赖 |
| --- | --- | --- | --- |
| [js/game.js](js/game.js) | `window.SnakeGame` | 纯数据与状态机。维护蛇身、方向、食物、分数与 `idle / running / paused / over` 四种状态；负责撞墙与撞自身的判定、速度递增、最高分无关的全部核心规则。**完全不引用 DOM 与 Canvas**，可脱离浏览器单独测试。 | 无 |
| [js/renderer.js](js/renderer.js) | `window.CanvasRenderer` | 只读游戏状态并绘制到 Canvas。负责 DPR 适配、棋盘背景、蛇身渐变、头部朝向与眼睛、食物脉动、吃到食物的光环与结束闪屏。**绝不修改游戏数据**。 | `SnakeGame`（仅用于读取状态常量） |
| [js/audio.js](js/audio.js) | `window.AudioManager` | 用 Web Audio API 合成三种音效，管理主音量、压缩与静音状态，处理浏览器自动播放策略与环境不支持时的降级。 | 无 |
| [js/input.js](js/input.js) | `window.InputController` | 把键盘按键、触屏滑动、虚拟方向键统一翻译为「转向 / 切换暂停 / 确认 / 重启」四类游戏意图。 | `SnakeGame`（仅用于读取状态常量） |
| [js/main.js](js/main.js) | 无（自执行） | 唯一的装配层。实例化上述四层，绑定按钮与事件，驱动 `requestAnimationFrame` 主循环，处理尺寸自适应与切后台自动暂停。 | 以上全部 |

### 脚本加载顺序

`index.html` 底部按依赖顺序引入，均为普通 `<script>`（非 ES Module），因此**可以直接用 `file://` 协议打开**：

```html
<script src="js/game.js"></script>
<script src="js/renderer.js"></script>
<script src="js/audio.js"></script>
<script src="js/input.js"></script>
<script src="js/main.js"></script>
```

---

## 使用说明

### 启动命令

**方式一：直接打开（推荐，最省事）**

直接双击 `index.html`，或在浏览器地址栏输入文件路径：

```
file:///d:/TraeProjects/study/index.html
```

由于项目不使用 ES Module、不发起任何网络请求，`file://` 协议下功能完全正常。

**方式二：通过本地静态服务器打开（可选）**

如果你需要在本机其它设备上访问，或想更贴近线上环境，可以起一个静态服务器：

```bash
# 使用 Python 3
python -m http.server 8123

# 或使用 Node.js
npx serve .
```

然后在浏览器访问 `http://127.0.0.1:8123/`（端口按你的实际配置替换）。

### 基本操作流程

1. 打开页面，棋盘中央会弹出「准备好了吗？」的开始卡片。
2. 点击 **开始游戏**（或直接按空格 / 回车），蛇开始向右移动。
3. 用方向键控制蛇去吃掉红色果实。每吃一个，身体变长一节、得分 +10、移动略微加快。
4. 需要中断时点击 **暂停**（或按空格），随时可以 **继续游戏**。
5. 蛇撞到边界或自己的身体后本局结束，卡片上会显示分数与结束原因。
6. 点击 **再来一局**（或按回车 / `R`）立即重开。

### 操作对照表

| 操作 | 键盘 | 触屏 / 移动端 |
| --- | --- | --- |
| 改变方向 | `↑` `↓` `←` `→` 或 `W` `A` `S` `D` | 在棋盘上向目标方向滑动，或点击屏幕方向键 `▲` `◀` `▼` `▶` |
| 暂停 / 继续 | `空格` 或 `P` | 点击 **暂停** / **继续游戏** 按钮 |
| 开始 / 重新开始 | `回车`（未开始时开局，运行中则切换暂停）或 `R`（始终重开） | 点击 **开始游戏** / **重新开始** 按钮 |
| 音效开关 | 点击 **音效：开 / 关** 按钮 | 同左 |

> 蛇无法直接 180° 掉头。系统会缓存最多 2 次转向输入，因此快速连转（例如「上」接「左」）不会丢指令。

### 常见功能演示

**演示一：吃食物与得分**

开局后蛇默认向右移动。把果实引到蛇的正前方，吃下后可以观察到：得分数字弹跳并 +10、「长度」+1、「速度」等级 +1、果实位置出现一圈扩散光环、同时响起一声清脆的提示音。

**演示二：音高递增的正反馈**

连续吃下多个果实，吃食物的提示音会逐个升高半音（上限一个八度），能明显听出「连吃」的节奏感。

**演示三：暂停与恢复**

游戏中按空格，棋盘被半透明遮罩覆盖并显示「游戏已暂停」，此时蛇完全静止、不会累计转向指令；再按一次空格恢复。从暂停恢复**不会**重播开局音效。

**演示四：结束反馈**

停止操作让蛇一路撞向右墙，可以观察到：棋盘整体抖动、画面泛红、蛇身由绿转为红色、弹出「撞到墙壁了」的结束卡片，并响起一段下行的结束音。

**演示五：响应式与触屏操作**

把浏览器窗口拖窄到 900px 以下，布局会从双栏变为单栏、规则面板移到游戏区下方；窗口窄于 820px（或使用触屏设备）时，控制区下方会自动出现屏幕方向键，棋盘始终保持正方形且不裁切。

---

## 贡献指南

> 说明：当前目录**尚未初始化 Git 仓库**，也没有配置远程地址。如果要多人协作，请先完成初始化：
>
> ```bash
> git init
> git remote add origin <你的仓库地址>
> git add .
> git commit -m "chore: 初始化项目"
> git push -u origin main
> ```

### 分支管理策略

采用轻量的 **GitHub Flow**：`main` 分支始终保持可运行，所有改动通过短生命周期的特性分支合入。

| 分支 | 用途 | 命名示例 |
| --- | --- | --- |
| `main` | 稳定分支，始终可运行，禁止直接推送 | — |
| `feature/*` | 新功能 | `feature/wall-wrap-mode` |
| `fix/*` | 缺陷修复 | `fix/renderer-dpr-blur` |
| `docs/*` | 仅文档改动 | `docs/readme-setup` |
| `refactor/*` | 不改变行为的重构 | `refactor/split-render-effects` |

分支应尽量短命，合并后及时删除。

### 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

```
<type>(<scope>): <subject>
```

- **type**：`feat` 新功能 / `fix` 缺陷修复 / `docs` 文档 / `refactor` 重构 / `perf` 性能 / `style` 格式 / `test` 测试 / `chore` 构建与杂项
- **scope**（可选）：通常填模块名，如 `game`、`renderer`、`audio`、`input`、`style`
- **subject**：使用祈使句、简洁描述「做了什么」，不加句号

示例：

```
feat(game): 支持撞墙后从对侧穿越
fix(renderer): 修复高 DPR 屏幕下蛇身发虚
docs(readme): 补充无头测试的验证方式
refactor(input): 抽取滑动阈值常量
```

### PR 流程

1. 从最新的 `main` 切出分支：`git checkout -b feature/your-feature`
2. 完成改动，本地自测。**本项目无自动化测试与 CI**，请在提交前手动验证至少覆盖：开局、暂停 / 恢复、重新开始、撞墙结束、撞自身结束、窄屏布局、音效触发。
3. 提交并按上面的规范书写提交信息。
4. 推送分支：`git push -u origin feature/your-feature`
5. 发起 Pull Request，目标分支为 `main`。PR 描述建议包含：**改动目的、具体改动点、验证方式、截图或录屏（涉及视觉改动时必填）**。
6. 等待评审。评审通过后合并，推荐使用 **Squash Merge** 保持 `main` 的提交历史线性整洁。
7. 删除已合并的分支。

### 代码约定

- **保持零依赖**：不要引入 npm 包、构建工具或 CDN 外链，克隆即运行是本项目的重要特性。
- **不要跨层调用**：逻辑层不得引用 DOM，渲染层不得修改游戏数据，新增的 DOM 操作一律写在 `main.js`。
- **模块注册方式**：新增模块沿用现有写法，用 IIFE 包裹并挂载到 `window`，同时把 `<script>` 按依赖顺序加入 `index.html`。
- **代码风格**：与现有文件保持一致（2 空格缩进、ES5 语法、`'use strict'`、中文注释解释「为什么」而非「是什么」）。
- **可访问性**：新增交互控件请补充 `aria-label` / `aria-pressed` 等属性，并保证键盘可聚焦。
- **性能**：主循环中避免产生垃圾对象，绘制路径尽量复用，新增特效请评估其对帧率的影响。

---

## 许可证

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 发布。

```
MIT License

Copyright (c) 2026 <你的名字>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> 建议同时在项目根目录放置一份独立的 `LICENSE` 文件（内容同上），以便 GitHub 等平台自动识别许可证类型。

---

## 联系方式

| 渠道 | 信息 |
| --- | --- |
| 作者 | `chenzy` |
| 邮箱 | `<swczy@126.com>` |
| 问题反馈 | 请通过仓库的 Issues 提交，并附上浏览器版本与复现步骤 |

> 以上尖括号占位符请替换为你的真实信息。若希望避免公开个人信息，可只保留「通过仓库 Issues 反馈」这一条渠道。

---

<p align="center">用原生 JavaScript 与 Canvas 实现 · 零依赖 · 开箱即玩</p>
