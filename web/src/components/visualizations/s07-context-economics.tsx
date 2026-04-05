"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";
import { useSvgPalette } from "@/hooks/useDarkMode";

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: "rect" | "diamond";
  color?: string;
}

const NODE_POSITIONS: FlowNode[] = [
  { id: "budget", label: "Token Budget\nCheck", x: 250, y: 30, w: 110, h: 44, type: "rect" },
  { id: "snip", label: "Snip\nCompact", x: 100, y: 120, w: 90, h: 44, type: "rect", color: "#22c55e" },
  { id: "micro", label: "Micro\nCompact", x: 220, y: 120, w: 90, h: 44, type: "rect", color: "#10b981" },
  { id: "collapse", label: "Context\nCollapse", x: 340, y: 120, w: 100, h: 44, type: "rect", color: "#f59e0b" },
  { id: "auto", label: "Auto\nCompact", x: 440, y: 120, w: 90, h: 44, type: "rect", color: "#ef4444" },
  { id: "api_error", label: "API 413\nError", x: 140, y: 230, w: 90, h: 44, type: "diamond", color: "#dc2626" },
  { id: "reactive", label: "Reactive\nCompact", x: 300, y: 230, w: 100, h: 44, type: "rect", color: "#7c3aed" },
  { id: "retry", label: "Retry\nRequest", x: 300, y: 320, w: 90, h: 40, type: "rect" },
];

