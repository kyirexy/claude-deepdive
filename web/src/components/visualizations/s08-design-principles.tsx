"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";
import { useSvgPalette } from "@/hooks/useDarkMode";

interface Principle {
  title: string;
  subtitle: string;
  description: string;
  codeRef: string;
  color: string;
  bgColor: string;
}

const PRINCIPLES: Principle[] = [
  {
    title: "不信任模型的自觉性",
    subtitle: "Don't Trust Model's Self-Awareness",
    description: "好行为要写成制度，不依赖模型临场发挥。你希望模型先读代码再改代码，就写进 prompt。",
    codeRef: "getSimpleDoingTasksSection()",
    color: "#3b82f6",
    bgColor: "bg-blue-500",
  },
  {
    title: "把角色拆开",
    subtitle: "Split Roles",
    description: "做事者与验收者分离，避免验证偏见。实现者可能觉得自己写得没问题，但验证者没有这个偏见。",
    codeRef: "Verification Agent",
    color: "#10b981",
    bgColor: "bg-emerald-500",
  },
  {
    title: "工具调用要有治理",
    subtitle: "Tool Governance",
    description: "输入校验、权限检查、风险预判、失败处理。14步 Pipeline 决定了系统在异常情况下的表现。",
    codeRef: "toolExecution.ts pipeline",
    color: "#8b5cf6",
    bgColor: "bg-purple-500",
  },
  {
    title: "上下文是预算",
    subtitle: "Context is Budget",
    description: "每个 Token 都有成本，能缓存的缓存，能按需加载的不要一开始就塞进去，能压缩的压缩。",
    codeRef: "SYSTEM_PROMPT_DYNAMIC_BOUNDARY",
    color: "#f59e0b",
    bgColor: "bg-amber-500",
  },
  {
    title: "安全层要互不绕过",
    subtitle: "Security Layers Don't Bypass",
    description: "三层防护可以互相配合，但任何一层不能绕过另一层。Hook allow 不能绕过 settings deny。",
    codeRef: "resolveHookPermissionDecision()",
    color: "#ef4444",
    bgColor: "bg-red-500",
  },
  {
    title: "生态的关键是模型感知",
    subtitle: "Ecosystem = Model Perception",
    description: "扩展机制的最后一步是让模型看到自己的能力清单。MCP instructions、skill lists 让模型知道有什么能力。",
    codeRef: "MCP instructions injection",
    color: "#ec4899",
    bgColor: "bg-pink-500",
  },
  {
    title: "产品化在于处理第二天",
    subtitle: "Productization = Day 2",
    description: "第一天跑起来不难。难的是任务中断怎么续、脏状态怎么清、进程泄漏怎么办、session 怎么恢复。",
    codeRef: "runAgent.ts cleanup chain",
    color: "#14b8a6",
    bgColor: "bg-teal-500",
  },
];

const FLOW_NODES = [
  { id: "prompt", label: "Prompt\nRules", x: 100, y: 80, w: 80, h: 36 },
  { id: "roles", label: "Split\nRoles", x: 200, y: 80, w: 80, h: 36 },
  { id: "governance", label: "14-Step\nPipeline", x: 300, y: 80, w: 80, h: 36 },
  { id: "cache", label: "Cache +\nCompress", x: 400, y: 80, w: 80, h: 36 },
  { id: "security", label: "Security\nLayers", x: 100, y: 180, w: 80, h: 36 },
  { id: "mcp", label: "MCP\n感知", x: 200, y: 180, w: 80, h: 36 },
  { id: "lifecycle", label: "Life\nCycle", x: 300, y: 180, w: 80, h: 36 },
  { id: "result", label: "7 Principles\nfrom Source", x: 250, y: 280, w: 100, h: 40 },
];

