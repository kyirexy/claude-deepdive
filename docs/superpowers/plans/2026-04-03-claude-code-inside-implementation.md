# Claude Code Inside — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Claude Code Inside 交互式学习网站，包含8个可视化章节

**Architecture:** 基于 Next.js 15 + Framer Motion + Tailwind CSS，复刻 learn-claude-code 项目结构，实现 SVG + Framer Motion 可视化动画

**Tech Stack:** Next.js 15, TypeScript, Framer Motion 12.x, Tailwind CSS 4.x, Lucide React

---

## 阶段概览

| Phase | 内容 | 任务数 |
|-------|------|-------|
| Phase 1 | 项目初始化与基础设施 | 8 |
| Phase 2 | 布局组件（Header/Sidebar） | 3 |
| Phase 3 | 首页与导航页面 | 4 |
| Phase 4 | 可视化动画组件 | 8 |
| Phase 5 | 国际化与细节完善 | 3 |

---

## Phase 1: 项目初始化与基础设施

### Task 1: 初始化 Next.js 项目

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\package.json`
- Create: `D:\AI\test\claude-code-inside\web\next.config.ts`
- Create: `D:\AI\test\claude-code-inside\web\tsconfig.json`
- Create: `D:\AI\test\claude-code-inside\web\tailwind.config.ts`
- Create: `D:\AI\test\claude-code-inside\web\postcss.config.mjs`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "framer-motion": "^12.34.0",
    "lucide-react": "^0.564.0",
    "next": "15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 创建 next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: 创建 postcss.config.mjs**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: 创建 src/app/globals.css**

```css
@import "tailwindcss";

:root {
  --color-bg: #ffffff;
  --color-border: #e5e7eb;
  --color-text: #18181b;
  --color-text-secondary: #71717a;
}

.dark {
  --color-bg: #09090b;
  --color-border: #27272a;
  --color-text: #fafafa;
  --color-text-secondary: #a1a1aa;
}
```

- [ ] **Step 6: 创建 src/app/page.tsx**

```tsx
export default function Home() {
  return <div>Claude Code Inside</div>;
}
```

- [ ] **Step 7: 创建 src/app/layout.tsx**

```tsx
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: initialize Next.js project with Tailwind CSS"
```

---

### Task 2: 创建核心目录结构和类型定义

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\types\agent-data.ts`
- Create: `D:\AI\test\claude-code-inside\web\src\lib\utils.ts`
- Create: `D:\AI\test\claude-code-inside\web\src\lib\constants.ts`

- [ ] **Step 1: 创建 src/types/agent-data.ts**

```typescript
export interface VersionMeta {
  title: string;
  subtitle: string;
  coreAddition: string;
  keyInsight: string;
  layer: LayerId;
  prevVersion: string | null;
}

export type LayerId = "architecture" | "core" | "multi-agent" | "security" | "context" | "principles";

export interface Layer {
  id: LayerId;
  label: string;
  color: string;
  versions: string[];
}

export type VersionId = "s01" | "s02" | "s03" | "s04" | "s05" | "s06" | "s07" | "s08";
```

- [ ] **Step 2: 创建 src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}
```

- [ ] **Step 3: 创建 src/lib/constants.ts**

```typescript
import type { VersionMeta, Layer } from "@/types/agent-data";

export const VERSION_ORDER = [
  "s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08"
] as const;

export const LEARNING_PATH = VERSION_ORDER;

export type VersionId = typeof LEARNING_PATH[number];