const EDGES = [
  { from: "budget", to: "snip" },
  { from: "budget", to: "micro" },
  { from: "budget", to: "collapse" },
  { from: "budget", to: "auto" },
  { from: "auto", to: "api_error", label: "超限" },
  { from: "api_error", to: "reactive", label: "紧急压缩" },
  { from: "reactive", to: "retry" },
  { from: "snip", to: "retry" },
  { from: "micro", to: "retry" },
  { from: "collapse", to: "retry" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  [],
  ["budget"],
  ["snip", "micro", "collapse", "auto"],
  ["api_error"],
  ["reactive"],
  ["retry"],
  [],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  ["budget->snip", "budget->micro", "budget->collapse", "budget->auto"],
  ["auto->api_error"],
  ["api_error->reactive"],
  ["reactive->retry"],
  ["snip->retry", "micro->retry", "collapse->retry"],
  [],
];

interface MessageBlock {
  role: string;
  detail: string;
  colorClass: string;
}

const COMPRESSION_TIERS = [
  { label: "Snip", sublabel: "裁剪过长内容", color: "#22c55e", width: "20%" },
  { label: "Micro", sublabel: "基于tool_use_id缓存", color: "#10b981", width: "30%" },
  { label: "Collapse", sublabel: "折叠不活跃区域", color: "#f59e0b", width: "35%" },
  { label: "Auto", sublabel: "全量压缩", color: "#ef4444", width: "15%" },
];

const MESSAGES_PER_STEP: (MessageBlock | null)[][] = [
  [],
  [{ role: "budget_check", detail: "Token 预算检查：是否接近上限", colorClass: "bg-blue-500 dark:bg-blue-600" }],
  [
    { role: "snip", detail: "Snip Compact: 裁剪过长历史消息", colorClass: "bg-green-500 dark:bg-green-600" },
    { role: "micro", detail: "Micro Compact: 基于 tool_use_id 细粒度压缩", colorClass: "bg-emerald-500 dark:bg-emerald-600" },
    { role: "collapse", detail: "Context Collapse: 折叠不活跃上下文为摘要", colorClass: "bg-amber-500 dark:bg-amber-600" },
    { role: "auto", detail: "Auto Compact: 接近硬限制时全量压缩", colorClass: "bg-red-500 dark:bg-red-600" },
  ],
  [{ role: "api_error", detail: "收到 API 413 (prompt too long)", colorClass: "bg-rose-600 dark:bg-rose-700" }],
  [{ role: "reactive", detail: "Reactive Compact: 紧急压缩 (防循环设计)", colorClass: "bg-violet-500 dark:bg-violet-600" }],
  [{ role: "retry", detail: "压缩后重试请求", colorClass: "bg-purple-500 dark:bg-purple-600" }],
  [{ role: "result", detail: "Token 预算管理完成", colorClass: "bg-blue-500 dark:bg-blue-600" }],
];

const STEP_INFO = [
  { title: "上下文经济学", desc: "每个 Token 都有成本，能缓存的缓存，能压缩的压缩。" },
  { title: "预算检查", desc: "检查当前上下文是否接近 Token 上限，决定是否需要压缩。" },
  { title: "四道压缩机制", desc: "Snip → Micro → Context Collapse → Auto，按优先级依次执行。" },
  { title: "API 413 兜底", desc: "如果压缩后仍超限，API 返回 413 错误。" },
  { title: "响应式压缩", desc: "Reactive Compact 在收到 413 后立刻触发紧急压缩。" },
  { title: "重试请求", desc: "压缩后重试，每个 turn 只尝试一次 reactive compact。" },
  { title: "按需注入", desc: "Skill 和 MCP instructions 按需注入，不一开始就塞进去。" },
];

function getNode(id: string): FlowNode {
  return NODE_POSITIONS.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);

  if (fromId === "budget") {
    const midX = from.x;
    const midY = from.y + from.h / 2;
    if (toId === "snip") return `M ${midX - 30} ${midY} L ${to.x + to.w / 2} ${to.y}`;
    if (toId === "micro") return `M ${midX} ${midY} L ${to.x} ${to.y}`;
    if (toId === "collapse") return `M ${midX} ${midY} L ${to.x} ${to.y}`;
    if (toId === "auto") return `M ${midX + 30} ${midY} L ${to.x - to.w / 2} ${to.y}`;
  }

  const sx = from.x;
  const sy = from.y + from.h / 2;
  const ex = to.x;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function S07ContextEconomicsVisualization() {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: 7, autoPlayInterval: 2800 });

  const palette = useSvgPalette();
  const activeNodes = ACTIVE_NODES_PER_STEP[currentStep];
  const activeEdges = ACTIVE_EDGES_PER_STEP[currentStep];

  const visibleMessages: MessageBlock[] = [];
  for (let s = 0; s <= currentStep; s++) {
    for (const msg of MESSAGES_PER_STEP[s]) {
      if (msg) visibleMessages.push(msg);
    }
  }

  const stepInfo = STEP_INFO[currentStep];

  return (
    <section className="min-h-[700px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        上下文经济学：Token 就是预算
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              4-Tier Compression Pipeline
            </div>
            <svg
              viewBox="0 0 540 380"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 420, height: '500px' }}
            >
              <defs>
                <filter id="glow-ctx">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.6" />
                </filter>
                <marker
                  id="arrowhead-ctx"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={palette.arrowFill} />
                </marker>
                <marker
                  id="arrowhead-ctx-active"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={palette.activeEdgeStroke} />
                </marker>
              </defs>

              {EDGES.map((edge) => {
                const key = `${edge.from}->${edge.to}`;
                const isActive = activeEdges.includes(key);
                const d = edgePath(edge.from, edge.to);

                return (
                  <g key={key}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={isActive ? palette.activeEdgeStroke : palette.edgeStroke}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      markerEnd={isActive ? "url(#arrowhead-ctx-active)" : "url(#arrowhead-ctx)"}
                      animate={{
                        stroke: isActive ? palette.activeEdgeStroke : palette.edgeStroke,
                        strokeWidth: isActive ? 2.5 : 1.5,
                      }}
                      transition={{ duration: 0.4 }}
                    />
                    {edge.label && (
                      <text
                        x={(getNode(edge.from).x + getNode(edge.to).x) / 2}
                        y={(getNode(edge.from).y + getNode(edge.from).h / 2 + getNode(edge.to).y - getNode(edge.to).h / 2) / 2 - 4}
                        textAnchor="middle"
                        className="fill-zinc-400 text-[8px] dark:fill-zinc-500"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {NODE_POSITIONS.map((node) => {
                const isActive = activeNodes.includes(node.id);
                const filterAttr = isActive ? "url(#glow-ctx)" : "none";

                if (node.type === "diamond") {
                  const cx = node.x;
                  const cy = node.y;
                  const hw = node.w / 2;
                  const hh = node.h / 2;
                  const points = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
                  return (
                    <g key={node.id}>
                      <motion.polygon
                        points={points}
                        fill={isActive ? palette.activeNodeFill : palette.nodeFill}
                        stroke={isActive ? palette.activeNodeStroke : palette.nodeStroke}
                        strokeWidth={1.5}
                        filter={filterAttr}
                        animate={{
                          fill: isActive ? palette.activeNodeFill : palette.nodeFill,
                          stroke: isActive ? palette.activeNodeStroke : palette.nodeStroke,
                        }}
                        transition={{ duration: 0.4 }}
                      />
                      <motion.text
                        x={cx}
                        y={cy + 4}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={600}
                        fontFamily="monospace"
                        animate={{ fill: isActive ? palette.activeNodeText : palette.nodeText }}
                        transition={{ duration: 0.4 }}
                      >
                        {node.label}
                      </motion.text>
                    </g>
                  );
                }

                return (
                  <g key={node.id}>
                    <motion.rect
                      x={node.x - node.w / 2}
                      y={node.y - node.h / 2}
                      width={node.w}
                      height={node.h}
                      rx={8}
                      fill={isActive ? palette.activeNodeFill : palette.nodeFill}
                      stroke={isActive ? palette.activeNodeStroke : palette.nodeStroke}
                      strokeWidth={1.5}
                      filter={filterAttr}
                      animate={{
                        fill: isActive ? palette.activeNodeFill : palette.nodeFill,
                        stroke: isActive ? palette.activeNodeStroke : palette.nodeStroke,
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
                      animate={{ fill: isActive ? palette.activeNodeText : palette.nodeText }}
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
              })}

              {currentStep >= 2 && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <rect x={60} y={185} width={420} height={24} rx={4} fill="#f59e0b" opacity={0.15} />
                  <text x={270} y={201} textAnchor="middle" fontSize={10} fill="#f59e0b" fontWeight={600}>
                    四道压缩机制 (优先级: Snip → Micro → Collapse → Auto)
                  </text>
                </motion.g>
              )}
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              4-Tier Compression Tiers
            </div>
            <div className="mb-3 flex h-10 items-center gap-1 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700">
              {COMPRESSION_TIERS.map((tier, i) => (
                <motion.div
                  key={tier.label}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: tier.width, opacity: 1 }}
                  transition={{ delay: i * 0.15, duration: 0.4 }}
                  className="flex h-full flex-col items-center justify-center px-1"
                  style={{ backgroundColor: tier.color }}
                >
                  <span className="text-[9px] font-semibold text-white">{tier.label}</span>
                </motion.div>
              ))}
            </div>

            <div className="min-h-[260px] space-y-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <AnimatePresence mode="popLayout">
                {visibleMessages.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-600"
                  >
                    [ 等待上下文压缩 ]
                  </motion.div>
                )}
                {visibleMessages.map((msg, i) => (
                  <motion.div
                    key={`${msg.role}-${msg.detail}-${i}`}
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.35, type: "spring", bounce: 0.3 }}
                    className={`rounded-md px-3 py-2 ${msg.colorClass}`}
                  >
                    <div className="font-mono text-[11px] font-semibold text-white">
                      {msg.role}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/80">
                      {msg.detail}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {visibleMessages.length > 0 && (
                <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                  <span className="font-mono text-[10px] text-zinc-400">
                    压缩阶段: {visibleMessages.length}
                  </span>
                </div>
              )}
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