export default function S08DesignPrinciplesVisualization() {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: 7, autoPlayInterval: 3000 });

  const palette = useSvgPalette();
  const currentPrinciple = PRINCIPLES[currentStep];

  const activeNodeIndex = currentStep < 4 ? currentStep : currentStep < 6 ? currentStep : 7;
  const activeNodes = FLOW_NODES.slice(0, activeNodeIndex + 1).map((n) => n.id);

  const stepInfo = {
    title: `原则 ${currentStep + 1}: ${currentPrinciple.title}`,
    desc: currentPrinciple.description,
  };

  return (
    <section className="min-h-[720px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        从源码提炼的 7 条设计原则
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap gap-2">
          {PRINCIPLES.map((p, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            return (
              <motion.button
                key={p.title}
                onClick={() => {
                  reset();
                  for (let j = 0; j < i; j++) next();
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive ? p.color : `${p.color}20`,
                  color: isActive ? "white" : p.color,
                  opacity: isPast ? 0.5 : 1,
                }}
              >
                {i + 1}. {p.title.split("：")[0]}
              </motion.button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Design Principles Map
            </div>
            <svg
              viewBox="0 0 500 340"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 400, height: '480px' }}
            >
              <defs>
                <filter id="glow-principle">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#8b5cf6" floodOpacity="0.7" />
                </filter>
              </defs>

              {[0, 1, 2, 3].map((row) => {
                const cols = row < 2 ? 4 : 3;
                const y = row < 2 ? 80 : 180;
                const startX = row === 2 ? 150 : 100;
                return [0, 1, 2, 3].slice(0, cols).map((col) => {
                  const node = FLOW_NODES[row * 4 + col];
                  if (!node) return null;
                  const isActive = activeNodes.includes(node.id);
                  const principleIndex = row * 4 + col;
                  const principle = PRINCIPLES[principleIndex];
                  const isPrincipleActive = currentStep === principleIndex;

                  return (
                    <g key={node.id}>
                      <motion.rect
                        x={node.x - node.w / 2}
                        y={node.y - node.h / 2}
                        width={node.w}
                        height={node.h}
                        rx={8}
                        fill={isPrincipleActive ? principle?.color : (isActive ? palette.activeNodeFill : palette.nodeFill)}
                        stroke={isPrincipleActive ? principle?.color : (isActive ? palette.activeNodeStroke : palette.nodeStroke)}
                        strokeWidth={isPrincipleActive ? 2.5 : 1.5}
                        filter={isPrincipleActive ? "url(#glow-principle)" : "none"}
                        animate={{
                          fill: isPrincipleActive ? principle?.color : (isActive ? palette.activeNodeFill : palette.nodeFill),
                          stroke: isPrincipleActive ? principle?.color : (isActive ? palette.activeNodeStroke : palette.nodeStroke),
                        }}
                        transition={{ duration: 0.4 }}
                      />
                      <motion.text
                        x={node.x}
                        y={node.y + 2}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={600}
                        fontFamily="monospace"
                        animate={{
                          fill: isPrincipleActive ? "white" : (isActive ? palette.activeNodeText : palette.nodeText),
                        }}
                        transition={{ duration: 0.4 }}
                      >
                        {node.label.split("\n").map((line, i) => (
                          <tspan key={i} x={node.x} dy={i === 0 ? 0 : 11}>
                            {line}
                          </tspan>
                        ))}
                      </motion.text>
                    </g>
                  );
                });
              })}

              <motion.line
                x1={250}
                y1={220}
                x2={250}
                y2={260}
                stroke={palette.activeEdgeStroke}
                strokeWidth={2}
                markerEnd="url(#arrowhead-active)"
                initial={{ opacity: 0 }}
                animate={{ opacity: currentStep >= 0 ? 1 : 0 }}
              />
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: `${currentPrinciple.color}10`,
                  borderLeft: `4px solid ${currentPrinciple.color}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${currentPrinciple.bgColor} text-2xl font-bold text-white`}
                  >
                    {currentStep + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {currentPrinciple.title}
                      </h3>
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-500">{currentPrinciple.subtitle}</div>
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {currentPrinciple.description}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 dark:bg-zinc-800">
                      <span className="text-xs text-zinc-400">源码:</span>
                      <code
                        className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-mono dark:bg-zinc-700"
                        style={{ color: currentPrinciple.color }}
                      >
                        {currentPrinciple.codeRef}
                      </code>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="mb-2 font-mono text-xs text-zinc-400">原则关联</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  行为约束 → Prompt 规则
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  职责分离 → 验证者独立
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  工具治理 → Pipeline
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  上下文 → Cache+Compress
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  安全层 → 不互相绕过
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-500" />
                  生态 → 模型感知
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  产品化 → Day 2 处理
                </div>
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
