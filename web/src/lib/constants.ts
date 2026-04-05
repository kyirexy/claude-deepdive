import type { VersionMeta, Layer } from "@/types/agent-data";

export const VERSION_ORDER = [
  "s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10", "s11"
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
  s09: {
    title: "扩展生态",
    subtitle: "Session/MCP/Plugin/Skill",
    coreAddition: "四大扩展模块",
    keyInsight: "核心保持简洁，扩展形成生态",
    layer: "ecosystem",
    prevVersion: "s08"
  },
  s10: {
    title: "终端架构",
    subtitle: "CLI/状态管理/TUI渲染",
    coreAddition: "三大基础设施",
    keyInsight: "状态驱动渲染，数据与显示分离",
    layer: "infrastructure",
    prevVersion: "s09"
  },
  s11: {
    title: "基础设施",
    subtitle: "日志/网络/配置/认证",
    coreAddition: "四大支撑模块",
    keyInsight: "支撑模块决定系统健壮性",
    layer: "foundation",
    prevVersion: "s10"
  },
};

export const LAYERS: Layer[] = [
  { id: "architecture", label: "架构总览", color: "#3B82F6", versions: ["s01"] },
  { id: "core", label: "核心引擎", color: "#10B981", versions: ["s02", "s03"] },
  { id: "multi-agent", label: "多Agent", color: "#8B5CF6", versions: ["s04"] },
  { id: "security", label: "安全与生态", color: "#F59E0B", versions: ["s05", "s06"] },
  { id: "context", label: "上下文管理", color: "#EF4444", versions: ["s07"] },
  { id: "principles", label: "设计原则", color: "#EC4899", versions: ["s08"] },
  { id: "ecosystem", label: "扩展生态", color: "#06B6D4", versions: ["s09"] },
  { id: "infrastructure", label: "终端架构", color: "#F97316", versions: ["s10"] },
  { id: "foundation", label: "基础设施", color: "#8B5CF6", versions: ["s11"] },
];
