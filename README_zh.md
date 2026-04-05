# Claude Code 深度解析

通过源码分析，探索 Claude Code 内部架构与设计原理的交互式可视化教程。

[English](README.md) | [中文](README_zh.md)

## 一键启动

复制并发送给任何 AI 助手，它会自动帮你克隆并运行：

```
帮我克隆并运行这个项目：https://github.com/kyirexy/claude-deepdive
```

## 特性

- **11 个章节** - 涵盖架构总览、核心引擎、多Agent、安全、上下文管理、设计原则、生态扩展、终端架构、基础设施
- **交互式可视化** - 逐步动画图解每个核心概念
- **双语支持** - 完整的中英文内容
- **源码为基** - 所有讲解均基于 Claude Code 实际源码

## 快速开始

```bash
cd web
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
claude-deepdive/
├── web/                    # Next.js 应用
│   ├── src/
│   │   ├── app/          # 页面 (locale/[version], timeline, layers)
│   │   ├── components/   # UI 组件和可视化
│   │   ├── hooks/        # 自定义 React hooks
│   │   └── lib/          # 常量、i18n、章节内容
│   └── public/           # 静态资源
└── docs/                  # 额外文档
```

## 章节一览

| 章节 | 主题 | 可视化内容 |
|------|------|-----------|
| s01 | Agent 循环 | While-loop 流程图 |
| s02 | 提示词引擎 | 4层压缩流水线 |
| s03 | 工具系统 | 14步执行管道 |
| s04 | 多Agent系统 | Main + Explore + Verify 架构 |
| s05 | 安全层 | 3层防护流程 |
| s06 | 生态系统 | Skill / Plugin / MCP 架构 |
| s07 | 上下文经济学 | Token 预算管理 |
| s08 | 设计原则 | 7条源码提炼原则 |
| s09 | 扩展生态 | Session / MCP / Plugin / Skill |
| s10 | 终端架构 | CLI / main.tsx / TUI 启动流程 |
| s11 | 基础设施 | 日志、网络、配置（纯文字） |

## 技术栈

- **框架**: Next.js 15
- **UI**: React 19, Tailwind CSS 4
- **动画**: Framer Motion 12
- **图标**: Lucide React
- **Markdown**: react-markdown with remark-gfm

## 联系方式

- **B站**: [1679132605](https://space.bilibili.com/1679132605)
- **微信**: lxy11300725
- **QQ**: 1592880030

## 开源协议

MIT
