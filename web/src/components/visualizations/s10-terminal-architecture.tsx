"use client";

import { motion } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

const STAGES = [
  {
    id: "cli",
    title: "CLI Fast-Path",
    subtitle: "CLI 入口快速分发",
    desc: "特殊标志走快速路径，零模块加载。--version / -v 响应最快。",
    x: 50,
    y: 40,
    color: "#3B82F6",
  },
  {
    id: "init",
    title: "main.tsx 初始化",
    subtitle: "命令分发与初始化",
    desc: "238KB 主模块，三阶段初始化：早期初始化 → 命令分发 → TUI 渲染",
    x: 50,
    y: 140,
    color: "#10B981",
  },
  {
    id: "command",
    title: "Commander 命令",
    subtitle: "子命令注册与执行",
    desc: "preAction hook 确保关键初始化完成，再执行具体命令。",
    x: 50,
    y: 240,
    color: "#8B5CF6",
  },
  {
    id: "tui",
    title: "TUI 渲染",
    subtitle: "Ink 终端界面",
    desc: "ink() 函数创建 React 渲染器，screen 管理不同界面状态。",
    x: 50,
    y: 340,
    color: "#F59E0B",
  },
];

const CONNECTORS = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
];

const FAST_PATHS = [
  { flag: "--version / -v", action: "输出版本，退出" },
  { flag: "--dump-system-prompt", action: "输出 system prompt" },
  { flag: "--claude-in-chrome-mcp", action: "Chrome MCP 模式" },
  { flag: "daemon", action: "守护进程模式" },
  { flag: "ps | logs | attach", action: "Session 管理" },
];

export default function S10TerminalArchitectureVisualization() {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: 4, autoPlayInterval: 3500 });

  const stepInfo = {
    title: STAGES[currentStep].title,
    desc: STAGES[currentStep].desc,
  };

  return (
    <section className="min-h-[600px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        终端架构：CLI / main.tsx / TUI
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[55%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Initialization Flow — 启动流程
            </div>
            <div className="relative" style={{ height: 420 }}>
              {STAGES.map((stage, idx) => {
                const isActive = currentStep === idx;
                const isPast = currentStep > idx;
                return (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.5 : 0.25,
                      x: 0,
                      scale: isActive ? 1.02 : 1,
                    }}
                    transition={{ duration: 0.4 }}
                    className="absolute left-0 right-0 rounded-lg border-2 p-4"
                    style={{
                      top: stage.y,
                      borderColor: isActive ? stage.color : isPast ? stage.color : "#e5e7eb",
                      backgroundColor: isActive ? `${stage.color}15` : isPast ? "#f9fafb" : "#fafafa",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: stage.color }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: isActive ? stage.color : undefined }}>
                          {stage.title}
                        </div>
                        <div className="text-xs text-zinc-500">{stage.subtitle}</div>
                      </div>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        {stage.desc}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}

              {CONNECTORS.map((conn) => {
                const fromStage = STAGES[conn.from];
                const toStage = STAGES[conn.to];
                const isActive = currentStep > conn.from;
                return (
                  <motion.div
                    key={`${conn.from}-${conn.to}`}
                    className="absolute left-6 w-0.5"
                    style={{
                      top: fromStage.y + 70,
                      height: toStage.y - fromStage.y - 70,
                      backgroundColor: isActive ? STAGES[conn.from].color : "#e5e7eb",
                    }}
                    animate={{ backgroundColor: isActive ? STAGES[conn.from].color : "#e5e7eb" }}
                  />
                );
              })}
            </div>
          </div>

          <div className="w-full lg:w-[45%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Fast-Path Flags — 快速通道
            </div>
            <div className="space-y-2">
              {FAST_PATHS.map((fp, idx) => {
                const isHighlighted = currentStep === 0;
                return (
                  <motion.div
                    key={fp.flag}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHighlighted ? 1 : 0.4 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <code className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-mono dark:bg-zinc-700">
                      {fp.flag}
                    </code>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{fp.action}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <div className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                为什么 Fast-Path？
              </div>
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                <code className="font-mono">-v</code> 是最常用标志。如果每次都加载 238KB 的 main.tsx，响应会慢 500ms+。
              </div>
            </div>
          </div>
        </div>
      </div>

      <StepControls
        currentStep={currentStep}
        totalSteps={totalSteps}
        onPrev={prev}
        onNext={next}
        onReset={reset}
        isPlaying={isPlaying}
        onToggleAutoPlay={toggleAutoPlay}
        stepTitle={stepInfo.title}
        stepDescription={stepInfo.desc}
      />
    </section>
  );
}