export const VERSION_META: Record<string, VersionMeta> = {
  s01: {
    title: "全局视角：CLI vs Agent OS",
    subtitle: "代码库规模与平台化设计",
    coreAddition: "fast-path 分发逻辑",
    keyInsight: "Claude Code 不只是一个 CLI，而是一个 Agent Operating System",
    layer: "architecture",
    prevVersion: null
  },
  s02: {
    title: "引擎：主循环与 Prompt 编排",
    subtitle: "query.ts 状态机详解",
    coreAddition: "四道压缩机制",
    keyInsight: "用 while(true) + state 取代递归，避免爆栈",
    layer: "core",
    prevVersion: "s01"
  },
  s03: {
    title: "工具系统：42个工具",
    subtitle: "工具接口与 Pipeline",
    coreAddition: "14 步执行流水线",
    keyInsight: "工具调用要有治理，不能模型说调就调",
    layer: "core",
    prevVersion: "s02"
  },
  s04: {
    title: "多 Agent 体系",
    subtitle: "分工与调度",
    coreAddition: "Explore/Verification Agent",
    keyInsight: "把角色拆开：做事者与验收者分离",
    layer: "multi-agent",
    prevVersion: "s03"
  },
  s05: {
    title: "安全层：三层防护网",
    subtitle: "权限、Hook 与防护",
    coreAddition: "Speculative Classifier",
    keyInsight: "安全层要互不绕过",
    layer: "security",
    prevVersion: "s04"
  },
  s06: {
    title: "生态：Skill/Plugin/MCP",
    subtitle: "扩展机制",
    coreAddition: "MCP instructions 注入",
    keyInsight: "生态的关键是让模型感知到自己的能力",
    layer: "security",
    prevVersion: "s05"
  },
  s07: {
    title: "上下文经济学",
    subtitle: "Token 就是预算",
    coreAddition: "四道压缩 + Reactive Compact",
    keyInsight: "每个 Token 都有成本，能缓存的缓存，能压缩的压缩",
    layer: "context",
    prevVersion: "s06"
  },
  s08: {
    title: "设计原则",
    subtitle: "从源码提炼的 7 条原则",
    coreAddition: "全部原则汇总",
    keyInsight: "产品化在于处理第二天的问题",
    layer: "principles",
    prevVersion: "s07"
  },
};

export const LAYERS: Layer[] = [
  { id: "architecture", label: "架构总览", color: "#3B82F6", versions: ["s01"] },
  { id: "core", label: "核心引擎", color: "#10B981", versions: ["s02", "s03"] },
  { id: "multi-agent", label: "多Agent", color: "#8B5CF6", versions: ["s04"] },
  { id: "security", label: "安全与生态", color: "#F59E0B", versions: ["s05", "s06"] },
  { id: "context", label: "上下文管理", color: "#EF4444", versions: ["s07"] },
  { id: "principles", label: "设计原则", color: "#EC4899", versions: ["s08"] },
];
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add core types, constants, and utils"
```

---

### Task 3: 创建 hooks

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\hooks\useDarkMode.ts`
- Create: `D:\AI\test\claude-code-inside\web\src\hooks\useSteppedVisualization.ts`

- [ ] **Step 1: 创建 useDarkMode.ts**

```typescript
"use client";

import { useState, useEffect } from "react";

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });

    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export interface SvgPalette {
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  activeNodeFill: string;
  activeNodeStroke: string;
  activeNodeText: string;
  endNodeFill: string;
  endNodeStroke: string;
  edgeStroke: string;
  activeEdgeStroke: string;
  arrowFill: string;
  labelFill: string;
  bgSubtle: string;
}

export function useSvgPalette(): SvgPalette {
  const isDark = useDarkMode();

  if (isDark) {
    return {
      nodeFill: "#27272a",
      nodeStroke: "#3f3f46",
      nodeText: "#d4d4d8",
      activeNodeFill: "#3b82f6",
      activeNodeStroke: "#2563eb",
      activeNodeText: "#ffffff",
      endNodeFill: "#a855f7",
      endNodeStroke: "#9333ea",
      edgeStroke: "#52525b",
      activeEdgeStroke: "#3b82f6",
      arrowFill: "#71717a",
      labelFill: "#a1a1aa",
      bgSubtle: "#18181b",
    };
  }

  return {
    nodeFill: "#e2e8f0",
    nodeStroke: "#cbd5e1",
    nodeText: "#475569",
    activeNodeFill: "#3b82f6",
    activeNodeStroke: "#2563eb",
    activeNodeText: "#ffffff",
    endNodeFill: "#a855f7",
    endNodeStroke: "#9333ea",
    edgeStroke: "#cbd5e1",
    activeEdgeStroke: "#3b82f6",
    arrowFill: "#94a3b8",
    labelFill: "#94a3b8",
    bgSubtle: "#f8fafc",
  };
}
```

- [ ] **Step 2: 创建 useSteppedVisualization.ts**

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SteppedVisualizationOptions {
  totalSteps: number;
  autoPlayInterval?: number;
}

