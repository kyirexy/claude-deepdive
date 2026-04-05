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
  type: "rect" | "diamond" | "circle";
}

const NODES: FlowNode[] = [
  { id: "mcp_server", label: "MCP Server\nConnected", x: 80, y: 60, w: 100, h: 44, type: "rect" },
  { id: "skill_pkg", label: "Skill Package\n(markdown)", x: 220, y: 60, w: 100, h: 44, type: "rect" },
  { id: "plugin_ext", label: "Plugin\nExtensions", x: 360, y: 60, w: 100, h: 44, type: "rect" },
  { id: "mcp_tools", label: "MCP Tools\n注册", x: 80, y: 160, w: 90, h: 40, type: "circle" },
  { id: "mcp_instr", label: "MCP\nInstructions", x: 220, y: 160, w: 100, h: 40, type: "rect" },
  { id: "skill_discovery", label: "Skill\nDiscovery", x: 360, y: 160, w: 90, h: 40, type: "circle" },
  { id: "prompt_boundary", label: "SYSTEM_\nPROMPT_\nDYNAMIC_\nBOUNDARY", x: 220, y: 250, w: 100, h: 50, type: "rect" },
  { id: "model_perceive", label: "Model\nPerceives", x: 220, y: 350, w: 100, h: 44, type: "rect" },
];

const EDGES = [
  { from: "mcp_server", to: "mcp_tools", label: "工具" },
  { from: "mcp_server", to: "mcp_instr", label: "指令" },
  { from: "skill_pkg", to: "skill_discovery" },
  { from: "plugin_ext", to: "mcp_tools" },
  { from: "mcp_tools", to: "prompt_boundary" },
  { from: "mcp_instr", to: "prompt_boundary" },
  { from: "skill_discovery", to: "prompt_boundary" },
  { from: "prompt_boundary", to: "model_perceive" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  [],
  ["mcp_server"],
  ["skill_pkg", "plugin_ext"],
  ["mcp_tools", "mcp_instr", "skill_discovery"],
  ["prompt_boundary"],
  ["model_perceive"],
  [],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  ["mcp_server->mcp_tools", "mcp_server->mcp_instr"],
  ["skill_pkg->skill_discovery", "plugin_ext->mcp_tools"],
  ["mcp_tools->prompt_boundary", "mcp_instr->prompt_boundary", "skill_discovery->prompt_boundary"],
  ["prompt_boundary->model_perceive"],
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
  [{ role: "mcp_connect", detail: "MCP Server 建立连接", colorClass: "bg-blue-500 dark:bg-blue-600" }],
  [
    { role: "skill", detail: "Skill: 带 frontmatter 元数据的 workflow package", colorClass: "bg-emerald-500 dark:bg-emerald-600" },
    { role: "plugin", detail: "Plugin: hooks、output styles、MCP 配置", colorClass: "bg-purple-500 dark:bg-purple-600" },
  ],
  [
    { role: "mcp_tools", detail: "MCP 提供新工具 (通过 MCP 协议注册)", colorClass: "bg-cyan-500 dark:bg-cyan-600" },
    { role: "mcp_instr", detail: "MCP Instructions 注入行为说明", colorClass: "bg-amber-500 dark:bg-amber-600" },
    { role: "skill_disc", detail: "Skill Discovery: 按需匹配注入", colorClass: "bg-pink-500 dark:bg-pink-600" },
  ],
  [{ role: "boundary", detail: "通过 SYSTEM_PROMPT_DYNAMIC_BOUNDARY 注入", colorClass: "bg-indigo-500 dark:bg-indigo-600" }],
  [{ role: "perceive", detail: "模型感知到: 工具列表 + 使用说明 + Skill 能力", colorClass: "bg-violet-500 dark:bg-violet-600" }],
  [{ role: "result", detail: "生态扩展生效: 模型知道自己的能力清单", colorClass: "bg-blue-500 dark:bg-blue-600" }],
];

const STEP_INFO = [
  { title: "生态系统概述", desc: "Skill、Plugin、MCP 三大扩展机制，让模型感知到自己的能力。" },
  { title: "MCP Server 连接", desc: "MCP Server 提供工具和指令说明。" },
  { title: "Skill 与 Plugin", desc: "Skill 是带元数据的 workflow package；Plugin 提供 hooks、output styles、MCP 配置。" },
  { title: "三层注入机制", desc: "MCP Tools 注册工具 + MCP Instructions 注入使用说明 + Skill Discovery 按需匹配。" },
  { title: "Prompt 动态边界", desc: "所有扩展能力通过 SYSTEM_PROMPT_DYNAMIC_BOUNDARY 注入，保持缓存效率。" },
  { title: "模型感知能力", desc: "模型通过 skill lists、MCP instructions、session guidance 感知扩展能力。" },
  { title: "生态关键", desc: "扩展机制的最后一步是让模型看到自己的能力清单 — 这是生态真正发挥作用的前提。" },
];

function getNode(id: string): FlowNode {
  return NODES.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);

  if (from.type === "circle") {
    const sx = from.x + from.w / 2;
    const sy = from.y;
    const ex = to.x;
    const ey = to.y + to.h / 2;
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }

  const sx = from.x;
  const sy = from.y + from.h / 2;
  const ex = to.x;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function S06EcosystemVisualization() {
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
        生态：Skill / Plugin / MCP
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[75%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Ecosystem Architecture
            </div>
            <svg
              viewBox="0 0 440 420"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 420, height: '500px' }}
            >
              <defs>
                <filter id="glow-ecosystem">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.7" />
                </filter>
                <marker
                  id="arrowhead-eco"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={palette.arrowFill} />
                </marker>
                <marker
                  id="arrowhead-eco-active"
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
                      markerEnd={isActive ? "url(#arrowhead-eco-active)" : "url(#arrowhead-eco)"}
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

              {NODES.map((node) => {
                const isActive = activeNodes.includes(node.id);
                const filterAttr = isActive ? "url(#glow-ecosystem)" : "none";

                if (node.type === "circle") {
                  return (
                    <g key={node.id}>
                      <motion.circle
                        cx={node.x + node.w / 2}
                        cy={node.y + node.h / 2}
                        r={node.w / 2}
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
                        x={node.x + node.w / 2}
                        y={node.y + node.h / 2 + 2}
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

              <motion.g initial={{ opacity: 0 }} animate={{ opacity: currentStep >= 4 ? 1 : 0 }}>
                <rect x={120} y={395} width={200} height={20} rx={4} fill="#8b5cf6" opacity={0.9} />
                <text x={220} y={409} textAnchor="middle" fontSize={9} fill="white" fontWeight={700}>
                  模型感知自己的能力清单
                </text>
              </motion.g>
            </svg>
          </div>

          <div className="w-full lg:w-[25%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              注入内容
            </div>
            <div className="min-h-[340px] space-y-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <AnimatePresence mode="popLayout">
                {visibleMessages.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-600"
                  >
                    [ 等待生态注入 ]
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
                    注入项: {visibleMessages.length}
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
