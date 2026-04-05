# Claude Code Inside — 项目设计文档

## 1. 概述

**项目名称**: Claude Code Inside
**项目定位**: 交互式学习网站，通过 SVG + Framer Motion 可视化动画，解析 Claude Code 源码架构
**目标用户**: AI/Agent 系统学习者、开发者

**参考项目**: learn-claude-code (D:\AI\test\learn-claude-code\web)

---

## 2. 技术栈

| 技术 | 版本/选择 |
|------|---------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 动画 | Framer Motion 12.x |
| 样式 | Tailwind CSS 4.x |
| UI组件 | Lucide React |
| 国际化 | 中/英/日三语言 |

**输出模式**: Next.js `output: "export"` — 静态站点生成

---

## 3. 项目结构

```
claude-code-inside/
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/               # 国际化路由
│   │   │   │   ├── (learn)/            # 学习页面组
│   │   │   │   │   ├── [version]/      # 动态章节页
│   │   │   │   │   │   ├── page.tsx    # 章节详情页
│   │   │   │   │   │   └── client.tsx   # 客户端交互组件
│   │   │   │   │   ├── layout.tsx      # 学习布局（含Sidebar）
│   │   │   │   ├── timeline/page.tsx   # 时间线总览
│   │   │   │   ├── layers/page.tsx     # 层级总览
│   │   │   │   ├── compare/page.tsx    # 对比页
│   │   │   │   └── layout.tsx         # 根布局
│   │   │   ├── page.tsx               # 首页
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── header.tsx          # 顶部导航
│   │   │   │   └── sidebar.tsx         # 左侧章节导航
│   │   │   ├── visualizations/         # 可视化动画组件
│   │   │   │   ├── s01-agent-loop.tsx  # Agent循环
│   │   │   │   ├── s02-tool-system.tsx # 工具系统
│   │   │   │   ├── s03-multi-agent.tsx # 多Agent体系
│   │   │   │   ├── s04-security.tsx    # 安全层
│   │   │   │   ├── s05-ecosystem.tsx   # 生态
│   │   │   │   ├── s06-context.tsx      # 上下文
│   │   │   │   ├── s07-product.tsx      # 产品化
│   │   │   │   ├── s08-principles.tsx   # 设计原则
│   │   │   │   └── shared/
│   │   │   │       └── step-controls.tsx
│   │   │   └── ui/
│   │   │       ├── badge.tsx
│   │   │       ├── card.tsx
│   │   │       └── tabs.tsx
│   │   ├── hooks/
│   │   │   ├── useSteppedVisualization.ts  # 步骤动画控制
│   │   │   └── useDarkMode.ts             # 暗黑模式
│   │   ├── lib/
│   │   │   ├── constants.ts           # 版本元数据配置
│   │   │   ├── i18n.tsx              # 国际化客户端
│   │   │   ├── i18n-server.ts       # 国际化服务端
│   │   │   └── utils.ts
│   │   ├── i18n/
│   │   │   └── messages/
│   │   │       ├── en.json
│   │   │       ├── zh.json
│   │   │       └── ja.json
│   │   └── types/
│   │       └── agent-data.ts
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
└── docs/
    └── superpowers/
        └── specs/
```

---

## 4. 内容规划

### 8个章节（对应源码文档）

| ID | 章节名称 | 核心可视化 |
|----|---------|-----------|
| s01 | 全局视角：CLI vs Agent OS | CLI入口分发流程图（5个fast-path） |
| s02 | 引擎：主循环与Prompt编排 | query.ts 状态机 + 四道压缩机制 |
| s03 | 工具系统：42个工具 | 工具分类图谱 + 14步Pipeline |
| s04 | 多Agent体系 | Agent调度网络 + Explore/Verification |
| s05 | 安全层：三层防护网 | 权限决策流程 + Hook决策树 |
| s06 | 生态：Skill/Plugin/MCP | 扩展机制注入流程图 |
| s07 | 上下文经济学 | Token压缩四道机制 |
| s08 | 设计原则 | 7大原则可视化 + 架构总览 |