interface SteppedVisualizationReturn {
  currentStep: number;
  totalSteps: number;
  next: () => void;
  prev: () => void;
  reset: () => void;
  goToStep: (step: number) => void;
  isPlaying: boolean;
  toggleAutoPlay: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function useSteppedVisualization({
  totalSteps,
  autoPlayInterval = 2500,
}: SteppedVisualizationOptions): SteppedVisualizationReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps]
  );

  const toggleAutoPlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, autoPlayInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, totalSteps, autoPlayInterval]);

  return {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    goToStep,
    isPlaying,
    toggleAutoPlay,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add useDarkMode and useSteppedVisualization hooks"
```

---

## Phase 2: 布局组件

### Task 4: 创建 UI 基础组件

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\components\ui\badge.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\components\ui\card.tsx`

- [ ] **Step 1: 创建 badge.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { LayerId } from "@/types/agent-data";

const LAYER_COLORS: Record<LayerId, string> = {
  architecture: "bg-blue-500",
  core: "bg-emerald-500",
  "multi-agent": "bg-purple-500",
  security: "bg-amber-500",
  context: "bg-red-500",
  principles: "bg-pink-500",
};

const LAYER_TEXT_COLORS: Record<LayerId, string> = {
  architecture: "text-blue-500",
  core: "text-emerald-500",
  "multi-agent": "text-purple-500",
  security: "text-amber-500",
  context: "text-red-500",
  principles: "text-pink-500",
};

export function LayerBadge({
  layer,
  children,
  className,
}: {
  layer: LayerId;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        LAYER_COLORS[layer],
        className
      )}
    >
      <span className="text-white">{children}</span>
    </span>
  );
}
```

- [ ] **Step 2: 创建 card.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add UI components (badge, card)"
```

---

### Task 5: 创建 Header 组件

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\components\layout\header.tsx`

- [ ] **Step 1: 创建 header.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Github, Menu, X, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "timeline", href: "/timeline" },
  { key: "layers", href: "/layers" },
] as const;

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
];

export function Header() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) {
      setDark(stored === "dark");
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    window.location.href = newPath;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="text-lg font-bold">
          Claude Code Inside
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={cn(
                "text-sm font-medium transition-colors hover:text-zinc-900 dark:hover:text-white",
                pathname.includes(item.href)
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {item.key}
            </Link>
          ))}

          {/* Locale switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLocale(l.code)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  locale === l.code
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleDark}
            className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white"
          >
            <Github size={18} />
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className="flex min-h-[44px] items-center text-sm"
              onClick={() => setMobileOpen(false)}
            >
              {item.key}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Header component with locale and dark mode"
```

---

### Task 6: 创建 Sidebar 组件

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\components\layout\sidebar.tsx`

- [ ] **Step 1: 创建 sidebar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAYERS, VERSION_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LAYER_DOT_BG: Record<string, string> = {
  architecture: "bg-blue-500",
  core: "bg-emerald-500",
  "multi-agent": "bg-purple-500",
  security: "bg-amber-500",
  context: "bg-red-500",
  principles: "bg-pink-500",
};

export function Sidebar() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";

  return (
    <nav className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-[calc(3.5rem+2rem)] space-y-5">
        {LAYERS.map((layer) => (
          <div key={layer.id}>
            <div className="flex items-center gap-1.5 pb-1.5">
              <span className={cn("h-2 w-2 rounded-full", LAYER_DOT_BG[layer.id])} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {layer.label}
              </span>
            </div>
            <ul className="space-y-0.5">
              {layer.versions.map((vId) => {
                const meta = VERSION_META[vId];
                const href = `/${locale}/${vId}`;
                const isActive =
                  pathname === href ||
                  pathname === `${href}/` ||
                  pathname.startsWith(`${href}/diff`);

                return (
                  <li key={vId}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
                      )}
                    >
                      <span className="font-mono text-xs">{vId}</span>
                      <span className="ml-1.5">{meta?.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Sidebar component with layer navigation"
```

---

## Phase 3: 首页与导航页面

### Task 7: 创建首页

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\app\[locale]\page.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\app\[locale]\layout.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\components\layout\home-content.tsx`

- [ ] **Step 1: 创建根布局 src/app/[locale]/layout.tsx**

```tsx
import { Header } from "@/components/layout/header";
import { I18nProvider } from "@/lib/i18n";

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return children;
}
```

- [ ] **Step 2: 创建 src/app/[locale]/page.tsx**

```tsx
import Link from "next/link";
import { LEARNING_PATH, VERSION_META, LAYERS } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LAYER_BORDER_COLORS: Record<string, string> = {
  architecture: "border-blue-500/30 hover:border-blue-500/60",
  core: "border-emerald-500/30 hover:border-emerald-500/60",
  "multi-agent": "border-purple-500/30 hover:border-purple-500/60",
  security: "border-amber-500/30 hover:border-amber-500/60",
  context: "border-red-500/30 hover:border-red-500/60",
  principles: "border-pink-500/30 hover:border-pink-500/60",
};

