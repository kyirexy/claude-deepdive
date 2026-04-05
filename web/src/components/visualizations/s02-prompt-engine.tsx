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
}

const NODES: FlowNode[] = [
  { id: "static", label: "Static Prompt", x: 120, y: 40, w: 130, h: 38, type: "rect" },
  { id: "boundary", label: "Dynamic Boundary", x: 300, y: 40, w: 140, h: 38, type: "rect" },
  { id: "snip", label: "Snip Compact", x: 80, y: 130, w: 110, h: 38, type: "rect" },
  { id: "micro", label: "Micro Compact", x: 200, y: 130, w: 110, h: 38, type: "rect" },
  { id: "context", label: "Context Collapse", x: 320, y: 130, w: 120, h: 38, type: "rect" },
  { id: "auto", label: "Auto Compact", x: 440, y: 130, w: 110, h: 38, type: "rect" },
  { id: "budget", label: "Token Budget", x: 260, y: 230, w: 110, h: 38, type: "diamond" },
  { id: "api", label: "API Call", x: 260, y: 320, w: 110, h: 38, type: "rect" },
  { id: "stream", label: "Streaming", x: 120, y: 390, w: 110, h: 38, type: "rect" },
  { id: "execute", label: "Tool Execution", x: 280, y: 390, w: 120, h: 38, type: "rect" },
];

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

