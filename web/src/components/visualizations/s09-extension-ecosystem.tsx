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
  type: "rect" | "circle";
  color: string;
}

const NODES: FlowNode[] = [
  { id: "session", label: "Session\n持久化", x: 120, y: 80, w: 100, h: 50, type: "rect", color: "#3B82F6" },
  { id: "mcp", label: "MCP\n工具桥接", x: 120, y: 200, w: 100, h: 50, type: "rect", color: "#10B981" },
  { id: "plugin", label: "Plugin\n能力扩展", x: 280, y: 80, w: 100, h: 50, type: "rect", color: "#8B5CF6" },
  { id: "skill", label: "Skill\n行为封装", x: 280, y: 200, w: 100, h: 50, type: "rect", color: "#F59E0B" },
  { id: "core", label: "Claude Code\n核心引擎", x: 200, y: 320, w: 120, h: 55, type: "circle", color: "#EF4444" },
];

const EDGES = [
  { from: "session", to: "core" },
  { from: "mcp", to: "core" },
  { from: "plugin", to: "core" },
  { from: "skill", to: "core" },
];

const ACTIVE_NODES_PER_STEP: string[][] = [
  ["session", "mcp", "plugin", "skill"],
  ["session"],
  ["mcp"],
  ["plugin"],
  ["skill"],
  ["core"],
];

const ACTIVE_EDGES_PER_STEP: string[][] = [
  [],
  ["session->core"],
  ["mcp->core"],
  ["plugin->core"],
  ["skill->core"],
  [],
];

const STEP_INFO = [
  { title: "扩展生态概述", desc: "Session、MCP、Plugin、Skill 四大模块让 Claude Code 保持核心简洁的同时实现无限扩展" },
  { title: "Session 持久化", desc: "JSONL Transcript 存储在 ~/.claude/projects/，parentUuid 链形成消息链表，支持对话恢复" },
  { title: "MCP 工具桥接", desc: "Model Context Protocol 桥接外部工具，mcp__server__tool 格式，自动生命周期管理" },
  { title: "Plugin 能力扩展", desc: "Hooks、Output Styles、MCP 配置，通过 pluginExtensions 注册到系统" },
  { title: "Skill 行为封装", desc: "带 frontmatter 元数据的 workflow package，按需匹配注入到 prompt" },
  { title: "核心引擎", desc: "四大模块协同工作，核心保持简洁，扩展能力按需加载" },
];

function getNode(id: string): FlowNode {
  return NODES.find((n) => n.id === id)!;
}

function edgePath(fromId: string, toId: string): string {
  const from = getNode(fromId);
  const to = getNode(toId);
  const sx = from.x + from.w / 2;
  const sy = from.y + from.h / 2;
  const ex = to.x + to.w / 2;
  const ey = to.y - to.h / 2;
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

export default function S09ExtensionEcosystemVisualization() {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({ totalSteps: 6, autoPlayInterval: 3000 });

  const activeNodes = ACTIVE_NODES_PER_STEP[currentStep];
  const activeEdges = ACTIVE_EDGES_PER_STEP[currentStep];
  const stepInfo = STEP_INFO[currentStep];

  return (
    <section className="min-h-[600px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        扩展生态：Session / MCP / Plugin / Skill
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[60%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              Ecosystem Architecture — 扩展生态架构
            </div>
            <svg
              viewBox="0 0 400 400"
              className="w-full rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{ minHeight: 350 }}
            >
              <defs>
                <filter id="glow-s09">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#8b5cf6" floodOpacity="0.7" />
                </filter>
              </defs>

              {EDGES.map((edge) => {
                const key = `${edge.from}->${edge.to}`;
                const isActive = activeEdges.includes(key);
                const d = edgePath(edge.from, edge.to);
                return (
                  <motion.path
                    key={key}
                    d={d}
                    fill="none"
                    stroke={isActive ? "#8b5cf6" : "#d1d5db"}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    animate={{ stroke: isActive ? "#8b5cf6" : "#d1d5db", strokeWidth: isActive ? 2.5 : 1.5 }}
                  />
                );
              })}

              {NODES.map((node) => {
                const isActive = activeNodes.includes(node.id);
                return (
                  <g key={node.id}>
                    {node.type === "circle" ? (
                      <motion.circle
                        cx={node.x + node.w / 2}
                        cy={node.y + node.h / 2}
                        r={node.w / 2}
                        fill={isActive ? node.color : "#e5e7eb"}
                        stroke={isActive ? node.color : "#d1d5db"}
                        strokeWidth={2}
                        filter={isActive ? "url(#glow-s09)" : "none"}
                        animate={{ fill: isActive ? node.color : "#e5e7eb", stroke: isActive ? node.color : "#d1d5db" }}
                      />
                    ) : (
                      <motion.rect
                        x={node.x}
                        y={node.y}
                        width={node.w}
                        height={node.h}
                        rx={8}
                        fill={isActive ? node.color : "#f3f4f6"}
                        stroke={isActive ? node.color : "#d1d5db"}
                        strokeWidth={2}
                        filter={isActive ? "url(#glow-s09)" : "none"}
                        animate={{ fill: isActive ? node.color : "#f3f4f6", stroke: isActive ? node.color : "#d1d5db" }}
                      />
                    )}
                    <motion.text
                      x={node.x + node.w / 2}
                      y={node.y + node.h / 2 + (node.type === "circle" ? 0 : -2)}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={isActive ? "white" : "#6b7280"}
                      animate={{ fill: isActive ? "white" : "#6b7280" }}
                    >
                      {node.label.split("\n").map((line, i) => (
                        <tspan key={i} x={node.x + node.w / 2} dy={i === 0 ? 0 : 14}>
                          {line}
                        </tspan>
                      ))}
                    </motion.text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="w-full lg:w-[40%]">
            <div className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              模块详情
            </div>
            <div className="space-y-3">
              {[
                { id: "session", label: "Session 持久化", color: "#3B82F6", detail: "JSONL Transcript, parentUuid 链, Lite Log 优化" },
                { id: "mcp", label: "MCP 工具桥接", color: "#10B981", detail: "mcp__server__tool 格式, 23 个服务文件" },
                { id: "plugin", label: "Plugin 能力扩展", color: "#8B5CF6", detail: "Hooks, Output Styles, 42 个插件文件" },
                { id: "skill", label: "Skill 行为封装", color: "#F59E0B", detail: "frontmatter 元数据, 17 个 bundled skills" },
              ].map((item, i) => {
                const isActive = currentStep === i + 1;
                const isPast = currentStep > i + 1;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: isActive ? 1 : isPast ? 0.6 : 0.3, x: 0 }}
                    className={`rounded-lg border p-3 ${isActive ? "border-" + item.color.slice(1) : "border-zinc-200 dark:border-zinc-700"}`}
                    style={{ borderColor: isActive ? item.color : undefined, backgroundColor: isActive ? `${item.color}10` : undefined }}
                  >
                    <div className="font-semibold text-sm" style={{ color: isActive ? item.color : undefined }}>
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{item.detail}</div>
                  </motion.div>
                );
              })}
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