const LAYER_BAR_COLORS: Record<string, string> = {
  architecture: "bg-blue-500",
  core: "bg-emerald-500",
  "multi-agent": "bg-purple-500",
  security: "bg-amber-500",
  context: "bg-red-500",
  principles: "bg-pink-500",
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="flex flex-col gap-20 pb-16">
      {/* Hero Section */}
      <section className="flex flex-col items-center px-2 pt-8 text-center sm:pt-20">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Claude Code Inside
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--color-text-secondary)] sm:text-xl">
          通过交互式可视化，深入理解 Agent 系统工程
        </p>
        <div className="mt-8">
          <Link
            href={`/${locale}/timeline`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            开始学习
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* Learning Path Preview */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">学习路径</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            8个章节，带你深入理解 Claude Code 架构
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEARNING_PATH.map((versionId) => {
            const meta = VERSION_META[versionId];
            if (!meta) return null;
            return (
              <Link key={versionId} href={`/${locale}/${versionId}`} className="group block">
                <Card
                  className={cn(
                    "h-full border transition-all duration-200",
                    LAYER_BORDER_COLORS[meta.layer]
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <LayerBadge layer={meta.layer}>{versionId}</LayerBadge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold group-hover:underline">
                    {meta.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {meta.keyInsight}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Layer Overview */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">架构分层</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            从不同维度理解 Agent 系统
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {LAYERS.map((layer) => (
            <div
              key={layer.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div
                className={cn(
                  "h-full w-1.5 self-stretch rounded-full",
                  LAYER_BAR_COLORS[layer.id]
                )}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{layer.label}</h3>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {layer.versions.length} 个章节
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {layer.versions.map((vid) => {
                    const meta = VERSION_META[vid];
                    return (
                      <Link key={vid} href={`/${locale}/${vid}`}>
                        <LayerBadge
                          layer={layer.id}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        >
                          {vid}: {meta?.title}
                        </LayerBadge>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 更新 src/app/layout.tsx**

```tsx
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: create home page with hero and learning path"
```

---

### Task 8: 创建章节页面

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\app\[locale]\[version]\page.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\app\[locale]\(learn)\layout.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\components\visualizations\index.tsx`

- [ ] **Step 1: 创建学习布局 src/app/[locale]/(learn)/layout.tsx**

```tsx
import { Sidebar } from "@/components/layout/sidebar";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建章节页面 src/app/[locale]/[version]/page.tsx**

```tsx
import Link from "next/link";
import { LEARNING_PATH, VERSION_META } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function generateStaticParams() {
  return LEARNING_PATH.map((version) => ({ version }));
}

export default async function VersionPage({
  params,
}: {
  params: Promise<{ locale: string; version: string }>;
}) {
  const { locale, version } = await params;
  const meta = VERSION_META[version];

  if (!meta) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">章节不存在</h1>
      </div>
    );
  }

  const pathIndex = LEARNING_PATH.indexOf(version as typeof LEARNING_PATH[number]);
  const prevVersion = pathIndex > 0 ? LEARNING_PATH[pathIndex - 1] : null;
  const nextVersion =
    pathIndex < LEARNING_PATH.length - 1 ? LEARNING_PATH[pathIndex + 1] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-zinc-100 px-3 py-1 font-mono text-lg font-bold dark:bg-zinc-800">
            {version}
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">{meta.title}</h1>
          <LayerBadge layer={meta.layer}>{meta.layer}</LayerBadge>
        </div>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">{meta.subtitle}</p>
        {meta.coreAddition && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs dark:bg-zinc-800">
            {meta.coreAddition}
          </span>
        )}
        {meta.keyInsight && (
          <blockquote className="border-l-4 border-zinc-300 pl-4 text-sm italic text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
            {meta.keyInsight}
          </blockquote>
        )}
      </header>

      {/* Visualization placeholder */}
      <Card className="min-h-[400px] flex items-center justify-center">
        <p className="text-zinc-400">可视化内容加载中...</p>
      </Card>

      {/* Prev / Next navigation */}
      <nav className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-700">
        {prevVersion ? (
          <Link
            href={`/${locale}/${prevVersion}`}
            className="group flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <div>
              <div className="text-xs text-zinc-400">上一章</div>
              <div className="font-medium">
                {prevVersion} - {VERSION_META[prevVersion]?.title}
              </div>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {nextVersion ? (
          <Link
            href={`/${locale}/${nextVersion}`}
            className="group flex items-center gap-2 text-right text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <div>
              <div className="text-xs text-zinc-400">下一章</div>
              <div className="font-medium">
                {VERSION_META[nextVersion]?.title} - {nextVersion}
              </div>
            </div>
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: 创建 src/components/visualizations/index.tsx**

```tsx
// Visualization components will be added in Phase 4
export {};
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: create chapter pages and learn layout"
```

---

## Phase 4: 可视化动画组件

### Task 9: 创建 StepControls 共享组件

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\components\visualizations\shared\step-controls.tsx`

- [ ] **Step 1: 创建 step-controls.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepControls({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onReset,
  isPlaying,
  onToggleAutoPlay,
  stepTitle,
  stepDescription,
}: {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  isPlaying: boolean;
  onToggleAutoPlay: () => void;
  stepTitle: string;
  stepDescription: string;
}) {
  return (
    <div className="space-y-3">
      {/* Step info */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {stepTitle}
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {stepDescription}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <motion.div
            className="absolute left-0 top-0 h-full bg-blue-500"
            initial={false}
            animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <span className="min-w-[3rem] text-center font-mono text-xs text-zinc-400">
          {currentStep + 1}/{totalSteps}
        </span>

        <button
          onClick={onNext}
          disabled={currentStep === totalSteps - 1}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onToggleAutoPlay}
          className={cn(
            "rounded-md p-1.5",
            isPlaying
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          )}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add StepControls shared component"
```

---

### Task 10: s01 - Agent 循环可视化

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\components\visualizations\s01-agent-loop.tsx`

- [ ] **Step 1: 创建 s01-agent-loop.tsx**

参考 `D:\AI\test\learn-claude-code\web\src\components\visualizations\s01-agent-loop.tsx`，但内容改为 Claude Code 的 7 步循环（对应文档中的 query.ts 状态机）

核心内容：
- NODES: 用户输入 → API调用 → 检查stop_reason → 执行工具 → 追加结果 → 循环/结束
- 7个步骤对应 query.ts 中的各个阶段

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add s01 agent loop visualization"
```

---

### Task 11-17: 其他可视化组件

每个可视化组件都需要：
1. 定义 NODES / EDGES
2. 定义 ACTIVE_NODES_PER_STEP / ACTIVE_EDGES_PER_STEP
3. 定义 MESSAGES_PER_STEP
4. 定义 STEP_INFO
5. 使用 useSteppedVisualization hook
6. 使用 useSvgPalette 获取颜色

| Task | ID | 内容 |
|------|-----|------|
| Task 11 | s02 | Prompt 编排 + 四道压缩机制 |
| Task 12 | s03 | 工具系统 Pipeline |
| Task 13 | s04 | 多 Agent 调度网络 |
| Task 14 | s05 | 安全层三层防护 |
| Task 15 | s06 | Skill/Plugin/MCP 生态 |
| Task 16 | s07 | 上下文压缩机制 |
| Task 17 | s08 | 7条设计原则 |

---

## Phase 5: 国际化与完善

### Task 18: 国际化框架

**Files:**
- Create: `D:\AI\test\claude-code-inside\web\src\lib\i18n.tsx`
- Create: `D:\AI\test\claude-code-inside\web\src\i18n\messages\en.json`
- Create: `D:\AI\test\claude-code-inside\web\src\i18n\messages\zh.json`
- Create: `D:\AI\test\claude-code-inside\web\src\i18n\messages\ja.json`

### Task 19: Timeline 和 Layers 页面

### Task 20: 最终测试和调试

---

## 执行模式选择

这是一个大型项目，包含 20+ 个任务。建议使用 **Subagent-Driven Development** 模式：

- 每个 Phase 可以分配给一个独立的 subagent 并行执行
- Phase 1（项目初始化）需要先完成，作为其他 Phase 的基础
- Phase 4（8个可视化组件）可以并行分配给多个 subagent

**推荐执行顺序：**
1. 先并行完成 Phase 1-3（项目基础设施 + 布局 + 基础页面）
2. 再并行完成 Phase 4（8个可视化组件）
3. 最后完成 Phase 5（国际化 + 完善）
