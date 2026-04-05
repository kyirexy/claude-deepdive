# Claude Code Deep Dive

An interactive visual tutorial exploring the internal architecture and design principles of Claude Code, powered by source code analysis.

[English](README.md) | [中文](README_zh.md)

## Features

- **11 Chapters** covering Architecture, Core Engine, Multi-Agent, Security, Context Management, Design Principles, Ecosystem, Terminal Architecture, and Infrastructure
- **Interactive Visualizations** - Step-by-step animated diagrams for each core concept
- **Bilingual Support** - Full content in both English and Chinese
- **Source Code Grounded** - All explanations referenced from actual Claude Code source files

## Quick Start

```bash
cd web
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
claude-deepdive/
├── web/                    # Next.js application
│   ├── src/
│   │   ├── app/          # Pages (locale/[version], timeline, layers)
│   │   ├── components/   # UI components and visualizations
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Constants, i18n, chapter content
│   └── public/           # Static assets
└── docs/                  # Additional documentation
```

## Chapters

| Chapter | Topic | Visualization |
|---------|-------|---------------|
| s01 | Agent Loop | While-loop flowchart |
| s02 | Prompt Engine | 4-tier compression pipeline |
| s03 | Tool System | 14-step execution pipeline |
| s04 | Multi-Agent | Main + Explore + Verify architecture |
| s05 | Security Layer | 3-layer protection flow |
| s06 | Ecosystem | Skill / Plugin / MCP architecture |
| s07 | Context Economics | Token budget management |
| s08 | Design Principles | 7 principles from source code |
| s09 | Extension Ecosystem | Session / MCP / Plugin / Skill |
| s10 | Terminal Architecture | CLI / main.tsx / TUI flow |
| s11 | Infrastructure | Log, Network, Config (text only) |

## Tech Stack

- **Framework**: Next.js 15
- **UI**: React 19, Tailwind CSS 4
- **Animations**: Framer Motion 12
- **Icons**: Lucide React
- **Markdown**: react-markdown with remark-gfm

## Contact

- **GitHub**: [kyirexy/claude-deepdive](https://github.com/kyirexy/claude-deepdive)
- **Bilibili**: [1679132605](https://space.bilibili.com/1679132605)
- **WeChat**: lxy11300725
- **QQ**: 1592880030

## License

MIT
