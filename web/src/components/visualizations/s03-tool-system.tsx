"use client";

import { motion } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";
import { useSvgPalette } from "@/hooks/useDarkMode";

interface ToolCategory {
  name: string;
  tools: string[];
  color: string;
}

const TOOL_CATEGORIES: ToolCategory[] = [
  { name: "文件操作", tools: ["FileRead", "FileEdit", "FileWrite", "GlobTool", "GrepTool", "NotebookEdit"], color: "blue" },
  { name: "Shell 执行", tools: ["BashTool", "PowerShellTool"], color: "green" },
  { name: "Agent 调度", tools: ["AgentTool", "TaskCreate", "TaskGet", "TaskList", "TaskStop", "TaskUpdate"], color: "purple" },
  { name: "MCP 集成", tools: ["MCPTool", "ListMcpResources", "ReadMcpResource", "McpAuth"], color: "amber" },
  { name: "Web 能力", tools: ["WebSearch", "WebFetch"], color: "cyan" },
  { name: "用户交互", tools: ["AskUserQuestion", "SendMessage"], color: "pink" },
  { name: "模式切换", tools: ["EnterPlanMode", "ExitPlanMode", "EnterWorktree", "ExitWorktree"], color: "orange" },
];

const PIPELINE_STEPS = [
  { id: "lookup", label: "Lookup", desc: "按名称/别名查找 Tool 对象" },
  { id: "mcp_meta", label: "MCP Metadata", desc: "解析 MCP server 信息" },
  { id: "zod", label: "Zod Validate", desc: "输入 schema 第一道校验" },
  { id: "validate", label: "validateInput", desc: "工具自己的细粒度校验" },
  { id: "classifier", label: "Speculative Clf", desc: "BashTool 风险预判(并行)" },
  { id: "prehook", label: "PreHook", desc: "运行所有 pre-tool hooks" },
  { id: "hook_decision", label: "Hook Decision", desc: "解析 Hook 返回结果" },
  { id: "permission", label: "Permission", desc: "综合规则的最终决策" },
  { id: "execute", label: "Execute", desc: "调用 tool.call()" },
  { id: "analytics", label: "Analytics", desc: "遥测和 OTel 记录" },
  { id: "posthook", label: "PostHook", desc: "成功后 post-hook" },
  { id: "result", label: "Result", desc: "构建 tool_result block" },
  { id: "failure", label: "Failure Hook", desc: "失败则走 PostToolUseFailure" },
  { id: "done", label: "完成", desc: "返回 Agent Loop 继续迭代" },
];

const ACTIVE_STEPS_PER_STEP = [
  [0],
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 8],
  [8, 9, 10, 11],
  [11, 12, 13],
];

const STEP_INFO = [
  { title: "工具系统概述", desc: "42 个工具，14 步治理流水线。toolExecution.ts (1745 行) 是工具调用的核心。" },
  { title: "工具查找", desc: "通过名字或别名找到对应的 Tool 对象。MCP 工具还需提取 server 元数据。" },
  { title: "输入校验", desc: "Zod schema 做第一道校验挡住乱传参数，validateInput() 做工具自己的细粒度校验。" },
  { title: "风险预判", desc: "Speculative Classifier 在 Hook 执行的同时并行分析 Bash 命令风险等级，减少等待时间。" },
  { title: "权限决策", desc: "综合 Hook 结果、规则配置、用户交互做出允许/拒绝决策。fail-closed 默认值设计。" },
  { title: "执行与后处理", desc: "tool.call() 真正执行，Analytics 记录遥测，PostHook 做后处理，构建 tool_result。" },
  { title: "回到 Agent 循环", desc: "工具结果追加到 messages[]，控制流返回 Agent Loop 继续迭代。" },
];