const EDGES: FlowEdge[] = [
  { from: "static", to: "boundary", label: "Cache 前缀" },
  { from: "boundary", to: "snip" },
  { from: "boundary", to: "micro" },
  { from: "boundary", to: "context" },
  { from: "boundary", to: "auto" },
  { from: "context", to: "budget" },
  { from: "auto", to: "budget" },
  { from: "budget", to: "api" },
  { from: "api", to: "stream" },
  { from: "api", to: "execute" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  [],
  ["static", "boundary"],
  ["snip", "micro", "context", "auto"],
  ["budget"],
  ["api"],
  ["stream"],
  ["execute"],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  ["static->boundary"],
  ["boundary->snip", "boundary->micro", "boundary->context", "boundary->auto"],
  ["context->budget", "auto->budget"],
  ["budget->api"],
  ["api->stream"],
  ["api->execute"],
];

const STEP_INFO = [
  { title: "提示工程概述", desc: "Claude Code 在发送请求前对提示进行多级压缩和组装，7 个步骤构成精密流水线。" },
  { title: "SYSTEM_PROMPT_DYNAMIC_BOUNDARY", desc: "静态提示可缓存（前缀），动态提示按会话注入。Boundary 之前的内容字节级一致才能复用缓存。" },
  { title: "四层压缩管道", desc: "Snip 移除过长内容 → Micro 基于 tool_use_id 缓存做编辑 → Context 折叠不活跃区域 → Auto 全量压缩。" },
  { title: "Token Budget 检查", desc: "接近 token 阈值时注入 nudge message 让模型继续工作，避免模型自行停止。" },
  { title: "API 调用", desc: "最终提示组装完成，发送到 Claude API。streaming tool execution 允许边收边执行工具。" },
  { title: "流式响应", desc: "模型输出是流式的，第一个 tool_use block 完成时后续可能还在生成。" },
  { title: "工具执行与迭代", desc: "工具结果追加到 messages[]，回到循环开头。query.ts 是 1729 行的 while(true) 状态机。" },
];

function getNode(id: string): FlowNode {
  return NODES.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);

  if (fromId === "boundary" && toId === "snip") {
    return `M ${from.x - from.w/2} ${from.y + from.h/2} L ${to.x + to.w/2} ${to.y - to.h/2}`;
  }
  if (fromId === "boundary" && toId === "micro") {
    return `M ${from.x} ${from.y + from.h/2} L ${to.x} ${to.y - to.h/2}`;
  }
  if (fromId === "boundary" && toId === "context") {
    return `M ${from.x} ${from.y + from.h/2} L ${to.x} ${to.y - to.h/2}`;
  }
  if (fromId === "boundary" && toId === "auto") {
    return `M ${from.x + from.w/2} ${from.y + from.h/2} L ${to.x - to.w/2} ${to.y - to.h/2}`;
  }
  if (fromId === "context" && toId === "budget") {
    return `M ${from.x + from.w/2} ${from.y} L ${to.x - to.w/2} ${to.y}`;
  }
  if (fromId === "auto" && toId === "budget") {
    return `M ${from.x + from.w/2} ${from.y} L ${to.x + to.w/2} ${to.y}`;
  }

  const sx = from.x;
  const sy = from.y + from.h / 2;
  const ex = to.x;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function PromptEngine({ title }: { title?: string }) {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: 7, autoPlayInterval: 2500 });

  const palette = useSvgPalette();
  const activeNodes = ACTIVE_NODES_PER_STEP[currentStep];
  const activeEdges = ACTIVE_EDGES_PER_STEP[currentStep];

  const stepInfo = STEP_INFO[currentStep];

  return (
    <section className="min-h-[680px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title || "提示组装与压缩"}
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              4-Tier Compression Pipeline — prompts.ts (914 行)
            </div>
            <svg
              viewBox="0 0 520 440"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 450, height: '500px' }}
            >
              <defs>
                <filter id="glow-amber">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.7" />
                </filter>
                <filter id="glow-blue">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.7" />
                </filter>
                <filter id="glow-purple">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a855f7" floodOpacity="0.7" />
                </filter>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={palette.arrowFill} />
                </marker>
                <marker
                  id="arrowhead-active"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={palette.activeEdgeStroke} />
                </marker>
              </defs>

              {/* SYSTEM_PROMPT_DYNAMIC_BOUNDARY label */}
              {currentStep >= 1 && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <line x1="235" y1="0" x2="235" y2="440" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,4" />
                  <text x="240" y="20" fill="#f59e0b" fontSize="9" fontFamily="monospace">BOUNDARY</text>
                </motion.g>
              )}

              {EDGES.map((edge) => {
                const key = `${edge.from}->${edge.to}`;
                const isActive = activeEdges.includes(key);
                const d = edgePath(edge.from, edge.to);
                const fromNode = getNode(edge.from);
                const toNode = getNode(edge.to);

                return (
                  <g key={key}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={isActive ? palette.activeEdgeStroke : palette.edgeStroke}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                      animate={{
                        stroke: isActive ? palette.activeEdgeStroke : palette.edgeStroke,
                        strokeWidth: isActive ? 2.5 : 1.5,
                      }}
                      transition={{ duration: 0.4 }}
                    />
                    {edge.label && isActive && (
                      <text
                        x={(fromNode.x + toNode.x) / 2}
                        y={(fromNode.y + fromNode.h / 2 + toNode.y - toNode.h / 2) / 2 - 6}
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {NODES.map((node) => {
                const isActive = activeNodes.includes(node.id);
                let filterAttr = "none";
                if (isActive) {
                  if (node.id === "static" || node.id === "boundary") filterAttr = "url(#glow-amber)";
                  else if (node.id === "budget") filterAttr = "url(#glow-purple)";
                  else filterAttr = "url(#glow-blue)";
                }

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
                        fontSize="10"
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
                      y={node.y + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={600}
                      fontFamily="monospace"
                      animate={{ fill: isActive ? palette.activeNodeText : palette.nodeText }}
                      transition={{ duration: 0.4 }}
                    >
                      {node.label}
                    </motion.text>
                  </g>
                );
              })}

              {/* Compression tier labels */}
              {currentStep >= 2 && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <text x="70" y="118" fill="#f59e0b" fontSize="8" fontFamily="monospace">Tier 1</text>
                  <text x="190" y="118" fill="#f59e0b" fontSize="8" fontFamily="monospace">Tier 2</text>
                  <text x="310" y="118" fill="#f59e0b" fontSize="8" fontFamily="monospace">Tier 3</text>
                  <text x="430" y="118" fill="#f59e0b" fontSize="8" fontFamily="monospace">Tier 4</text>
                </motion.g>
              )}
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              提示组成结构
            </div>
            <div className="space-y-2">
              {currentStep >= 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    静态部分 (可缓存)
                  </div>
                  <div className="mt-1 text-[9px] text-amber-500 dark:text-amber-600">
                    身份定位 · 系统规范 · 行为规范 · 风险规范 · 工具语法 · 语气风格
                  </div>
                </motion.div>
              )}

              {currentStep >= 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    动态部分 (按会话注入)
                  </div>
                  <div className="mt-1 text-[9px] text-blue-500 dark:text-blue-600">
                    Session guidance · Memory · 环境信息 · 语言偏好 · MCP instructions
                  </div>
                </motion.div>
              )}

              {currentStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    <span className="font-mono text-[9px] font-semibold text-amber-500">SNIP</span>
                    <span className="text-[9px] text-zinc-500">移除过长历史消息</span>
                  </div>
                  <div className="flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    <span className="font-mono text-[9px] font-semibold text-orange-500">MICRO</span>
                    <span className="text-[9px] text-zinc-500">基于 tool_use_id 缓存编辑</span>
                  </div>
                  <div className="flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    <span className="font-mono text-[9px] font-semibold text-red-500">CONTEXT</span>
                    <span className="text-[9px] text-zinc-500">折叠不活跃上下文区域</span>
                  </div>
                  <div className="flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    <span className="font-mono text-[9px] font-semibold text-purple-500">AUTO</span>
                    <span className="text-[9px] text-zinc-500">接近阈值时全量压缩</span>
                  </div>
                </motion.div>
              )}

              {currentStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 dark:border-purple-800 dark:bg-purple-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                    Token Budget
                  </div>
                  <div className="mt-1 text-[9px] text-purple-500 dark:text-purple-600">
                    接近目标时注入 nudge message，让模型继续工作而非自行停止
                  </div>
                </motion.div>
              )}

              {currentStep >= 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    API 调用
                  </div>
                  <div className="mt-1 text-[9px] text-emerald-500 dark:text-emerald-600">
                    messages + system_prompt + tools → Claude API
                  </div>
                </motion.div>
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