### 层级分类

```typescript
LAYERS = [
  { id: "architecture", label: "架构总览", versions: ["s01"] },
  { id: "core", label: "核心引擎", versions: ["s02", "s03"] },
  { id: "multi-agent", label: "多Agent", versions: ["s04"] },
  { id: "security", label: "安全与生态", versions: ["s05", "s06"] },
  { id: "context", label: "上下文管理", versions: ["s07"] },
  { id: "principles", label: "设计原则", versions: ["s08"] },
]
```

---

## 5. 核心组件设计

### 5.1 可视化动画模式

每个 `s0X-*.tsx` 组件遵循 **AgentLoop 动画模式**:

```typescript
interface SteppedVisualization {
  // 1. 节点定义
  NODES: FlowNode[]

  // 2. 边定义
  EDGES: FlowEdge[]

  // 3. 每步高亮的节点
  ACTIVE_NODES_PER_STEP: string[][]

  // 4. 每步高亮的边
  ACTIVE_EDGES_PER_STEP: string[][]

  // 5. 每步新增的消息
  MESSAGES_PER_STEP: (MessageBlock | null)[][]

  // 6. 步骤说明
  STEP_INFO: { title: string; desc: string }[]
}
```

### 5.2 StepControls 组件

提供统一的步骤控制:
- `prev` / `next` 按钮
- `play` / `pause` 自动播放
- `reset` 重置
- 当前步骤标题和描述

### 5.3 Header 组件

- 项目名称: "Claude Code Inside"
- 导航: Timeline / Layers / Compare
- 语言切换: EN / 中文 / 日本語
- 暗黑模式切换
- GitHub 链接

### 5.4 Sidebar 组件

- 按 LAYERS 分组显示章节
- 高亮当前活跃章节
- 响应式: 桌面端显示 / 移动端折叠

---

## 6. 首页设计

### Hero Section
- 标题: "Claude Code Inside"
- 副标题: "通过交互式可视化，深入理解 Agent 系统工程"
- 开始按钮 → Timeline 页面

### 核心循环代码展示
复刻 learn-claude-code 的 while loop 代码展示

### Message Flow 可视化
展示 messages[] 数组在 Agent 循环中的流转

### 章节卡片预览
6个主要章节的卡片，每个卡片显示:
- 章节ID
- 标题
- 核心洞察（一句话）

---

## 7. 国际化

### 支持语言
- `en` — English
- `zh` — 中文
- `ja` — 日本語

### 翻译内容
- 导航标签
- 章节标题/描述
- 步骤说明
- UI文案

---

## 8. 实现顺序

### Phase 1: 项目搭建
1. 初始化 Next.js 项目（复制 learn-claude-code 结构）
2. 配置 Tailwind CSS + Framer Motion
3. 搭建 Header / Sidebar / Layout 组件
4. 实现国际化框架

### Phase 2: 基础设施
5. 实现 useSteppedVisualization hook
6. 实现 useSvgPalette / useDarkMode hooks
7. 创建 StepControls 组件
8. 创建 Card / Badge / Tabs UI 组件

### Phase 3: 首页
9. 实现首页 Hero Section
10. 实现章节卡片预览
11. 实现 Timeline / Layers / Compare 页面

### Phase 4: 章节可视化
12. s01: Agent循环可视化
13. s02: 工具系统可视化
14. s03: 多Agent体系可视化
15. s04: 安全层可视化
16. s05: 生态可视化
17. s06: 上下文经济学可视化
18. s07: 设计原则可视化

---

## 9. 设计原则

1. **复用优先**: 直接复用 learn-claude-code 的组件结构，只改内容
2. **动画一致性**: 所有可视化遵循统一的动画交互模式
3. **简洁清晰**: 每个可视化聚焦一个核心概念
4. **响应式**: 桌面端和移动端均可正常访问
5. **国际化**: 中/英/日三语言完整支持
