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

const NODES: FlowNode[] = [
  { id: "tool_request", label: "Tool Request", x: 250, y: 30, w: 140, h: 40, type: "rect" },
  { id: "layer1", label: "Speculative\nClassifier", x: 120, y: 120, w: 120, h: 48, type: "rect", color: "#10b981" },
  { id: "layer2", label: "Hook Policy\nLayer", x: 250, y: 120, w: 120, h: 48, type: "rect", color: "#f59e0b" },
  { id: "layer3", label: "Permission\nDecision", x: 380, y: 120, w: 120, h: 48, type: "rect", color: "#ef4444" },
  { id: "execute", label: "Execute / Block", x: 250, y: 220, w: 130, h: 40, type: "rect" },
  { id: "post", label: "PostHook\nProcessing", x: 250, y: 310, w: 120, h: 44, type: "rect" },
];

const EDGES = [
  { from: "tool_request", to: "layer1", label: "第一层" },
  { from: "tool_request", to: "layer2", label: "第二层" },
  { from: "tool_request", to: "layer3", label: "第三层" },
  { from: "layer1", to: "execute" },
  { from: "layer2", to: "execute" },
  { from: "layer3", to: "execute", label: "allow/deny" },
  { from: "execute", to: "post" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  [],
  ["tool_request"],
  ["layer1", "layer2", "layer3"],
  ["execute"],
  ["execute"],
  ["post"],
  [],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  ["tool_request->layer1", "tool_request->layer2", "tool_request->layer3"],
  ["layer1->execute", "layer2->execute", "layer3->execute"],
  ["layer3->execute"],
  ["execute->post"],
  [],
  [],
];

interface MessageBlock {
  role: string;
  detail: string;
  colorClass: string;
}

const MESSAGES_PER_STEP: (MessageBlock | null)[][] = [
  [],
  [{ role: "tool_request", detail: "工具请求进入安全管道", colorClass: "bg-blue-500 dark:bg-blue-600" }],
  [
    { role: "classifier", detail: "第一层: Speculative Classifier 风险分类", colorClass: "bg-emerald-500 dark:bg-emerald-600" },
    { role: "hook", detail: "第二层: Hook Policy Layer 策略调整", colorClass: "bg-amber-500 dark:bg-amber-600" },
    { role: "permission", detail: "第三层: Permission Decision 最终决策", colorClass: "bg-red-500 dark:bg-red-600" },
  ],
  [{ role: "execute", detail: "根据决策执行或拦截", colorClass: "bg-purple-500 dark:bg-purple-600" }],
  [{ role: "resolve", detail: "resolveHookPermissionDecision 逻辑生效", colorClass: "bg-cyan-500 dark:bg-cyan-600" }],
  [{ role: "posthook", detail: "PostHook 后置处理", colorClass: "bg-zinc-600 dark:bg-zinc-500" }],
  [{ role: "result", detail: "安全层处理完成", colorClass: "bg-blue-500 dark:bg-blue-600" }],
];

const STEP_INFO = [
  { title: "三层防护网概述", desc: "Claude Code 采用三层安全保护机制，互相配合但不互相绕过。" },
  { title: "工具请求入口", desc: "所有工具请求首先进入安全检查管道。" },
  { title: "三层保护同时生效", desc: "Speculative Classifier 并行预判 + Hook Policy 策略调整 + Permission Decision 最终决策。" },
  { title: "权限决策", desc: "综合三层检查结果，结合规则配置和用户交互做出最终允许/拒绝决策。" },
  { title: "Hook Allow 不能绕过 Settings Deny", desc: "resolveHookPermissionDecision 核心逻辑：Hook allow + settings deny = deny 生效。" },
  { title: "执行或拦截", desc: "根据权限决策执行工具或拦截请求。" },
  { title: "关键约束", desc: "任何一层都不能绕过另一层 — 这是安全设计的基本原则。" },
];

function getNode(id: string): FlowNode {
  return NODES.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);

  if (fromId === "tool_request") {
    const midY = from.y + from.h / 2;
    if (toId === "layer1") {
      return `M ${from.x} ${midY} L ${to.x + to.w / 2} ${to.y}`;
    }
    if (toId === "layer2") {
      return `M ${from.x + from.w / 2} ${from.y + from.h} L ${to.x} ${to.y}`;
    }
    if (toId === "layer3") {
      return `M ${from.x + from.w} ${midY} L ${to.x - to.w / 2} ${to.y}`;
    }
  }

  const sx = from.x;
  const sy = from.y + from.h / 2;
  const ex = to.x;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function SecurityLayer({ title }: { title?: string }) {
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
        {title || "安全层：三层防护网"}
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              3-Layer Security Protection Flow
            </div>
            <svg
              viewBox="0 0 500 370"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 400, height: '480px' }}
            >
              <defs>
                <filter id="glow-green">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.7" />
                </filter>
                <filter id="glow-amber">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.7" />
                </filter>
                <filter id="glow-red">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.7" />
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
                          edge.from === "tool_request"
                            ? (getNode("tool_request").x + getNode(edge.to).x) / 2
                            : (getNode(edge.from).x + getNode(edge.to).x) / 2
                        }
                        y={
                          edge.from === "tool_request"
                            ? getNode("tool_request").y + 60
                            : (getNode(edge.from).y + getNode(edge.from).h / 2 + getNode(edge.to).y - getNode(edge.to).h / 2) / 2 - 6
                        }
                        textAnchor="middle"
                        className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
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
                if (node.id === "layer1" && isActive) filterAttr = "url(#glow-green)";
                if (node.id === "layer2" && isActive) filterAttr = "url(#glow-amber)";
                if (node.id === "layer3" && isActive) filterAttr = "url(#glow-red)";
                if (node.id === "execute" && isActive) filterAttr = "url(#glow-red)";

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
                      y={node.y + (node.type === "diamond" ? 4 : 2)}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="monospace"
                      animate={{ fill: isActive ? palette.activeNodeText : palette.nodeText }}
                      transition={{ duration: 0.4 }}
                    >
                      {node.label.split("\n").map((line, i) => (
                        <tspan key={i} x={node.x} dy={i === 0 ? 0 : 12}>
                          {line}
                        </tspan>
                      ))}
                    </motion.text>
                  </g>
                );
              })}

              {currentStep >= 4 && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <rect x={100} y={345} width={300} height={22} rx={4} fill="#ef4444" opacity={0.9} />
                  <text x={250} y={360} textAnchor="middle" fontSize={10} fill="white" fontWeight={700}>
                    Hook allow 无法绕过 settings deny
                  </text>
                </motion.g>
              )}

              {activeNodes.includes("layer1") && (
                <motion.rect x={30} y={95} width={50} height={16} rx={4} fill="#10b981" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} />
              )}
              {activeNodes.includes("layer1") && (
                <motion.text x={55} y={106} textAnchor="middle" fontSize={8} fill="white" fontWeight={700} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  第一层
                </motion.text>
              )}

              {activeNodes.includes("layer2") && (
                <motion.rect x={200} y={95} width={50} height={16} rx={4} fill="#f59e0b" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} />
              )}
              {activeNodes.includes("layer2") && (
                <motion.text x={225} y={106} textAnchor="middle" fontSize={8} fill="white" fontWeight={700} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  第二层
                </motion.text>
              )}

              {activeNodes.includes("layer3") && (
                <motion.rect x={370} y={95} width={50} height={16} rx={4} fill="#ef4444" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} />
              )}
              {activeNodes.includes("layer3") && (
                <motion.text x={395} y={106} textAnchor="middle" fontSize={8} fill="white" fontWeight={700} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  第三层
                </motion.text>
              )}
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              resolveHookPermissionDecision Logic
            </div>
            <div className="min-h-[300px] space-y-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <AnimatePresence mode="popLayout">
                {visibleMessages.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-600"
                  >
                    [ 等待安全检查 ]
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
                    验证结果: {visibleMessages.length} 项检查
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