export default function ToolSystem({ title }: { title?: string }) {
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
  const activeStepIndices = ACTIVE_STEPS_PER_STEP[currentStep];
  const stepInfo = STEP_INFO[currentStep];

  return (
    <section className="min-h-[600px] space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title || "工具系统"}
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left: Pipeline */}
          <div className="w-full lg:w-[75%]">
            <div className="mb-3 font-mono text-sm text-zinc-400 dark:text-zinc-500">
              14-Step Tool Pipeline — toolExecution.ts (1745 行)
            </div>
            <div className="space-y-2">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = activeStepIndices.includes(idx);
                const isPast = activeStepIndices.some(i => i > idx);
                const colorMap: Record<string, string> = {
                  blue: "bg-blue-500",
                  green: "bg-emerald-500",
                  amber: "bg-amber-500",
                  red: "bg-red-500",
                  purple: "bg-purple-500",
                };
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.4 : 0.2,
                      x: 0,
                    }}
                    transition={{ duration: 0.3, delay: idx * 0.02 }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                        : "bg-zinc-50 dark:bg-zinc-900"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${isActive ? "bg-blue-500" : isPast ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    <span className={`font-mono text-sm font-semibold w-32 ${
                      isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"
                    }`}>
                      {step.label}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isActive || isPast ? step.desc : "..."}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Speculative Classifier note */}
            {currentStep >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
              >
                <div className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Speculative Classifier 优化
                </div>
                <div className="mt-1 text-xs text-amber-500 dark:text-amber-600">
                  在 Hook 执行的同时并行运行，不阻塞主流程。权限决策时分类结果可能已就绪。
                </div>
              </motion.div>
            )}

            {/* Permission decision note */}
            {currentStep >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
              >
                <div className="font-mono text-sm font-semibold text-red-600 dark:text-red-400">
                  fail-closed 默认值
                </div>
                <div className="mt-1 text-xs text-red-500 dark:text-red-600">
                  isConcurrencySafe 默认 false（串行执行），isReadOnly 默认 false（走严格权限）。忘了就严格。
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Tool Categories */}
          <div className="w-full lg:w-[25%]">
            <div className="mb-3 font-mono text-sm text-zinc-400 dark:text-zinc-500">
              42 工具分类 — Tool.ts (792 行基类)
            </div>
            <div className="space-y-3">
              {TOOL_CATEGORIES.map((cat, idx) => {
                const isHighlighted = currentStep >= 2;
                return (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHighlighted ? 1 : 0.3 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-lg border p-3 ${
                      isHighlighted
                        ? "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                        : "border-transparent bg-zinc-50 dark:bg-zinc-900"
                    }`}
                  >
                    <div className={`font-mono text-sm font-semibold ${
                      cat.color === "blue" ? "text-blue-600 dark:text-blue-400" :
                      cat.color === "green" ? "text-emerald-600 dark:text-emerald-400" :
                      cat.color === "purple" ? "text-purple-600 dark:text-purple-400" :
                      cat.color === "amber" ? "text-amber-600 dark:text-amber-400" :
                      cat.color === "cyan" ? "text-cyan-600 dark:text-cyan-400" :
                      cat.color === "pink" ? "text-pink-600 dark:text-pink-400" :
                      "text-orange-600 dark:text-orange-400"
                    }`}>
                      {cat.name} ({cat.tools.length})
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cat.tools.slice(0, currentStep >= 3 ? cat.tools.length : 3).map(tool => (
                        <span
                          key={tool}
                          className={`rounded px-2 py-1 font-mono text-xs ${
                            isHighlighted
                              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              : "bg-zinc-50 text-zinc-400 dark:bg-zinc-900"
                          }`}
                        >
                          {tool}
                        </span>
                      ))}
                      {currentStep < 3 && cat.tools.length > 3 && (
                        <span className="rounded px-2 py-1 font-mono text-xs bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                          +{cat.tools.length - 3}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Hook system note */}
            {currentStep >= 5 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950"
              >
                <div className="font-mono text-sm font-semibold text-purple-600 dark:text-purple-400">
                  Hook 系统 (toolHooks.ts 650 行)
                </div>
                <div className="mt-2 space-y-1 text-xs text-purple-500 dark:text-purple-600">
                  <div>PreHook: 返回 allow/ask/deny，修改输入，阻断流程</div>
                  <div>PostHook: 修改 MCP 输出，追回消息</div>
                  <div>Hook allow 不能绕过 settings deny</div>
                </div>
              </motion.div>
            )}
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
