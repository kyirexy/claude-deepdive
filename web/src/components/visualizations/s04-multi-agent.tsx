"use client";

import { motion } from "framer-motion";
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

const NODES: FlowNode[] = [
  { id: "main", label: "Main Agent", x: 240, y: 30, w: 120, h: 38, type: "rect" },
  { id: "explore", label: "Explore Agent", x: 100, y: 110, w: 120, h: 38, type: "rect", color: "emerald" },
  { id: "verify", label: "Verify Agent", x: 380, y: 110, w: 120, h: 38, type: "rect", color: "red" },
  { id: "dispatch", label: "AgentTool Dispatcher", x: 240, y: 200, w: 150, h: 38, type: "rect" },
  { id: "fork", label: "Fork Path?", x: 100, y: 290, w: 110, h: 38, type: "diamond", color: "amber" },
  { id: "runtime", label: "Subagent Runtime", x: 240, y: 290, w: 130, h: 38, type: "rect" },
  { id: "complete", label: "Task Complete", x: 380, y: 290, w: 120, h: 38, type: "rect" },
];

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

const EDGES: FlowEdge[] = [
  { from: "main", to: "explore", label: "只读探索" },
  { from: "main", to: "verify", label: "对抗验证" },
  { from: "explore", to: "dispatch" },
  { from: "verify", to: "dispatch" },
  { from: "dispatch", to: "fork", label: "判断类型" },
  { from: "fork", to: "runtime", label: "子智能体" },
  { from: "fork", to: "complete", label: "直接完成" },
  { from: "runtime", to: "complete" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  [],
  ["main"],
  ["explore", "verify"],
  ["dispatch"],
  ["fork"],
  ["runtime"],
  ["complete"],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  [],
  ["main->explore", "main->verify"],
  ["explore->dispatch", "verify->dispatch"],
  ["dispatch->fork"],
  ["fork->runtime"],
  ["runtime->complete"],
];

const STEP_INFO = [
  { title: "多智能体系统概述", desc: "Main Agent + Explore Agent + Verification Agent 三层架构，分工明确，职责分离。" },
  { title: "Main Agent", desc: "通用任务执行，负责任务分解、决策和结果整合。query.ts (1729 行) 是主循环。" },
  { title: "Explore 与 Verify", desc: "Explore 只读探索（Haiku 模型），Verify 对抗性验证。写代码的人不该验收代码。" },
  { title: "AgentTool Dispatcher", desc: "AgentTool.tsx (1397 行) 判断 fork/built-in/multi-agent/teammate/remote，处理权限过滤和 MCP 依赖。" },
  { title: "Fork Path 决策", desc: "fork 继承主线程 system prompt 和对话上下文，保持字节级一致以复用 prompt cache。" },
  { title: "Subagent Runtime", desc: "runAgent.ts (973 行) 完整生命周期：初始化 MCP、克隆文件状态、注册 hooks、执行 query、清理。" },
  { title: "任务完成", desc: "结果合并到 Main Agent，后台 agent 有独立 abort controller，可持续运行后通过 notification 回到主线程。" },
];

function getNode(id: string): FlowNode {
  return NODES.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);

  if (fromId === "main" && toId === "explore") {
    return `M ${from.x - from.w/2} ${from.y + from.h/2} L ${to.x} ${to.y - to.h/2}`;
  }
  if (fromId === "main" && toId === "verify") {
    return `M ${from.x + from.w/2} ${from.y + from.h/2} L ${to.x} ${to.y - to.h/2}`;
  }
  if (fromId === "dispatch" && toId === "fork") {
    return `M ${from.x - from.w/2} ${from.y + from.h/2} L ${to.x + to.w/2} ${to.y - to.h/2}`;
  }
  if (fromId === "fork" && toId === "runtime") {
    return `M ${from.x} ${from.y + from.h/2} L ${to.x} ${to.y - to.h/2}`;
  }
  if (fromId === "fork" && toId === "complete") {
    return `M ${from.x + from.w/2} ${from.y} L ${to.x - to.w/2} ${to.y}`;
  }

  const sx = from.x;
  const sy = from.y + from.h / 2;
  const ex = to.x;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function MultiAgent({ title }: { title?: string }) {
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
        {title || "多智能体系统"}
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Main + Explore + Verify Architecture
            </div>
            <svg
              viewBox="0 0 500 350"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 400, height: '480px' }}
            >
              <defs>
                <filter id="glow-blue">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.7" />
                </filter>
                <filter id="glow-emerald">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.7" />
                </filter>
                <filter id="glow-red">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.7" />
                </filter>
                <filter id="glow-amber">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.7" />
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
                      markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                      animate={{
                        stroke: isActive ? palette.activeEdgeStroke : palette.edgeStroke,
                        strokeWidth: isActive ? 2.5 : 1.5,
                      }}
                      transition={{ duration: 0.4 }}
                    />
                    {edge.label && (
                      <text
                        x={
                          edge.from === "main" && edge.to === "explore"
                            ? (getNode("main").x - getNode("main").w/2 + getNode("explore").x) / 2 - 10
                            : edge.from === "main" && edge.to === "verify"
                            ? (getNode("main").x + getNode("main").w/2 + getNode("verify").x) / 2 + 10
                            : (getNode(edge.from).x + getNode(edge.to).x) / 2
                        }
                        y={
                          edge.from === "main"
                            ? getNode("main").y + 55
                            : (getNode(edge.from).y + getNode(edge.from).h / 2 + getNode(edge.to).y - getNode(edge.to).h / 2) / 2 - 6
                        }
                        textAnchor="middle"
                        fontSize="9"
                        fill={isActive ? palette.activeEdgeStroke : "#9ca3af"}
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
                  if (node.color === "emerald") filterAttr = "url(#glow-emerald)";
                  else if (node.color === "red") filterAttr = "url(#glow-red)";
                  else if (node.color === "amber") filterAttr = "url(#glow-amber)";
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

              {/* Explore restriction badge */}
              {activeNodes.includes("explore") && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <rect x="40" y="75" width="55" height="16" rx="4" fill="#10b981" opacity="0.9" />
                  <text x="67" y="86" textAnchor="middle" fontSize="8" fill="white" fontWeight={700}>只读</text>
                  <text x="100" y="50" fontSize="7" fill="#10b981" fontFamily="monospace">Haiku 模型</text>
                </motion.g>
              )}

              {/* Verify adversarial badge */}
              {activeNodes.includes("verify") && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <rect x="430" y="75" width="55" height="16" rx="4" fill="#ef4444" opacity="0.9" />
                  <text x="457" y="86" textAnchor="middle" fontSize="8" fill="white" fontWeight={700}>对抗性</text>
                  <text x="380" y="50" fontSize="7" fill="#ef4444" fontFamily="monospace">try to break it</text>
                </motion.g>
              )}
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Agent 详情
            </div>
            <div className="space-y-2">
              {/* Explore Agent */}
              {currentStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Explore Agent
                  </div>
                  <div className="mt-1 space-y-0.5 text-[9px] text-emerald-500 dark:text-emerald-600">
                    <div>禁止: 创建/修改/删除文件, 重定向写文件</div>
                    <div>允许: Glob, Grep, FileRead, ls, git status</div>
                    <div>默认 Haiku 模型(更快更便宜)</div>
                  </div>
                </motion.div>
              )}

              {/* Verify Agent */}
              {currentStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-red-600 dark:text-red-400">
                    Verification Agent (130 行 prompt)
                  </div>
                  <div className="mt-1 space-y-0.5 text-[9px] text-red-500 dark:text-red-600">
                    <div>核心: "想办法搞坏它"</div>
                    <div>前端: 启动 dev server + 浏览器自动化</div>
                    <div>后端: curl 实测, 检查 stdout/stderr/exit</div>
                    <div>识别合理化倾向, 必须含实际命令和输出</div>
                  </div>
                </motion.div>
              )}

              {/* Dispatcher */}
              {currentStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                    AgentTool.tsx (1397 行)
                  </div>
                  <div className="mt-1 space-y-0.5 text-[9px] text-purple-500 dark:text-purple-600">
                    <div>判断: fork / built-in / teammate / remote</div>
                    <div>解析: description, prompt, subagent_type, model</div>
                    <div>处理: 权限过滤, MCP 依赖, worktree 隔离</div>
                  </div>
                </motion.div>
              )}

              {/* Fork path cache */}
              {currentStep >= 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Fork Cache 优化
                  </div>
                  <div className="mt-1 space-y-0.5 text-[9px] text-amber-500 dark:text-amber-600">
                    <div>继承主线程 system prompt + 对话上下文</div>
                    <div>保持字节级一致以复用 prompt cache</div>
                    <div>不应换模型, 会破坏 cache 前缀匹配</div>
                  </div>
                </motion.div>
              )}

              {/* Subagent Runtime */}
              {currentStep >= 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950"
                >
                  <div className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    runAgent.ts (973 行)
                  </div>
                  <div className="mt-1 space-y-0.5 text-[9px] text-blue-500 dark:text-blue-600">
                    <div>初始化 agent 专属 MCP servers</div>
                    <div>克隆 file state cache, 获取 context</div>
                    <div>注册 frontmatter hooks, 预加载 skills</div>
                    <div>调用 query() 进入主循环</div>
                    <div>清理: MCP 连接, hooks, shell tasks, todos</div>
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
