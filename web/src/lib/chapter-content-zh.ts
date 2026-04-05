export interface ChapterSection {
  title: string;
  content: string;
}

export interface ChapterContent {
  intro: string;
  sections: ChapterSection[];
  keyTakeaways: string[];
  relatedFiles: string[];
}

export const CHAPTER_CONTENT: Record<string, ChapterContent> = {
  s01: {
    intro: `Claude Code 的核心是一个精妙的 while 循环。从你在终端敲下指令，到模型理解你的意图、执行工具、返回结果，这整条链路都运行在这个循环里。理解它，就理解了 Claude Code 的一半。

这个循环不是简单的 "问一句答一句"。它是状态驱动的：每次迭代之间通过 state 对象传递上下文，通过 messages[] 累积对话历史，通过 stop_reason 决定是继续还是退出。

**源码位置**：src/query.ts (1730行)

query.ts 是整个系统的心脏，它是一个 async generator，内部是 while(true) 循环。代码注释里明确写了有 9 个不同的 continue 点，每个对应一种"为什么要再跑一轮"的原因。`,
    sections: [
      {
        title: "2.1 一个请求怎么跑起来的",
        content: `从 cli.tsx 到最终模型响应，链路大概是这样：

1. cli.tsx 分发到 main.tsx
2. main.tsx 初始化状态、注册工具、构造 ToolUseContext
3. 用户输入进入 query() 函数
4. query() 进入 queryLoop()，这是一个 while(true) 主循环
5. 每次迭代：压缩上下文 → 组装 system prompt → 调用模型 API → 处理工具调用 → 继续或退出

**关键文件：**
- src/cli.tsx - CLI 入口
- src/main.tsx - 主应用 (4683行)
- src/query.ts - 主循环 (1730行)
- src/QueryEngine.ts - 查询引擎 (1295行)`
      },
      {
        title: "2.2 query.ts：9个continue点的状态机",
        content: `**State 对象携带的跨迭代状态（query.ts:204-217）：**

\`\`\`typescript
type State = {
  messages: Message[]                    // 消息历史
  toolUseContext: ToolUseContext        // 工具上下文
  autoCompactTracking: AutoCompactTrackingState | undefined  // 自动压缩状态
  maxOutputTokensRecoveryCount: number  // 输出token恢复计数
  hasAttemptedReactiveCompact: boolean // 是否已尝试响应式压缩
  maxOutputTokensOverride: number | undefined  // 最大输出token覆盖
  pendingToolUseSummary: Promise | undefined  // 待处理的工具摘要
  stopHookActive: boolean | undefined  // stop hook是否激活
  turnCount: number                    // 轮次计数
  transition: Continue | undefined       // 上一轮为什么继续
}
\`\`\`

**9个continue点（状态转换原因）：**

1. **model_fallback** (Line 950) - 模型降级时切换到备用模型
2. **collapse_drain_retry** (Line 1115) - 上下文折叠排水重试
3. **reactive_compact_retry** (Line 1165) - 收到413后的响应式压缩重试
4. **max_output_tokens_escalate** (Line 1220) - 输出token限制升级（8k→64k）
5. **max_output_tokens_recovery** (Line 1251) - 输出token限制恢复
6. **stop_hook_blocking** (Line 1305) - stop hook阻止继续
7. **token_budget_continuation** (Line 1340) - token预算不足继续
8. **next_turn** (Line 1725) - 正常下一轮（有工具结果）

**为什么用while(true)+state而不是递归？**

早期版本是递归调用。但递归在长会话里会爆栈。改成 while(true) + state 对象后，每次 continue 就是一个 state transition，状态清晰，不会爆栈。`
      },
      {
        title: "2.3 四道压缩机制",
        content: `**压缩优先级（query.ts:396-447）：**

每次循环迭代，消息列表会依次经过四道压缩：

**1. Snip Compact** (Line 401-410) - 裁剪过长的历史消息
\`\`\`typescript
if (feature('HISTORY_SNIP')) {
  const snipResult = snipModule!.snipCompactIfNeeded(messagesForQuery)
  messagesForQuery = snipResult.messages
  snipTokensFreed = snipResult.tokensFreed
}
\`\`\`

**2. Micro Compact** (Line 413-426) - 基于tool_use_id的缓存编辑
\`\`\`typescript
const microcompactResult = await deps.microcompact(messagesForQuery, toolUseContext, querySource)
messagesForQuery = microcompactResult.messages
\`\`\`

**3. Context Collapse** (Line 440-447) - 折叠不活跃的上下文区域为摘要
\`\`\`typescript
if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
  const collapseResult = await contextCollapse.applyCollapsesIfNeeded(messagesForQuery, ...)
  messagesForQuery = collapseResult.messages
}
\`\`\`

**4. Auto Compact** (Line 453-543) - 当token数接近阈值时触发全量压缩
\`\`\`typescript
const { compactionResult, consecutiveFailures } = await deps.autocompact(messagesForQuery, ...)
if (compactionResult) {
  // 记录压缩事件
  logEvent('tengu_auto_compact_succeeded', {...})
  // 重置追踪状态
  tracking = { compacted: true, turnId: deps.uuid(), turnCounter: 0, consecutiveFailures: 0 }
}
\`\`\`

**优先级原则**：先做轻量的（snip、micro），再做重的（collapse、auto）。如果轻量压缩已经把token数压到阈值以下，重量压缩就不需要跑。`
      },
      {
        title: "2.4 Streaming Tool Execution",
        content: `**StreamingToolExecutor** (query.ts:561-568, src/services/tools/StreamingToolExecutor.ts)

传统做法是等模型完整输出所有 tool_use block，再一起执行。Claude Code 做了优化：模型还在输出时，已完成的 tool_use block 就开始执行。

\`\`\`typescript
const useStreamingToolExecution = config.gates.streamingToolExecution
let streamingToolExecutor = useStreamingToolExecution
  ? new StreamingToolExecutor(toolUseContext.options.tools, canUseTool, toolUseContext)
  : null
\`\`\`

**执行流程（query.ts:1366-1408）：**
\`\`\`typescript
if (streamingToolExecutor) {
  // 流式执行：边收边跑
  logEvent('tengu_streaming_tool_execution_used', { tool_count: toolUseBlocks.length, ... })
} else {
  // 传统批量执行
  logEvent('tengu_streaming_tool_execution_not_used', { tool_count: toolUseBlocks.length, ... })
}

const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()
  : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)
\`\`\`

**性能影响**：如果有5个工具调用，传统做法等模型输出完（5-30秒）再执行；流式模式下，第一个工具在模型还在生成第二个tool_use时就跑完了。`
      },
      {
        title: "2.5 Token Budget 与 +500k Auto-Continue",
        content: `**src/query/tokenBudget.ts**

当用户指定 token 目标（如 "+500k"），系统追踪每个 turn 的输出 token，接近目标时注入 nudge message 让模型继续。

\`\`\`typescript
const budgetTracker = feature('TOKEN_BUDGET') ? createBudgetTracker() : null

// 检查token预算
if (feature('TOKEN_BUDGET')) {
  const decision = checkTokenBudget(budgetTracker!, toolUseContext.agentId, ...)
  if (decision.action === 'continue') {
    incrementBudgetContinuationCount()
    // 注入继续消息
    state = {
      ...state,
      messages: [...messagesForQuery, ...assistantMessages,
        createUserMessage({ content: decision.nudgeMessage, isMeta: true })],
      transition: { reason: 'token_budget_continuation' }
    }
    continue
  }
}
\`\`\`

**nudge message 示例**：
"Token budget nearly exhausted. Continue working efficiently - do not stop or summarize."`
      },
      {
        title: "2.6 Reactive Compact：API 413的兜底",
        content: `**src/services/compact/reactiveCompact.ts**

如果四道压缩都没能压下 token 数，API 返回 413（prompt too long），触发 reactive compact 机制。

\`\`\`typescript
if ((isWithheld413 || isWithheldMedia) && reactiveCompact) {
  const compacted = await reactiveCompact.tryReactiveCompact({
    hasAttempted: hasAttemptedReactiveCompact,
    querySource,
    aborted: toolUseContext.abortController.signal.aborted,
    messages: messagesForQuery,
    cacheSafeParams: { systemPrompt, userContext, systemContext, toolUseContext,
      forkContextMessages: messagesForQuery },
  })

  if (compacted) {
    // 压缩成功，重试
    state = {
      ...state,
      hasAttemptedReactiveCompact: true,
      transition: { reason: 'reactive_compact_retry' }
    }
    continue
  }
}
\`\`\`

**防循环设计**：hasAttemptedReactiveCompact 标记确保每个 turn 只尝试一次。`
      },
      {
        title: "2.7 Session Memory：后台自动提取会话摘要",
        content: `**src/services/SessionMemory/**

Session Memory 是一个自动维护会话笔记的后台服务，深度集成到上下文中：

\`\`\`typescript
// sessionMemory.ts 核心逻辑
export function shouldExtractMemory(messages: Message[]): boolean {
  // 两个阈值必须同时满足才触发提取
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)
  const hasMetToolCallThreshold = toolCallsSinceLastUpdate >= getToolCallsBetweenUpdates()

  // 或者：没有tool call且token阈值满足（自然对话间隙）
  const shouldExtract = (hasMetTokenThreshold && hasMetToolCallThreshold) ||
                       (hasMetTokenThreshold && !hasToolCallsInLastTurn)
}
\`\`\`

**关键设计**：
- 使用 runForkedAgent() 在后台fork子agent提取信息，不阻塞主对话
- 只有当工具调用次数和token数都达到阈值时才触发
- 注册为 postSamplingHook，在模型响应后自动运行
- 通过 createMemoryFileCanUseTool() 限制只能编辑memory文件`
      },
      {
        title: "2.8 Agent Summary：30秒间隔fork进度摘要",
        content: `**src/services/AgentSummary/agentSummary.ts**

每30秒fork一次子agent生成1-2句话进度摘要：

\`\`\`typescript
const SUMMARY_INTERVAL_MS = 30_000

function buildSummaryPrompt(previousSummary: string | null): string {
  return \`Describe your most recent action in 3-5 words using present tense (-ing).
Name the file or function, not the branch. Do not use tools.
Good: "Reading runAgent.ts"
Good: "Fixing null check in validate.ts"\`
}
\`\`\`

**关键设计**：
- 利用主线程的prompt cache（skip maxOutputTokens 保持cache key一致）
- 通过 canUseTool callback 拒绝工具调用
- 用于UI显示agent实时进度
- 摘要格式：git-commit风格，简洁有力`
      },
      {
        title: "2.9 forkedAgent：Cache共享与子Agent隔离",
        content: `**src/utils/forkedAgent.ts**

**CacheSafeParams 设计**：

\`\`\`typescript
// Cache关键参数必须完全一致
export type CacheSafeParams = {
  systemPrompt: SystemPrompt      // 必须完全一致
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext  // tools, model必须一致
  forkContextMessages: Message[]  // messages前缀必须一致
}

// 关键：不能设置maxOutputTokens，否则会改变budget_tokens导致cache miss
// "DO NOT set maxOutputTokens here. The fork piggybacks on the main
// thread's prompt cache by sending identical cache-key params"
\`\`\`

**子Agent隔离机制**：

\`\`\`typescript
export function createSubagentContext(parentContext, overrides?): ToolUseContext {
  return {
    readFileState: cloneFileStateCache(...),    // 克隆，不共享
    abortController: createChildAbortController(...),  // 子控制器，链接到父
    getAppState: () => ({
      ...parentContext.getAppState(),
      toolPermissionContext: {
        ...state.toolPermissionContext,
        shouldAvoidPermissionPrompts: true  // 子agent不弹权限框
      }
    }),
    // 变异回调全部设为no-op
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
  }
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "while(true) + state 对象取代递归，避免爆栈",
      "9个continue点，每个对应一种再跑一轮的原因",
      "四道压缩：Snip → Micro → Collapse → Auto",
      "Streaming Tool Execution 让工具在模型输出时并行执行",
      "Token Budget 实现长任务自动继续",
      "Reactive Compact 是 413 的兜底，有防循环设计"
    ],
    relatedFiles: [
      "src/query.ts (1730行) - 主循环状态机",
      "src/QueryEngine.ts (1295行) - 查询引擎",
      "src/main.tsx (4683行) - 主应用入口",
      "src/query/tokenBudget.ts - Token预算系统",
      "src/services/compact/reactiveCompact.ts - 响应式压缩",
      "src/services/tools/StreamingToolExecutor.ts - 流式工具执行",
      "src/services/SessionMemory/ - 会话记忆服务",
      "src/services/AgentSummary/ - Agent进度摘要服务",
      "src/utils/forkedAgent.ts - Fork子Agent工具"
    ]
  },

  s02: {
    intro: `如果说 query.ts 是循环引擎，那 prompts.ts 就是拼装引擎。Claude Code 的 system prompt 不是一行字符串，而是一台精密的拼装机器：静态部分可缓存，动态部分按状态注入，中间用一个神奇的标记隔开。

**源码位置**：src/constants/prompts.ts (914行)

理解 prompt 组装机制，是理解 Claude Code 行为控制的关键。`,
    sections: [
      {
        title: "2.4 Prompt 组装：SYSTEM_PROMPT_DYNAMIC_BOUNDARY",
        content: `**src/constants/prompts.ts**

getSystemPrompt() 返回字符串数组，每个元素对应一个 section。中间用 SYSTEM_PROMPT_DYNAMIC_BOUNDARY 隔开：

\`\`\`typescript
const fullSystemPrompt = asSystemPrompt(
  appendSystemContext(systemPrompt, systemContext)
)
\`\`\`

**静态部分（可缓存）- boundary之前：**
- 身份定位 getSimpleIntroSection
- 系统运行规范 getSimpleSystemSection
- 做任务的行为规范 getSimpleDoingTasksSection
- 风险动作规范 getActionsSection
- 工具使用语法 getUsingYourToolsSection
- 语气风格 getSimpleToneAndStyleSection
- 输出效率 getOutputEfficiencySection

**动态部分（按会话注入）- boundary之后：**
- Session guidance（当前启用的工具）
- Memory（CLAUDE.md内容）
- 环境信息（OS、shell、cwd、模型名称）
- 语言偏好、输出风格
- MCP server instructions
- Token budget 说明

**缓存优化原理**：API可以对system prompt前缀做缓存。如果两次请求前缀完全一致（字节级），第二次跳过前缀处理。`
      },
      {
        title: "2.5 getSimpleDoingTasksSection：最狠的行为规范",
        content: `**src/constants/prompts.ts**

getSimpleDoingTasksSection() 可能是整个prompt里最有价值的部分。源码注释说这是 "the most useful section"：

**禁止的行为：**
- 不要加用户没要求的功能
- 不要过度抽象，三行重复代码好过一个不成熟的抽象
- 不要给你没改的代码加注释和文档字符串
- 不要做不必要的错误处理和兜底逻辑
- 不要设计面向未来的抽象
- 不要轻易建新文件
- 不要给时间估计

**鼓励的行为：**
- 先读代码再改代码
- 方法失败了先诊断，不要盲目重试
- 结果要如实汇报，没跑过的不要说跑过了

**为什么这很重要？**

用过其他 coding agent 的人应该都遇到过：让它改个 bug，它顺手重构了半个文件；让它加一个功能，它加了三层抽象和五个错误处理。

这些问题的根源在于模型行为没有被约束。Claude Code 的做法是把行为规范写成制度，不依赖模型临场发挥。`
      },
      {
        title: "2.6 Prompt Section Registry 缓存机制",
        content: `**src/constants/systemPromptSections.ts**

动态部分的 section 不是每次都重新计算的：

\`\`\`typescript
// 创建可缓存的section
const section = systemPromptSection({
  id: 'memory',
  content: () => getMemoryContent(),
  // 只有明确标记DANGEROUS的才会每次重算
})

// MCP instructions使用DANGEROUS版本
const mcpInstructions = DANGEROUS_uncachedSystemPromptSection({
  id: 'mcp-instructions',
  content: () => getMcpInstructions()
})
\`\`\`

**缓存失效条件**：/clear 或 /compact 命令

**MCP 用 DANGEROUS 的原因**：MCP server可能在两个 turn 之间连接或断开，instructions 内容会变。`
      }
    ],
    keyTakeaways: [
      "System prompt 分静态（缓存）和动态（按状态注入）两部分",
      "SYSTEM_PROMPT_DYNAMIC_BOUNDARY 是缓存优化的关键",
      "行为规范要写成制度，不依赖模型自觉",
      "Prompt Section Registry 实现细粒度缓存控制"
    ],
    relatedFiles: [
      "src/constants/prompts.ts (914行) - System prompt组装",
      "src/constants/systemPromptSections.ts - Section缓存机制",
      "src/utils/systemPromptType.ts - 类型定义"
    ]
  },

  s03: {
    intro: `42 个工具，一条 14 步的治理流水线。工具系统是 Claude Code 能力的边界，也是安全风险的最后防线。

**源码位置**：src/Tool.ts (30308字节), src/services/tools/toolExecution.ts (1745行)

这里的核心思想是：工具调用不是模型说调就调的，而是要经过输入校验、权限检查、风险预判、失败处理。`,
    sections: [
      {
        title: "3.1 Tool.ts：10+个方法接口",
        content: `**src/Tool.ts**

Tool 接口的关键方法：

\`\`\`typescript
interface Tool {
  // 执行
  call(input: any, context: ToolUseContext, ...): Promise<ToolResult>

  // 输入校验
  inputSchema: ZodSchema  // Zod schema定义
  validateInput?(input: any, context: ToolUseContext): ValidationResult

  // 权限
  checkPermissions?(input: any, context: ToolUseContext): PermissionResult
  preparePermissionMatcher?(input: any): PermissionMatcher

  // 分类标记
  isReadOnly(): boolean           // 是否只读
  isDestructive(): boolean        // 是否有破坏性
  isConcurrencySafe(): boolean     // 是否可并发

  // 描述
  prompt(context: ToolUseContext): string  // 动态生成描述

  // 可观测性
  backfillObservableInput?(input: any): void
  toAutoClassifierInput(): CompactRepresentation

  // 渲染方法（6+个）
  render*(...)  // 展示、进度、结果、错误、拒绝、分组
}
\`\`\`

**buildTool() 的 fail-closed 默认值：**
\`\`\`typescript
isConcurrencySafe: () => false  // 默认不安全，串行执行
isReadOnly: () => false        // 默认会写，走严格权限检查
checkPermissions: () => 'allow' // 交给通用权限系统
\`\`\`

"忘了就严格"的设计避免危险操作被漏过。`
      },
      {
        title: "3.2 工具执行 Pipeline：14步详解",
        content: `**src/services/tools/toolExecution.ts**

**Step 1-2: 查找工具 (runToolUse, Line 337-410)**
\`\`\`typescript
let tool = findToolByName(toolUseContext.options.tools, toolName)
if (!tool) {
  // 尝试通过别名查找（旧版名称兼容）
  const fallbackTool = findToolByName(getAllBaseTools(), toolName)
  if (fallbackTool?.aliases?.includes(toolName)) {
    tool = fallbackTool
  }
}
\`\`\`

**Step 3: Zod Schema校验 (Line 614-680)**
\`\`\`typescript
const parsedInput = tool.inputSchema.safeParse(input)
if (!parsedInput.success) {
  return [{ message: createUserMessage({
    content: [{ type: 'tool_result', content: \`InputValidationError: ...\` }]
  })]
}
\`\`\`

**Step 4: 工具特定校验 (Line 682-733)**
\`\`\`typescript
const isValidCall = await tool.validateInput?.(parsedInput.data, toolUseContext)
if (isValidCall?.result === false) {
  return [{ message: createUserMessage({
    content: [{ type: 'tool_result', content: \`ValidationError: ...\` }]
  })]
}
\`\`\`

**Step 5: Speculative Classifier (Line 740-752)**
\`\`\`typescript
if (tool.name === 'BashTool' && 'command' in parsedInput.data) {
  startSpeculativeClassifierCheck(
    parsedInput.data.command,
    appState.toolPermissionContext,
    toolUseContext.options.isNonInteractiveSession
  )
}
\`\`\`

**Step 6: PreToolUse Hooks (Line 800-891)**
\`\`\`typescript
for await (const result of runPreToolUseHooks(...)) {
  switch (result.type) {
    case 'hookPermissionResult': hookPermissionResult = result.hookPermissionResult; break
    case 'hookUpdatedInput': processedInput = result.updatedInput; break
    case 'preventContinuation': shouldPreventContinuation = result.shouldPreventContinuation; break
  }
}
\`\`\`

**Step 7: 权限决策 (Line 921-1104)**
\`\`\`typescript
const resolved = await resolveHookPermissionDecision(
  hookPermissionResult, tool, processedInput, toolUseContext, canUseTool, ...
)
const permissionDecision = resolved.decision
processedInput = resolved.input
\`\`\`

**Step 8: 修正输入 (Line 1128-1132)**
\`\`\`typescript
if (permissionDecision.updatedInput !== undefined) {
  processedInput = permissionDecision.updatedInput
}
\`\`\`

**Step 9: 执行 tool.call() (Line 1207-1222)**
\`\`\`typescript
const result = await tool.call(callInput, { ...toolUseContext, toolUseId: toolUseID }, canUseTool, assistantMessage, progress => {...})
\`\`\`

**Step 10: 结果处理 (Line 1227-1380)**
\`\`\`typescript
const mappedToolResultBlock = tool.mapToolResultToToolResultBlockParam(result.data, toolUseID)
const toolResultStr = jsonStringify(result.data)
endToolSpan(toolResultStr)
\`\`\`

**Step 11-12: OTel日志 (Line 1376-1395, 1371-1380)**
\`\`\`typescript
void logOTelEvent('tool_result', { tool_name: tool.name, success: 'true', ... })
addToolContentEvent('tool.output', contentAttributes)
\`\`\`

**Step 13: PostToolUse Hooks (Line 1397-1563)**
\`\`\`typescript
for await (const hookResult of runPostToolUseHooks(...)) {
  if ('updatedMCPToolOutput' in hookResult) {
    toolOutput = hookResult.updatedMCPToolOutput
  }
  resultingMessages.push(hookResult)
}
\`\`\`

**Step 14: PostToolUseFailure Hooks (Line 1696-1738)**
\`\`\`typescript
if (error) {
  for await (const hookResult of runPostToolUseFailureHooks(...)) {
    hookMessages.push(hookResult)
  }
  return [{ message: ... }, ...hookMessages]
}
\`\`\``
      },
      {
        title: "3.3 42个工具的分类",
        content: `**src/tools/ 目录**

按功能分类：

**文件操作 (6个)：**
- FileReadTool - 读取文件
- FileEditTool - 编辑文件
- FileWriteTool - 写入文件
- GlobTool - 文件模式匹配
- GrepTool - 内容搜索
- NotebookEditTool - Jupyter notebook编辑

**Shell执行 (2个)：**
- BashTool - Bash命令执行
- PowerShellTool - PowerShell命令执行

**Agent调度 (6个)：**
- AgentTool - Agent调度总控
- TaskCreateTool, TaskGetTool, TaskListTool, TaskUpdateTool, TaskStopTool - 任务管理

**MCP集成 (4个)：**
- MCPTool - MCP协议工具
- ListMcpResourcesTool, ReadMcpResourceTool - MCP资源访问
- McpAuthTool - MCP认证

**Web能力 (2个)：**
- WebSearchTool - 网络搜索
- WebFetchTool - 网络获取

**用户交互 (2个)：**
- AskUserQuestionTool - 向用户提问
- SendMessageTool - 发送消息

**模式切换 (4个)：**
- EnterPlanModeTool, ExitPlanModeTool - 计划模式
- EnterWorktreeTool, ExitWorktreeTool - Git worktree

**其他 (16+个)：**
- SkillTool, SleepTool, TodoWriteTool, ConfigTool, ToolSearchTool, BriefTool...`
      },
      {
        title: "3.7 buildTool 工厂模式：defaults与类型安全",
        content: `**src/Tool.ts**

\`buildTool()\` 是所有工具的创建入口，封装了默认值的设置逻辑：

\`\`\`typescript
// 工厂函数签名
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>

// 默认值策略：fail-closed
const TOOL_DEFAULTS = {
  // 默认不允许并发——更安全
  isConcurrencySafe: () => false,

  // 默认是会写操作——走严格权限
  isReadOnly: () => false,
  isDestructive: () => false,

  // 默认允许——具体工具可以更严格
  checkPermissions: () => ({ behavior: 'allow', updatedInput: input }),

  // 空字符串作为默认输入表示
  toAutoClassifierInput: () => '',

  // 默认使用工具名作为显示名
  userFacingName: () => def.name,
}
\`\`\`

**Tool Result 处理流水线 (toolExecution.ts)**：

\`\`\`typescript
// 1. 工具返回 ToolResult
const result = await tool.call(args, context, canUseTool, parentMessage, onProgress)

// 2. 转换为 API 格式
const mappedResult = tool.mapToolResultToToolResultBlockParam(result.data, toolUseID)

// 3. 检查是否需要持久化
const { shouldPersist, preview, storedPath } = await maybePersistLargeToolResult(
  result.data,
  tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS
)

// 4. 执行 Post-tool hooks
const hookResults = await runPostToolUseHooks({ tool, result: mappedResult, ... })
\`\`\`

**大结果持久化策略**：

\`\`\`typescript
// utils/toolResultStorage.ts
const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000

// 超过限制时：
// 1. 摘要前 2000 字符显示
// 2. 完整内容保存到 session 目录
// 3. 返回文件路径引用
if (result.size > maxSize) {
  const summary = result.data.substring(0, 2000)
  const storedPath = await saveToSessionDir(result.data, toolName, toolUseID)
  return { summary, storedPath, truncated: true }
}
\`\`\``
      },
      {
        title: "3.8 工具注册表与 assembleToolPool",
        content: `**src/tools.ts**

\`getAllBaseTools()\` 返回所有内置工具的完整列表：

\`\`\`typescript
export function getAllBaseTools(): Tools {
  return [
    AgentTool,
    BashTool,
    FileReadTool,
    FileEditTool,
    GlobTool,
    GrepTool,
    WebSearchTool,
    WebFetchTool,
    // ... 40+ tools total
  ]
}

// 条件编译：部分工具根据特性标志或用户类型决定是否包含
...(hasEmbeddedSearchTools() ? [] : [GlobTool, GrepTool]),
...(isTodoV2Enabled() ? [TaskCreateTool, TaskUpdateTool, ...] : []),
...(process.env.USER_TYPE === 'ant' ? [ConfigTool, TungstenTool] : []),
\`\`\`

**工具过滤管道**：

\`\`\`typescript
// assembleToolPool = 筛选 + 组合
function assembleToolPool(
  permissionContext: ToolPermissionContext,
  mcpTools: MCPTool[]
): Tool[] {
  // 1. 获取所有内置工具
  let tools = getAllBaseTools()

  // 2. 按拒绝规则过滤
  tools = filterToolsByDenyRules(tools, permissionContext)

  // 3. 按允许规则再次筛选
  tools = filterToolsByAllowRules(tools, permissionContext)

  // 4. 合并 MCP 工具
  tools = [...tools, ...mcpTools]

  return tools
}

// 过滤逻辑：deny > allow
function filterToolsByDenyRules(tools, context): Tool[] {
  return tools.filter(tool => {
    const rule = findMatchingRule(tool.name, context.alwaysDenyRules)
    if (rule) return false
    return true
  })
}
\`\`\``
      },
      {
        title: "3.9 工具编排：并发控制与分区执行",
        content: `**src/services/tools/toolOrchestration.ts**

多个工具调用如何决定串行还是并行？

\`\`\`typescript
// 工具分区：并发安全 vs 非并发安全
interface ToolCallPartition {
  isConcurrencySafe: boolean
  blocks: ToolUseBlock[]
}

// partitionToolCalls 根据两个属性分区
function partitionToolCalls(blocks: ToolUseBlock[], tools: Tool[]): ToolCallPartition[] {
  const partitions: Map<boolean, ToolUseBlock[]> = new Map([
    [true, []],   // 并发安全
    [false, []]   // 非并发安全
  ])

  for (const block of blocks) {
    const tool = findToolByName(tools, block.name)
    if (!tool) continue

    // 查询工具是否并发安全
    const isSafe = tool.isConcurrencySafe?.(block.input) ?? false
    partitions.get(isSafe)!.push(block)
  }

  return [
    { isConcurrencySafe: true, blocks: partitions.get(true)! },
    { isConcurrencySafe: false, blocks: partitions.get(false)! },
  ]
}

// 并发安全 + 只读 → 并行执行
// 非并发安全 或 写操作 → 串行执行
\`\`\`

**并发限制配置**：

\`\`\`typescript
// 最多同时运行 N 个并发工具
const MAX_TOOL_USE_CONCURRENCY = parseInt(
  process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY ?? '10'
)

// 信号量控制并发数
const semaphore = new Semaphore(MAX_TOOL_USE_CONCURRENCY)

async function runWithConcurrencyLimit(fn: () => Promise<T>) {
  await semaphore.acquire()
  try {
    return await fn()
  } finally {
    semaphore.release()
  }
}
\`\`\``
      },
      {
        title: "3.10 安全层：权限决策七步流程",
        content: `**src/utils/permissions/permissions.ts**

权限检查是多阶段决策过程：

\`\`\`typescript
async function hasPermissionsToUseTool(
  tool: Tool,
  input: any,
  context: ToolUseContext,
  canUseTool: CanUseToolFn
): Promise<PermissionResult> {

  // === Step 1: 规则匹配 ===

  // 1a: 整个工具在拒绝列表？
  const denyRule = matchToolRule(tool.name, context.alwaysDenyRules)
  if (denyRule) return { behavior: 'deny', reason: 'Tool denied by rule' }

  // 1b: 整个工具在询问列表？
  const askRule = matchToolRule(tool.name, context.alwaysAskRules)
  if (askRule && !context.sandboxAutoAllow) {
    return { behavior: 'ask', suggestions: buildSuggestions(askRule) }
  }

  // 1c: 工具特定权限检查（如 Bash 子命令规则）
  const toolSpecificResult = await tool.checkPermissions?.(input, context)
  if (toolSpecificResult?.behavior === 'deny') {
    return toolSpecificResult
  }

  // === Step 2: 模式级别允许 ===

  // 2a: bypassPermissions 模式或 plan 模式 + bypass
  if (context.permissionMode === 'bypassPermissions' ||
      (context.permissionMode === 'plan' && context.canBypassPlanMode)) {
    return { behavior: 'allow' }
  }

  // 2b: 工具在始终允许列表？
  const allowRule = matchToolRule(tool.name, context.alwaysAllowRules)
  if (allowRule) return { behavior: 'allow' }

  // === Step 3: 兜底询问 ===
  return { behavior: 'ask' }
}
\`\`\`

**安全检查的绕过免疫**：

\`\`\`typescript
// 以下检查即使在 bypassPermissions 模式下也会执行
const SAFETY_CHECKS = [
  // .git/ 目录保护
  { pattern: /^\.git\//, reason: 'Cannot modify .git directory' },
  // .claude/ 配置目录保护
  { pattern: /^\.claude\//, reason: 'Cannot modify .claude directory' },
  // Shell 配置文件
  { pattern: /\.(bashrc|zshrc|profile)$/, reason: 'Shell config modification blocked' },
]

// 这些检查在 checkSafetyValidations() 中执行，永不绕过
\`\`\``
      },
      {
        title: "3.11 Bash 权限：AST 解析与危险模式",
        content: `**src/tools/BashTool/bashPermissions.ts**

Bash 权限检查使用 tree-sitter 进行 AST 解析：

\`\`\`typescript
// 解析 Bash 命令为 AST
const ast = parseBashCommand(command)

// 遍历 AST 节点，提取实际命令
function extractCommandsFromAST(ast): string[] {
  const commands: string[] = []

  for (const node of ast.descendants()) {
    if (node.type === 'command') {
      const cmdName = getCommandName(node)
      commands.push(cmdName)
    }

    // 处理 compound commands (&&, |, ;)
    if (node.type === 'and') {
      commands.push(...extractCommandsFromAST(node.left))
      commands.push(...extractCommandsFromAST(node.right))
    }
  }

  return commands
}
\`\`\`

**危险命令模式**：

\`\`\`typescript
// DANGEROUS_BASH_PATTERNS
const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s/, reason: 'eval is dangerous' },
  { pattern: /\bsudo\s+su\b/, reason: 'sudo su is dangerous' },
  { pattern: /\bcurl\s+.*\|\s*sh\b/, reason: 'pipe to shell is dangerous' },
  { pattern: /\bwget\s+.*\|\s*sh\b/, reason: 'wget pipe to shell is dangerous' },
  { pattern: /\brm\s+-rf\s+\/\b/, reason: 'rm -rf / is dangerous' },
  { pattern: /\bchmod\s+-R\s+777\b/, reason: 'world-writable permissions' },
]

// 检查是否匹配危险模式
function checkDangerousPatterns(command: string): Match | null {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { reason, pattern }
    }
  }
  return null
}
\`\`\`

**Safe Wrapper 剥离**：

\`\`\`typescript
// 剥离安全包装器，防止绕过
const SAFE_WRAPPERS = ['timeout', 'nice', 'nohup', 'ionice', 'renice']

function stripSafeWrappers(command: string): string {
  let result = command

  for (const wrapper of SAFE_WRAPPERS) {
    // timeout 5 git push → git push
    const regex = new RegExp(\`^\\\\s*\${wrapper}\\\\s+\\\\d+\\\\s+\`)
    result = result.replace(regex, '')
  }

  return result
}

// 同样剥离所有环境变量（前缀防止 env FOO=bar git 绕过）
function stripAllLeadingEnvVars(command: string): string {
  return command.replace(/^[A-Z_][A-Z0-9_]*=.*?\s+/g, '')
}
\`\`\``
      },
      {
        title: "3.12 路径验证：防护机制详解",
        content: `**src/utils/permissions/pathValidation.ts**

路径验证防止危险的路径操作：

\`\`\`typescript
// UNC 路径阻止（防止凭证泄露）
const UNC_PATH_REGEX = /^\\\\|^\\\\\\\\

function validatePath(path: string): ValidationResult {
  // 阻止 UNC 路径访问
  if (UNC_PATH_REGEX.test(path)) {
    return { valid: false, reason: 'UNC paths are not allowed' }
  }

  // 阻止 ~user 风格路径
  if (/^~[a-zA-Z]/.test(path)) {
    return { valid: false, reason: 'Home directory shortcuts not allowed' }
  }

  // 阻止 shell 扩展
  if (/\\$[A-Z_][A-Z0-9_]*|\\$\\{[^}]+\\}|\\$\\([^)]+\\)/.test(path)) {
    return { valid: false, reason: 'Shell expansion not allowed in paths' }
  }

  // 阻止通配符写入
  if (isGlobPattern(path) && operationType === 'write') {
    return { valid: false, reason: 'Glob patterns not allowed for write operations' }
  }

  // 危险删除路径检测
  if (isDangerousRemovalPath(path)) {
    return { valid: false, reason: 'This removal pattern is blocked' }
  }
}
\`\`\`

**危险删除模式**：

\`\`\`typescript
// 阻止 rm -rf / 或类似致命操作
const DANGEROUS_REMOVAL_PATTERNS = [
  /^\\s*rm\\s+-rf\\s+\\/\\s*$/,           // rm -rf /
  /^\\s*rm\\s+-rf\\s+\\*\\s*$/,           // rm -rf *
  /^\\s*rm\\s+-rf\\s+\\.\\s*$/,          // rm -rf .
  /^\\s*rm\\s+-r\\s+(['"])\\/\\1\\s*$/,  // rm -r "/"
]

function isDangerousRemovalPath(command: string): boolean {
  return DANGEROUS_REMOVAL_PATTERNS.some(p => p.test(command))
}
\`\`\`

**工作目录检查**：

\`\`\`typescript
// 写入操作必须在工作目录内（或其子目录）
function validateWorkingDirectory(filePath: string, cwd: string): boolean {
  const resolvedPath = resolve(filePath)
  const resolvedCwd = resolve(cwd)

  // 确保文件路径是 cwd 的子目录
  return resolvedPath.startsWith(resolvedCwd + sep)
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "Tool接口有10+个方法，考虑fail-closed默认值",
      "14步执行流水线确保工具调用安全可控",
      "Speculative classifier提前异步分析Bash命令风险",
      "Pre/Post Hook系统提供强大的扩展点",
      "resolveHookPermissionDecision是权限决策的核心",
      "buildTool工厂模式封装默认值策略，fail-closed设计",
      "工具分区执行：并发安全工具并行，不安全工具串行",
      "权限七步流程：规则匹配 → 模式检查 → 兜底询问",
      "Bash使用AST解析而非正则，防止命令注入绕过",
      "路径验证阻止UNC路径、shell扩展、通配符写入"
    ],
    relatedFiles: [
      "src/Tool.ts (30308字节) - 工具基类",
      "src/services/tools/toolExecution.ts (1745行) - 执行流水线",
      "src/services/tools/toolHooks.ts - Hook系统",
      "src/tools/BashTool/bashPermissions.ts - Bash权限检查",
      "src/utils/permissions/pathValidation.ts - 路径验证",
      "src/services/tools/toolOrchestration.ts - 并发控制"
    ]
  },

  s04: {
    intro: `Claude Code 至少有 6 个内建 Agent：General Purpose Agent、Explore Agent、Plan Agent、Verification Agent、Claude Code Guide Agent、Statusline Setup Agent。

**源码位置**：src/tools/AgentTool/AgentTool.tsx (1397行), src/tools/AgentTool/runAgent.ts (973行)

这个设计选择的出发点很朴素：让一个 Agent 同时研究、规划、实现、验证，每件事都做不扎实。把角色拆开，才能各司其职。`,
    sections: [
      {
        title: "4.2 Explore Agent：只读专家",
        content: `**src/tools/AgentTool/built-in/exploreAgent.ts**

Explore Agent 被明确禁止：
- 创建新文件（任何形式）
- 修改已有文件
- 删除文件
- 用重定向写文件
- 运行任何改变系统状态的命令

**可用工具**：Glob、Grep、FileRead、Bash（仅限ls、git status、git log等读操作）

**Prompt关键内容**：
\`\`\`
You are a research agent. You MUST NOT:
- Create or modify any files
- Run commands that change system state
- Use output redirection

You CAN:
- Read files with Glob, Grep, FileRead
- List directory contents
- Check git status/log
\`\`\`

**性能优化**：外部用户默认用 Haiku 模型（更快更便宜），内部用户继承主模型。探索不需要最强推理，速度更重要。`
      },
      {
        title: '4.3 Verification Agent：130行的"想办法搞坏它"',
        content: `**src/tools/AgentTool/built-in/verificationAgent.ts**

Verification Agent 的 prompt 写了130行，可能是整个源码里最精心设计的文本。

**核心职责**：try to break it

**两种常见失败模式**：
1. Verification avoidance - 只看代码不跑检查，写个PASS就走
2. 被前80%迷惑 - UI看着不错测试也过了，忽略剩下20%

**强制验证策略**：
\`\`\`
Based on change type:
- Frontend: Start dev server, use browser automation
- Backend: curl for actual testing
- CLI: Check stdout/stderr/exit code
- DB migration: Test up/down and existing data
\`\`\`

**识别合理化倾向**：
- "代码看起来对" → 看是不是验证。跑一下。
- "实现者测试通过了" → 实现者也是LLM。独立验证。
- "大概没问题" → 大概不是验证。跑一下。

**实现者与验证者分离**是传统软件工程常识，但在AI Agent系统里大部分产品还没做到。`
      },
      {
        title: "4.6 runAgent.ts：子Agent完整生命周期",
        content: `**src/tools/AgentTool/runAgent.ts (973行)**

\`\`\`typescript
export async function* runAgent(params: AgentParams): AsyncGenerator<...> {
  // 1. 初始化agent专属MCP servers
  const mcpServers = await initializeAgentMcpServers(params.frontmatter)

  // 2. 克隆file state cache
  const clonedCache = cloneFileStateCache()

  // 3. 获取user/system context
  const context = await getAgentContext(params)

  // 4. 对只读agent做内容瘦身
  const trimmedContext = params.readonly
    ? trimForReadOnly(context)
    : context

  // 5. 构造agent专属权限模式
  const permissionMode = buildAgentPermissionMode(params)

  // 6. 组装工具池
  const tools = assembleToolPool(params)

  // 7. 注册frontmatter hooks
  registerFrontmatterHooks(params)

  // 8. 预加载skills
  await preloadSkills(params)

  // 9. 调用query()进入主循环
  yield* query({
    messages: params.messages,
    systemPrompt: params.systemPrompt,
    toolUseContext: { ...context, tools, permissionMode },
    ...
  })

  // 10. 记录transcript
  recordSidechainTranscript(params.agentId, ...)

  // 11. 清理
  cleanupAgentTracking(params.agentId)
  killShellTasksForAgent(params.agentId)
}
\`\`\`

**关键设计**：agent可以自带MCP servers，通过frontmatter配置连接专属外部工具。`
      },
      {
        title: "4.7 Fork Subagent：隐式Fork机制",
        content: `**src/tools/AgentTool/forkSubagent.ts**

Fork Subagent 是一种隐式 Fork 机制：当用户不指定 subagent_type 时，触发继承父进程完整上下文的子 agent。

\`\`\`typescript
// Fork触发条件
export function isForkSubagentEnabled(): boolean {
  if (feature('FORK_SUBAGENT')) {
    if (isCoordinatorMode()) return false  // 与coordinator模式互斥
    if (getIsNonInteractiveSession()) return false
    return true
  }
  return false
}

// Fork子代理的定义
export const FORK_AGENT = {
  agentType: FORK_SUBAGENT_TYPE,
  tools: ['*'],           // 继承父工具池
  useExactTools: true,    // 精确工具集（保持cache key一致）
  permissionMode: 'bubble', // 权限弹窗透传给父终端
  model: 'inherit',       // 继承父模型
}
\`\`\`

**Fork消息构建**：

\`\`\`typescript
// 所有fork子代理必须产生字节级相同的API请求前缀
// 保留父assistant消息的所有tool_use blocks
// 为每个tool_use生成相同的placeholder结果
const FORK_PLACEHOLDER_RESULT = 'Fork started — processing in background'

// 构建消息：父assistant + 虚拟tool_results + 子指令
const toolResultBlocks = toolUseBlocks.map(block => ({
  type: 'tool_result',
  tool_use_id: block.id,
  content: [{ type: 'text', text: FORK_PLACEHOLDER_RESULT }]
}))

return [fullAssistantMessage, toolResultMessage]
\`\`\`

**子代理规则（刻在DNA里）**：

\`\`\`
1. 你的system prompt说"default to forking"，忽略它——你是fork，不是父
2. 不要对话、提问、建议下一步
3. 不要编辑评论或元注释
4. 直接使用工具（Bash, Read, Write等）
5. 修改文件后提交，报告中包含commit hash
6. 工具调用之间不要输出文本
7. 严格在指令范围内工作
8. 报告不超过500字
9. 必须以"Scope:"开头
10. 报告结构化事实后停止
\`\`\``
      },
      {
        title: "4.8 CacheSafeParams：Prompt Cache共享机制",
        content: `**src/utils/forkedAgent.ts**

CacheSafeParams 是实现父子进程Prompt Cache共享的关键设计。

\`\`\`typescript
// 影响API cache key的参数必须完全一致
export type CacheSafeParams = {
  systemPrompt: SystemPrompt      // 必须字节级一致
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext  // tools、model必须一致
  forkContextMessages: Message[]  // messages前缀必须一致
}

// 关键约束：不能设置maxOutputTokens
// "DO NOT set maxOutputTokens here. The fork piggybacks on the main
// thread's prompt cache by sending identical cache-key params"
// 设置maxOutputTokens会改变budget_tokens，导致cache miss
\`\`\`

**createSubagentContext 的隔离设计**：

\`\`\`typescript
export function createSubagentContext(parentContext, overrides?): ToolUseContext {
  return {
    // 克隆，不共享——防止状态污染
    readFileState: cloneFileStateCache(parentContext.readFileState),

    // 子控制器，链接到父——父abort时级联终止
    abortController: createChildAbortController(parentContext.abortController),

    // 变异回调全部设为no-op——完全隔离
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},

    // 但共享setAppStateForTasks——异步任务需要注册到根store
    setAppStateForTasks: parentContext.setAppStateForTasks,

    // 子代理不弹权限框
    getAppState: () => {
      const state = parentContext.getAppState()
      return {
        ...state,
        toolPermissionContext: {
          ...state.toolPermissionContext,
          shouldAvoidPermissionPrompts: true
        }
      }
    }
  }
}
\`\`\`

**父子隔离级别**：

| 状态类型 | 隔离策略 | 原因 |
|---------|---------|------|
| readFileState | 克隆 | 防止文件句柄冲突 |
| abortController | 子链接父 | 父abort时级联终止 |
| setAppState | no-op | 防止状态污染 |
| setAppStateForTasks | 共享 | 任务需要注册到根store |
| toolPermissionContext | shouldAvoidPermissionPrompts | 子代理不弹窗 |
| contentReplacementState | 克隆 | 保持cache key一致 |`
      },
      {
        title: "4.9 AgentTool 调度：生命周期全流程",
        content: `**src/tools/AgentTool/AgentTool.tsx**

AgentTool 是 6 个内置 Agent 的统一入口，通过 subagent_type 路由到不同实现：

\`\`\`typescript
// AgentTool.tsx:420 - call() 方法入口
export const AgentTool = buildTool({
  name: AGENT_TOOL_NAME,
  inputSchema: AgentToolInput,
  call: async (input, context, canUseTool, parentMessage, onProgress) => {
    // 根据 subagent_type 路由
    switch (input.subagent_type ?? 'general-purpose') {
      case 'explore':
        return runExploreAgent(input, context, canUseTool, parentMessage, onProgress)
      case 'plan':
        return runPlanAgent(input, context, canUseTool, parentMessage, onProgress)
      case 'verification':
        return runVerificationAgent(input, context, canUseTool, parentMessage, onProgress)
      case 'general-purpose':
        return runGeneralPurposeAgent(input, context, canUseTool, parentMessage, onProgress)
      case 'claude-code-guide':
        return runClaudeCodeGuideAgent(input, context, canUseTool, parentMessage, onProgress)
      case 'statusline-setup':
        return runStatuslineSetupAgent(input, context, canUseTool, parentMessage, onProgress)
      default:
        // 自定义agent或plugin agent
        return runCustomAgent(input, context, canUseTool, parentMessage, onProgress)
    }
  }
})
\`\`\`

**Agent 生命周期管理 (agentToolUtils.ts)**：

\`\`\`typescript
// 异步Agent注册到全局追踪表
registerAsyncAgent(agentId, {
  parentRequestId,
  agentType,
  status: 'running',
  startedAt: Date.now()
})

// 完成后标记
completeAsyncAgent(agentId, {
  finalStatus: 'completed',
  output: agentResult
})

// 失败时标记并通知
failAsyncAgent(agentId, {
  error: error.message,
  stack: error.stack
})

// 终止时清理资源
killAsyncAgent(agentId) // 中断 + 清理
\`\`\`

**Background Agent 完成通知 (agentToolUtils.ts:340-380)**：

\`\`\`typescript
// 当子agent完成时，通过 AppState 通知父终端
async function notifyParentOfCompletion(agentId: string, result: AgentResult) {
  const state = getAppState()
  // 添加到 pendingAgentResults，父终端在下一轮检查并显示
  state.pendingAgentResults.push({
    agentId,
    agentType: result.agentType,
    summary: result.summary ?? result.output.slice(0, 200),
    completedAt: Date.now()
  })
}
\`\`\``
      },
      {
        title: "4.10 Agent Context：AsyncLocalStorage 隔离机制",
        content: `**src/utils/agentContext.ts**

Claude Code 使用 AsyncLocalStorage 实现 Agent 身份追踪，解决后台 Agent 并发运行时的上下文隔离问题：

\`\`\`typescript
// 两种Agent上下文类型
type SubagentContext = {
  agentId: string           // 子Agent UUID
  parentSessionId?: string  // Team lead的session ID
  agentType: 'subagent'
  subagentName?: string
  isBuiltIn?: boolean
  invocationKind?: 'spawn' | 'resume'
}

type TeammateAgentContext = {
  agentId: string           // 完整agent ID，如 "researcher@my-team"
  agentName: string         // 显示名
  teamName: string
  planModeRequired: boolean
  parentSessionId: string
  isTeamLead: boolean
  agentType: 'teammate'
}
\`\`\`

**为什么不用普通变量？**

AppState 是单例共享的。当多个后台 Agent 同时运行时：
\`\`\`typescript
// 问题场景
async function runBackgroundAgent() {
  currentAgentId = 'agent-1'  // 全局变量
  await someAsyncOp()         // 挂起时，其他agent可能修改currentAgentId
  log(currentAgentId)          // 可能已经是 'agent-2' 了！
}
\`\`\`

**AsyncLocalStorage 隔离原理**：

\`\`\`typescript
const agentContextStorage = new AsyncLocalStorage<AgentContext>()

// 每个async chain绑定自己的上下文
agentContextStorage.run(agentContext, () => {
  // 这里面的任何异步操作都能通过 getAgentContext() 获取正确的agentId
  return runAgent(params)
})

// 即使中间有 await，不会串到其他agent的上下文
\`\`\`

**Context 传播模式**：

\`\`\`typescript
// 子Agent继承父上下文
runWithAgentContext(parentContext, () => runAgent(params))

// Teammate 使用独立上下文
runWithTeammateContext(teammateIdentity, () => inProcessRunner(params))
\`\`\``
      },
      {
        title: "4.11 Mailbox：基于文件的 Agent 通信",
        content: `**src/utils/teammateMailbox.ts**

Teammate Agent 之间通过文件系统传递消息，消息存储在：
\`~\.claude\teams\{team_name}\inboxes\{agent_name}.json\`

\`\`\`typescript
type TeammateMessage = {
  from: string           // 发送者名称
  text: string          // 消息内容
  timestamp: string     // ISO时间戳
  read: boolean         // 已读标记
  color?: string        // 发送者颜色
  summary?: string      // 消息摘要（用于显示）
}

// 核心操作
writeToMailbox(recipientName, message, teamName)
readMailbox(agentName, teamName)
markMessageAsReadByIndex(agentName, teamName, index)
\`\`\`

**SendMessageTool 协议**：

\`\`\`typescript
// 消息路由
type MessageRouting = {
  sender: string
  senderColor?: string
  target: string
  targetColor?: string
  summary?: string
  content?: string
}

// 支持的消息类型
type StructuredMessage =
  | { type: 'idle_notification' }           // 空闲通知
  | { type: 'shutdown_request', request_id: string, reason?: string }
  | { type: 'shutdown_response', request_id: string, approve: boolean }
  | { type: 'plan_approval_request', request_id: string }
  | { type: 'plan_approval_response', request_id: string, approve: boolean }
  | { type: 'task_assignment', taskId: string, summary: string }
  | { type: 'mode_set_request', mode: PermissionMode }
  | { type: 'team_permission_update', rules: PermissionRule[] }
\`\`\`

**轮询机制**：

\`\`\`typescript
// In-process teammate 使用 500ms 轮询
const POLL_INTERVAL_MS = 500

while (!abortController.signal.aborted) {
  const messages = readMailbox(agentName, teamName)
  for (const msg of messages.filter(m => !m.read)) {
    await handleMessage(msg)
    markMessageAsReadByIndex(agentName, teamName, msg.index)
  }
  await sleep(POLL_INTERVAL_MS)
}
\`\`\`

**Mailbox 锁机制**：

\`\`\`typescript
// 写操作使用锁防止并发写入
await mailboxLock.runExclusive(async () => {
  const messages = await readMailboxFile(path)
  messages.push(newMessage)
  await writeMailboxFile(path, messages)
})
\`\`\``
      },
      {
        title: "4.12 In-Process Runner：同进程执行Teammate",
        content: `**src/utils/swarm/inProcessRunner.ts**

Teammate Agent 可以在同一 Node.js 进程内运行，使用 AsyncLocalStorage 隔离：

\`\`\`typescript
export async function startInProcessTeammate(params: {
  identity: TeammateIdentity
  taskId: string
  prompt: string
  agentDefinition?: CustomAgentDefinition
  toolUseContext: ToolUseContext
  abortController: AbortController
  model?: string
}): Promise<void> {
  // 1. 建立 Agent Context
  const context = createTeammateAgentContext(params.identity)

  // 2. 在隔离上下文中运行
  await runWithTeammateContext(context, async () => {
    // 3. 持续处理消息循环
    while (!abortController.signal.aborted) {
      // 3.1 收取邮件
      const messages = readMailbox(params.identity.name, params.identity.team)

      // 3.2 处理新消息
      for (const msg of messages.filter(m => !m.read)) {
        await handleTeammateMessage(msg)
        markMessageAsReadByIndex(...)
      }

      // 3.3 检查任务列表
      const task = claimAvailableTask(params.identity.team, params.identity.name)
      if (task) {
        await executeTask(task)
      }

      // 3.4 上报进度
      updateProgress(params.taskId, getCurrentProgress())

      await sleep(500)
    }
  })
}
\`\`\`

**与 Subagent 的区别**：

| 特性 | Subagent | In-Process Teammate |
|------|----------|-------------------|
| 生命周期 | 短时任务 | 长期存在 |
| 通信方式 | 直接返回结果 | Mailbox 消息 |
| 上下文 | 继承父 | 独立上下文 |
| 并发 | 多个并行 | 单个运行 |
| 适用场景 | fork 子任务 | 团队协作 |`
      }
    ],
    keyTakeaways: [
      "Explore Agent被裁剪成只读专家，只能用Glob/Grep/FileRead",
      "Verification Agent的职责是'想办法搞坏它'，130行prompt",
      "实现者与验证者分离避免验证偏见",
      "Fork path通过CacheSafeParams复用父进程prompt cache",
      "createSubagentContext实现状态隔离，mutatable state全部克隆",
      "maxOutputTokens会破坏cache key，不能在fork中设置",
      "AsyncLocalStorage解决后台Agent并发时的上下文隔离",
      "Mailbox是文件-based消息队列，支持结构化协议消息",
      "In-Process Runner在同进程内运行Teammate，通过轮询收消息"
    ],
    relatedFiles: [
      "src/tools/AgentTool/AgentTool.tsx (1397行) - 调度总控",
      "src/tools/AgentTool/runAgent.ts (973行) - 子agent运行时",
      "src/tools/AgentTool/built-in/exploreAgent.ts - 探索agent",
      "src/tools/AgentTool/built-in/verificationAgent.ts - 验证agent",
      "src/utils/forkedAgent.ts - Fork工具函数",
      "src/tools/AgentTool/forkSubagent.ts - 隐式Fork机制",
      "src/utils/agentContext.ts - AsyncLocalStorage上下文",
      "src/utils/teammateMailbox.ts - Mailbox通信",
      "src/utils/swarm/inProcessRunner.ts - 同进程Runner"
    ]
  },

  s05: {
    intro: `安全不是一层铁板，而是三层互相配合但互不绕过的防护网。从 Bash 命令的风险分类，到 Hook 系统的灵活策略，再到最终的权限决策，每一层都有自己的职责边界。

**源码位置**：src/utils/permissions/ (27个文件), src/services/tools/toolHooks.ts (650行)

理解这套系统，才能理解 Claude Code 如何在让模型充分行动的同时保持对危险操作的控制。`,
    sections: [
      {
        title: "5.1 权限系统概览",
        content: `**src/utils/permissions/**

\`\`\`
27个文件管理完整权限模型：
├── PermissionMode.ts       - default/plan/auto等模式
├── PermissionRule.ts       - 规则定义(allow/deny/ask)
├── PermissionResult.ts      - 决策结果
├── bashClassifier.ts       - Bash命令风险分类
├── yoloClassifier.ts       - auto模式分类器
├── dangerousPatterns.ts     - 危险命令模式匹配
├── shellRuleMatching.ts    - Shell命令规则匹配
└── pathValidation.ts       - 文件路径校验
\`\`\`

**PermissionMode 模式**：
- **default**: 交互式确认
- **plan**: 计划模式，只读操作
- **auto**: 自动允许/拒绝`
      },
      {
        title: "5.2 Hook系统：Pre/Post/Failure三种时点",
        content: `**src/services/tools/toolHooks.ts**

三个时点：
\`\`\`typescript
runPreToolUseHooks()    // 工具执行前
runPostToolUseHooks()    // 工具执行成功后
runPostToolUseFailureHooks()  // 工具执行失败后
\`\`\`

**Pre-hook能做的事** (toolExecution.ts:800-861)：
\`\`\`typescript
switch (result.type) {
  case 'hookPermissionResult':
    hookPermissionResult = result.hookPermissionResult; break
  case 'hookUpdatedInput':
    processedInput = result.updatedInput; break  // 修改输入
  case 'preventContinuation':
    shouldPreventContinuation = result.shouldPreventContinuation; break
  case 'blockingError':
    return [{ message: createToolResultStopMessage(...) }]  // 直接阻断
  case 'additionalContext':
    resultingMessages.push(result.message); break  // 补充上下文
}
\`\`\`

**Post-hook能做的事**：
- 修改MCP工具输出
- 追加消息
- 注入上下文
- 触发继续/阻止继续`
      },
      {
        title: "5.3 resolveHookPermissionDecision：关键粘合层",
        content: `**src/services/tools/toolHooks.ts (Line 921-930)**

\`\`\`typescript
const resolved = await resolveHookPermissionDecision(
  hookPermissionResult,
  tool,
  processedInput,
  toolUseContext,
  canUseTool,
  assistantMessage,
  toolUseID,
)
const permissionDecision = resolved.decision
processedInput = resolved.input
\`\`\`

**核心规则**：

| Hook结果 | Settings规则 | 最终决策 |
|---------|-------------|---------|
| allow + 无updatedInput | 工具要求交互 | 仍走canUseTool |
| allow | settings有deny | deny生效 |
| allow | settings有ask | 仍弹窗 |
| deny | - | 直接deny |
| ask | - | 作为forceDecision传弹窗 |

**"强大但受控"设计**：

Hook有足够表达力做运行时策略调整，但不能绕开核心安全模型。即使Hook写了bug或被恶意利用，也不能让被settings deny的操作通过。`
      },
      {
        title: "5.4 三层防护网",
        content: `**防护层次**：

**Layer 1: Speculative Classifier**
\`\`\`typescript
// BashTool的风险分类器，在Hook执行同时并行运行
if (tool.name === 'BashTool') {
  startSpeculativeClassifierCheck(command, permissionContext, isNonInteractive)
}
\`\`\`
- 不阻塞主流程
- 提前开始异步计算
- 结果辅助权限决策

**Layer 2: Hook Policy Layer**
\`\`\`typescript
for await (const result of runPreToolUseHooks(...)) {
  // 可以做权限决策、修改输入、阻断流程
}
\`\`\`

**Layer 3: Permission Decision**
\`\`\`typescript
const resolved = await resolveHookPermissionDecision(...)
// 综合Hook结果、规则配置、用户交互
\`\`\`

**互不绕过原则**：
- Speculative结果只是辅助，不能绕过Hook
- Hook的allow不能绕过settings deny
- 每层有自己职责边界`
      }
    ],
    keyTakeaways: [
      "Hook系统支持Pre/Post/Failure三种时点",
      "resolveHookPermissionDecision定义'Hook不能绕过Settings deny'规则",
      "Speculative classifier提前预判但不阻断流程",
      "三层防护网：classifier → Hook → Permission Decision"
    ],
    relatedFiles: [
      "src/utils/permissions/ (27个文件) - 权限系统",
      "src/services/tools/toolHooks.ts (650行) - Hook系统",
      "src/tools/BashTool/bashPermissions.ts - Bash风险分类"
    ]
  },

  s06: {
    intro: `Skill是带元数据的workflow package。Plugin是模型行为层面的扩展。MCP是工具桥+行为说明注入。

**源码位置**：src/skills/ (17个bundled skills), src/utils/plugins/ (42个文件), src/services/mcp/ (23个文件)

但真正让生态发挥作用的关键，是让模型"感知到"自己的能力。`,
    sections: [
      {
        title: "6.1 Skill：17个bundled skills",
        content: `**src/skills/**

Skill形态是带frontmatter metadata的markdown文件：

\`\`\`yaml
---
name: verify
description: Verify changes work correctly
allowed-tools: [BashTool, WebFetchTool]
model: opus
effort: high
---
\`\`\`

**17个bundled skills**：
- verify - 验证变更
- commit - 提交代码
- loop - 循环执行
- simplify - 简化代码
- stuck - 处理卡住
- debug - 调试问题
- ... 等

**按需注入**：匹配到才注入，启动时不全部塞进去。`
      },
      {
        title: "6.2 Plugin：42个文件的完整链条",
        content: `**src/utils/plugins/**

\`\`\`
42个文件涵盖完整链条：
├── loader.ts         - 插件加载
├── validator.ts     - 插件验证
├── marketplace.ts   - 市场管理
└── ...
\`\`\`

**Plugin能力**：
- markdown commands 和 SKILL.md 目录
- hooks (Pre/PostToolUse)
- output styles
- MCP server 配置
- 模型和 effort hints
- 运行时变量替换 (\${CLAUDE_PLUGIN_ROOT})
- 自动更新、版本管理、blocklist

**Plugin vs 普通CLI插件**：

Plugin能影响模型行为：改变prompt、增加工具、修改权限规则。`
      },
      {
        title: "6.3 MCP：工具桥+行为说明注入",
        content: `**src/services/mcp/**

MCP server连接时，如果提供instructions，会被拼进system prompt：

\`\`\`typescript
// prompts.ts
if (mcpServer.instructions) {
  systemPrompt.push({
    type: 'text',
    text: mcpServer.instructions
  })
}
\`\`\`

**MCP的双重价值**：
1. 新工具（通过MCP协议注册）
2. 怎么用这些工具的说明（通过instructions注入prompt）

**模型不只知道"有这个工具"，还知道"什么时候该用、怎么用"。**`
      },
      {
        title: "6.4 生态关键：模型感知自己的能力",
        content: `**模型感知的通道**：

\`\`\`typescript
// 1. Skills列表
systemPrompt.push({ type: 'text', text: getSkillList() })

// 2. Agent列表
systemPrompt.push({ type: 'text', text: getAgentList() })

// 3. MCP instructions
if (mcpServer.instructions) {
  systemPrompt.push({ type: 'text', text: mcpServer.instructions })
}

// 4. Session-specific guidance
systemPrompt.push({ type: 'text', text: getSessionGuidance() })

// 5. Command integration
systemPrompt.push({ type: 'text', text: getCommandList() })
\`\`\`

**很多平台也有插件系统，但模型不知道什么时候该用哪个。**

Claude Code让模型看到自己的能力清单，这才是生态真正发挥作用的前提。`
      }
    ],
    keyTakeaways: [
      "MCP server提供工具+使用说明(instructions)",
      "Plugin能改变prompt、增加工具、修改权限规则",
      "Skill按需注入，不是全部塞进去",
      "模型感知到自己的能力，生态才能发挥作用"
    ],
    relatedFiles: [
      "src/skills/ (17个bundled skills)",
      "src/utils/plugins/ (42个文件)",
      "src/services/mcp/ (23个文件)"
    ]
  },

  s07: {
    intro: `每个Token都有成本，每条信息都占空间。Claude Code有四道压缩机制，确保在有限的上下文窗口里装最有用的信息。

**源码位置**：src/services/compact/ (11个文件), src/query/tokenBudget.ts

理解上下文经济学，才能理解为什么Claude Code在长会话里依然保持高效。`,
    sections: [
      {
        title: "7.1 四道压缩机制详解",
        content: `**src/services/compact/**

Claude Code采用"四道防线"的压缩策略，按需依次触发：

**第一道：Snip Compact（轻量级裁剪）**

\`\`\`typescript
// snipCompact.ts - 裁剪单条过长消息
interface SnipResult {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message  // 保留消息边界
}

// 策略：保留消息的头部和尾部，只裁剪中间过长部分
// 原因：对话的头尾可能包含关键上下文（任务描述、结论）
\`\`\`

**第二道：Micro Compact（缓存编辑优化）**

\`\`\`typescript
// microcompact.ts - 基于tool_use_id的增量压缩
interface MicrocompactResult {
  messages: Message[]
  compactionInfo?: {
    pendingCacheEdits: PendingCacheEdit[]  // 缓存编辑状态
  }
}

// 利用API的prompt cache机制
// 同一文件的编辑只传输delta，cache命中后只付token费
\`\`\`

**第三道：Context Collapse（区域折叠）**

\`\`\`typescript
// contextCollapse/ - 将不活跃区域折叠为摘要
interface CollapseResult {
  messages: Message[]
  summaryMessages: Message[]  // 摘要消息
  attachments: Attachment[]
  hookResults: HookResult[]
}

// 识别"沉默区"：超过N轮没有工具调用的对话段
// 折叠后保留：一个摘要消息 + 关键tool_result引用
\`\`\`

**第四道：Auto Compact（全量压缩）**

\`\`\`typescript
// autoCompact.ts - 触发阈值和熔断机制
const AUTOCOMPACT_BUFFER_TOKENS = 13_000
const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// 连续失败3次后停止重试，避免无效API调用
// 每个turn只尝试一次compact
\`\`\`

**压缩优先级原则**：先轻量(snip/micro)，后重量(collapse/auto)。

如果轻量压缩已经把token数压到阈值以下，重量压缩就不需要跑。`
      },
      {
        title: "7.2 Auto Compact阈值计算",
        content: `**src/services/compact/autoCompact.ts**

\`\`\`typescript
// 计算有效上下文窗口（减去输出预留）
export function getEffectiveContextWindowSize(model: string): number {
  const maxOutputTokens = getMaxOutputTokensForModel(model)

  // 为compact摘要预留输出空间（p99.99约17k tokens）
  const reservedTokens = Math.min(maxOutputTokens, 20_000)

  let contextWindow = getContextWindowForModel(model)

  // 可通过环境变量覆盖窗口大小
  const autoCompactWindow = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW
  if (autoCompactWindow) {
    contextWindow = Math.min(contextWindow, parseInt(autoCompactWindow))
  }

  return contextWindow - reservedTokens
}

// 触发阈值 = 有效窗口 - 13K buffer
export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}
\`\`\`

**Token预警状态机**：

\`\`\`typescript
calculateTokenWarningState(tokenUsage, model) {
  // 100% → 0%：剩余token百分比
  // isAboveWarningThreshold：进入预警区（剩余20K）
  // isAboveAutoCompactThreshold：触发自动压缩
  // isAtBlockingLimit：到达阻塞边界（剩余3K）
}
\`\`\``
      },
      {
        title: "7.3 Reactive Compact：413的兜底",
        content: `**src/services/compact/reactiveCompact.ts**

当四道防线都失败，API返回413时的最后一道保险：

\`\`\`typescript
interface ReactiveCompactParams {
  hasAttempted: boolean      // 防循环标记
  querySource: string
  aborted: boolean
  messages: Message[]
  cacheSafeParams: {...}
}

async tryReactiveCompact(params: ReactiveCompactParams): Promise<Compacted | null> {
  // 关键：每个turn只尝试一次
  if (params.hasAttempted) {
    return null
  }

  // 紧急压缩：用更强的策略一次性压到位
  const compacted = await performEmergencyCompact(params.messages)
  if (compacted) {
    return compacted
  }

  return null  // 失败则上报错误，不再重试
}
\`\`\`

**防循环设计**：

| 机制 | 作用 |
|-----|------|
| hasAttempted | 每个turn只尝试一次 |
| consecutiveFailures计数器 | 连续3次失败后熔断 |
| 兜底策略 | 紧急压缩使用更强力的摘要策略 |

**为什么需要兜底**？

即使正确计算了token预算，历史消息的复杂度、工具结果的累积、thinking内容的膨胀，都可能导致实际token使用超出预期。413是最后的预警信号。`
      },
      {
        title: "7.3 Token Budget：+500k Auto-Continue",
        content: `**src/query/tokenBudget.ts**

\`\`\`typescript
interface BudgetTracker {
  checkTokenBudget(
    tracker: BudgetTracker,
    agentId: string | undefined,
    currentBudget: number,
    turnOutput: number
  ): BudgetDecision
}

interface BudgetDecision {
  action: 'continue' | 'stop' | 'nudge'
  continuationCount: number
  nudgeMessage?: string
}
\`\`\`

**nudge message示例**：
\`\`\`
Token budget nearly exhausted. Continue working efficiently.
Do NOT stop to summarize. Complete remaining work in minimal steps.
\`\`\`

**使用场景**：用户指定 "+500k" 目标，系统追踪每个turn的输出token，接近目标时自动继续。`
      },
      {
        title: "7.4 其他上下文优化",
        content: `**Skill按需注入**
\`\`\`typescript
// 只有匹配到的skill才注入
if (taskMatchesSkill(task, skill)) {
  systemPrompt.push(getSkillContent(skill))
}
\`\`\`

**MCP instructions按连接状态注入**
\`\`\`typescript
for (const server of mcpServers) {
  if (server.connected && server.instructions) {
    systemPrompt.push({ text: server.instructions })
  }
}
\`\`\`

**Memory prefetch (query.ts:301-304)**
\`\`\`typescript
using pendingMemoryPrefetch = startRelevantMemoryPrefetch(
  state.messages,
  state.toolUseContext,
)
// 在模型流式输出的同时预取可能相关的memory
\`\`\`

**Tool result budget (utils/toolResultStorage.ts)**
\`\`\`typescript
if (result.size > maxResultSizeChars) {
  // 持久化到磁盘，只保留摘要
  const summary = await createSummary(result.data)
  return { summary, storedPath: saveToDisk(result.data) }
}
\`\`\``
      },
      {
        title: "7.5 Cron Scheduler：分布式锁防重复执行",
        content: `**src/utils/cronScheduler.ts**

计划任务调度器，支持一次性/周期性任务：

\`\`\`typescript
// 分布式锁防止多session重复执行同一任务
isOwner = await tryAcquireSchedulerLock(lockOpts)
if (!isOwner) {
  // 非owner定期probe接管
  lockProbeTimer = setInterval(() => {
    tryAcquireSchedulerLock(lockOpts).then(owned => {
      if (owned) isOwner = true  // 前owner崩溃后接管
    })
  }, LOCK_PROBE_INTERVAL_MS)
}
\`\`\`

**关键设计**：
- 基于 .claude/scheduled_tasks.json 持久化
- 支持jittered next fire防止 :00 时刻雪崩
- 一次性任务过期后自动删除，周期性任务支持maxAge
- 错过的任务在启动时通知用户`
      },
      {
        title: "7.6 conversationRecovery：对话中断检测与恢复",
        content: `**src/utils/conversationRecovery.ts**

**中断检测算法**：

\`\`\`typescript
function detectTurnInterruption(messages: NormalizedMessage[]): InternalInterruptionState {
  const lastMessage = messages.findLastIndex(m => m.type !== 'system' && m.type !== 'progress')

  if (lastMessage.type === 'assistant') {
    return { kind: 'none' }  // assistant结尾=正常完成
  }

  if (lastMessage.type === 'user') {
    if (lastMessage.isMeta || lastMessage.isCompactSummary) {
      return { kind: 'none' }
    }
    if (isToolUseResultMessage(lastMessage)) {
      // brief模式(SendUserMessage结尾)是正常完成，不是中断
      if (isTerminalToolResult(lastMessage, messages, lastMessageIdx)) {
        return { kind: 'none' }
      }
      return { kind: 'interrupted_turn' }
    }
    return { kind: 'interrupted_prompt', message: lastMessage }
  }
}
\`\`\`

**关键设计**：
- filterUnresolvedToolCalls() 过滤未完成的工具调用
- filterOrphanedThinkingOnlyMessages() 处理流式输出中孤立的thinking消息
- 中断后注入 "Continue from where you left off." 合成消息`
      },
      {
        title: "7.7 Session Memory Compact：基于会话记忆的压缩",
        content: `**src/services/compact/sessionMemoryCompact.ts**

Session Memory Compact 是一种实验性的压缩策略，利用已提取的会话记忆来指导压缩：

\`\`\`typescript
interface SessionMemoryCompactParams {
  minTokens: number         // 最少10,000 tokens才触发
  minTextBlockMessages: number  // 最少5条文本消息
  maxTokens: number         // 最多保留40,000 tokens
}

async function sessionMemoryCompact(
  messages: Message[],
  context: ToolUseContext
): Promise<CompactResult | null> {
  // 1. 检查是否满足触发条件
  if (!hasMetTokenThreshold(currentTokenCount)) return null
  if (!hasMetMessageCountThreshold(messages)) return null

  // 2. 获取会话记忆
  const sessionMemory = await extractSessionMemory(messages)
  if (!sessionMemory) return null  // 记忆为空则回退到传统压缩

  // 3. 计算保留消息索引
  const keepIndex = calculateMessagesToKeepIndex(messages, sessionMemory)

  // 4. 保留关键消息：记忆 + 最近消息 + 工具调用对
  const preservedMessages = [
    ...sessionMemory.messages,
    ...messages.slice(keepIndex)
  ]

  // 5. 重建工具调用对完整性
  return ensureToolUsePairsIntact(preservedMessages)
}
\`\`\`

**与 Full Compact 的对比**：

| 特性 | Full Compact | Session Memory Compact |
|------|-------------|----------------------|
| 触发条件 | Token超阈值 | Token + 消息数双阈值 |
| 摘要方式 | AI全量摘要 | 依赖已有会话记忆 |
| 适用场景 | 通用 | 有清晰会话目标的场景 |
| 回退策略 | N/A | 记忆为空时回退传统压缩 |`
      },
      {
        title: "7.8 Message Grouping：按 API Round 分组",
        content: `**src/services/compact/grouping.ts**

压缩前需要找到安全的截断点。Claude Code 按 API round 进行消息分组：

\`\`\`typescript
interface ApiRound {
  roundId: number
  messages: Message[]
  startIdx: number
  endIdx: number
}

// 识别 API round 边界：assistant 消息结尾
function groupMessagesByApiRound(messages: Message[]): ApiRound[] {
  const rounds: ApiRound[] = []
  let currentRound: Message[] = []
  let roundId = 0

  for (const msg of messages) {
    currentRound.push(msg)

    // Assistant 消息结尾 = 一个 API round 的结束
    if (msg.type === 'assistant') {
      rounds.push({
        roundId: roundId++,
        messages: [...currentRound],
        startIdx: rounds.length > 0
          ? rounds[rounds.length - 1].endIdx + 1
          : 0,
        endIdx: messages.indexOf(msg)
      })
      currentRound = []
    }
  }

  return rounds
}
\`\`\`

**为什么按 API Round 分组很重要？**

\`\`\`typescript
// 工具调用必须成对：tool_use + tool_result
// 如果在中间截断，会导致孤立的 tool_use

// 错误示例：
// [user] → [assistant: tool_use(id=1)] → [截断!] → [tool_result(id=1)]
//                              ↑ 缺少 tool_result，API 会报错

// 正确示例：按 round 截断
// [user] → [assistant: tool_use(id=1)] → [截断] → [user]
// 保证：每个 tool_use 都有对应的 tool_result
\`\`\`

**Compact Boundary Message**：

\`\`\`typescript
// 压缩后插入边界标记
const boundaryMessage = createCompactBoundaryMessage({
  originalMessageCount: messages.length,
  preservedMessageCount: preserved.length,
  summary: summarizeContent(excisedMessages),
  timestamp: Date.now()
})
\`\`\``
      },
      {
        title: "7.9 图片剥离与摘要策略",
        content: `**src/services/compact/compact.ts**

压缩本身也可能触发 413！图片和文档在压缩摘要过程中会成为负担：

\`\`\`typescript
async function compactConversation(params: CompactParams): Promise<CompactResult> {
  // Step 1: 剥离图片内容
  const messagesWithoutImages = await stripImagesFromMessages(params.messages)

  // Step 2: 如果剥离后仍然过长，继续剥离文档
  const messagesWithoutMedia = await stripDocumentsIfNeeded(
    messagesWithoutImages,
    maxTokens
  )

  // Step 3: 剩余内容进行摘要
  const summary = await generateCompactSummary(messagesWithoutMedia)

  return {
    summary,
    attachments: params.attachments,  // 保留附件引用
    hookResults: params.hookResults     // 保留 Hook 结果
  }
}
\`\`\`

**图片标记策略**：

\`\`\`typescript
// 替换为占位符标记
const IMAGE_REPLACEMENT = '[image]'
const DOCUMENT_REPLACEMENT = '[document]'

// 标记保留原始信息引用
interface MediaMarker {
  type: 'image' | 'document'
  originalIndex: number
  size?: number
  path?: string  // 如果已持久化到磁盘
}
\`\`\`

**Post-Compact 恢复机制**：

\`\`\`typescript
// 压缩后恢复关键上下文
async function buildPostCompactMessages(params: PostCompactParams) {
  const { summary, boundaryMessage, messagesToKeep } = params

  // 1. 重新附加最近的文件读取结果（最多5个）
  const recentFileReads = await restoreRecentFileReads(
    messagesToKeep,
    POST_COMPACT_MAX_FILES_TO_RESTORE,
    POST_COMPACT_MAX_TOKENS_PER_FILE
  )

  // 2. 重新附加 skill 内容（最多25k tokens）
  const skillContent = await restoreSkillContent(
    messagesToKeep,
    POST_COMPACT_SKILLS_TOKEN_BUDGET,
    POST_COMPACT_MAX_TOKENS_PER_SKILL
  )

  // 3. 组合最终消息
  return [
    boundaryMessage,
    summary,
    ...recentFileReads,
    ...skillContent,
    ...messagesToKeep,
    ...params.attachments,
    ...params.hookResults
  ]
}
\`\`\``
      },
      {
        title: "7.10 Token 计数：估算与实际",
        content: `**src/services/tokenEstimation.ts**

Token 计数是压缩决策的基础。Claude Code 使用估算而非精确计数：

\`\`\`typescript
// 从 API 响应获取精确 token 使用
interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation?: number   // 缓存创建 token
  cache_read?: number       // 缓存读取 token
}

// 估算新消息的 token 数
function estimateTokenCount(message: Message): number {
  // 1. 基础：字符串长度 / 4（中文约 2 chars/token）
  const baseEstimate = message.content.length / 4

  // 2. 工具调用加权
  if (message.type === 'tool_use') {
    return baseEstimate + TOOL_USE_OVERHEAD
  }

  // 3. thinking block 加权
  if (message.thinking) {
    return baseEstimate + THINKING_OVERHEAD
  }

  return baseEstimate
}

// 合并精确计数 + 估算
function tokenCountWithEstimation(
  messages: Message[],
  lastUsage: TokenUsage | null
): number {
  if (lastUsage) {
    // 使用 API 返回的精确计数
    return lastUsage.input_tokens +
           lastUsage.cache_creation +
           lastUsage.cache_read +
           lastUsage.output_tokens +
           estimateNewMessages(messages)
  }

  // 没有精确计数，全用估算
  return messages.reduce((sum, msg) => sum + estimateTokenCount(msg), 0)
}
\`\`\`

**缓存 Token 的特殊处理**：

\`\`\`typescript
// 缓存 Token 不占上下文窗口（但有上限）
// 1M context 模型：最多 900k 缓存
// 200K context 模型：最多 180k 缓存

const CACHE_RATIO_LIMIT = 0.9

function calculateEffectiveContextUsed(tokenUsage: TokenUsage): number {
  const { input_tokens, cache_read, cache_creation } = tokenUsage

  // cache_read 是免费的（命中缓存）
  // cache_creation 是首次创建的成本
  const effectiveUsed = input_tokens + cache_creation

  return effectiveUsed
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "四道压缩：Snip → Micro → Collapse → Auto",
      "Priority: 先轻量后重量",
      "Reactive compact是413的兜底，有防循环设计",
      "Token budget实现长任务自动继续",
      "Memory/Skill prefetch在模型输出时并行进行",
      "Cron Scheduler用分布式锁防重复执行",
      "conversationRecovery检测对话中断并智能恢复",
      "Session Memory Compact利用已有记忆指导压缩",
      "按API Round分组确保tool_use/tool_result配对完整",
      "图片在压缩前剥离，防止摘要时再次超限",
      "Token计数用API精确值+新消息估算的混合方案"
    ],
    relatedFiles: [
      "src/services/compact/ (11个文件) - 压缩系统",
      "src/query/tokenBudget.ts - Token预算",
      "src/utils/toolResultStorage.ts - 结果持久化",
      "src/utils/cronScheduler.ts - 计划任务调度器",
      "src/utils/conversationRecovery.ts - 对话恢复",
      "src/services/compact/sessionMemoryCompact.ts - 记忆压缩",
      "src/services/tokenEstimation.ts - Token估算"
    ]
  },

  s08: {
    intro: `把前面所有模块看完之后，可以归纳出7条设计原则。这些不是空洞的口号，每一条都有对应的源码实现做支撑。

理解这些原则，才能真正理解Claude Code为什么这样设计，而不是那样设计。`,
    sections: [
      {
        title: "原则1：不信任模型的自觉性",
        content: `**好行为要写成制度**

\`\`\`typescript
// getSimpleDoingTasksSection() 的核心内容
const rules = [
  "Don't add features the user didn't ask for",
  "Don't over-abstract",
  "Don't add comments to code you didn't change",
  "Read code before modifying it",
  "Report results honestly"
]
\`\`\`

**prompt里的行为规范 + runtime层的权限检查 = 制度化行为**`
      },
      {
        title: "原则2：把角色拆开",
        content: `**至少分离"做事的人"和"验收的人"**

\`\`\`
Explore Agent - 只读，不能修改任何文件
Verification Agent - "try to break it"
Plan Agent - 只规划，不执行
\`\`\`

**同一个Agent既实现又验证，天然倾向于觉得自己做得没问题。**
职责拆开会有明显改善。`
      },
      {
        title: "原则3：工具调用要有治理",
        content: `**14步pipeline确保工具调用安全可控**

\`\`\`
1. Zod schema校验
2. 工具特定校验
3. Speculative classifier
4. PreToolUse hooks
5. 权限决策
6. 输入修正
7. 执行tool.call()
8. 结果处理
9. PostToolUse hooks
10. OTel日志
11. ...
14. PostToolUseFailure hooks
\`\`\`

**治理决定了系统在异常情况下的表现。**`
      },
      {
        title: "原则4：上下文是预算",
        content: `**每个token都有成本**

\`\`\`typescript
// SYSTEM_PROMPT_DYNAMIC_BOUNDARY
// 静态部分放前面，缓存命中率更高

// fork path优化
const forkContext = {
  systemPrompt: mainContext.systemPrompt,  // 复用cache
  ...
}
\`\`\`

**能缓存的缓存，能按需加载的不一开始就塞，能压缩的压缩。**`
      },
      {
        title: "原则5：安全层要互不绕过",
        content: `**三层防护网**

\`\`\`
Layer 1: Speculative Classifier - 提前预判
Layer 2: Hook Policy Layer - 策略决策
Layer 3: Permission Decision - 最终决策
\`\`\`

**resolveHookPermissionDecision的规则**：
- Hook allow + settings deny → deny生效
- Hook allow + settings ask → 仍弹窗
- Hook deny → 直接生效

**即使某一层出问题，整体安全性不会崩塌。**`
      },
      {
        title: "原则6：生态的关键是模型感知",
        content: `**扩展机制的最后一步是让模型看到自己的能力**

\`\`\`typescript
// 让模型感知到的通道
const感知Channels = [
  getSkillList(),           // skills列表
  getAgentList(),           // agents列表
  getMcpInstructions(),      // MCP instructions
  getSessionGuidance(),      // session引导
  getCommandList()           // 命令列表
]
\`\`\`

**给系统接10个插件，但模型不知道什么时候用，等于不存在。**`
      },
      {
        title: "原则7：产品化在于处理第二天",
        content: `**runAgent.ts的cleanup chain**

\`\`\`typescript
// 完整的生命周期清理
cleanupAgentTracking(agentId)      // 清理跟踪状态
killShellTasksForAgent(agentId)      // 杀掉shell进程
cleanupSessionHooks(agentId)         // 清理session hooks
cloneFileStateCache(agentId)         // 清理克隆的文件状态
removeTodos(agentId)               // 清理todos entry
disconnectMcpConnections(agentId)    // 断开MCP连接
\`\`\`

**长任务中断怎么续？脏状态怎么清？进程泄漏怎么办？session怎么恢复？**

这些问题不解决，产品就只能是Demo。`
      }
    ],
    keyTakeaways: [
      "好行为写成制度，不依赖模型自觉",
      "职责分离：做事者与验收者分开",
      "工具调用14步pipeline确保安全可控",
      "安全层互不绕过，三层各司其职",
      "上下文是预算，能缓存/压缩的就不塞",
      "生态关键是让模型感知自己的能力",
      "产品化 = 处理第二天的问题"
    ],
    relatedFiles: [
      "src/constants/prompts.ts - 行为规范",
      "src/services/tools/toolExecution.ts - 14步pipeline",
      "src/services/tools/toolHooks.ts - 安全层",
      "src/tools/AgentTool/runAgent.ts - 生命周期清理"
    ]
  },

  s09: {
    intro: `Session 是 Claude Code 的记忆宫殿，MCP 是通往外部世界的桥梁，Plugin 是能力的延伸，Skill 是行为的封装。

理解这四个模块，才能理解 Claude Code 如何在保持核心简洁的同时实现无限扩展。

**源码位置**：src/utils/sessionStorage.ts (4500+行), src/services/mcp/ (23文件), src/utils/plugins/ (42文件), src/skills/ (17个bundled skills)`,
    sections: [
      {
        title: "9.1 Session 持久化：JSONL Transcript",
        content: `**src/utils/sessionStorage.ts**

Session 以 JSONL 格式存储在 ~/.claude/projects/<项目路径>/

\`\`\`typescript
// 每条消息是一个 TranscriptMessage
type TranscriptMessage = {
  uuid: string           // 唯一消息ID
  parentUuid: string    // 父消息ID，形成链
  sessionId: string
  cwd: string
  timestamp: string
  version: string
  gitBranch?: string
  // 消息内容: user/assistant/system/attachment
}

// 写入：追加模式
appendEntryToFile(sessionId, message)

// 读取：解析 JSONL
loadMessageLogs(sessionId)
\`\`\`

**parentUuid 链**：消息通过 parentUuid 形成链表，buildConversationChain() 从叶节点回溯到根再反转，保证顺序。

**Lite Log 优化**：列表页只读文件头尾各 65KB，提取 firstPrompt、customTitle、tag 等元信息，避免加载完整历史。`
      },
      {
        title: "9.2 对话恢复：中断检测算法",
        content: `**src/utils/conversationRecovery.ts**

**中断检测核心逻辑** (detectTurnInterruption):

\`\`\`typescript
// 找最后一个相关消息
const lastMessageIdx = messages.findLastIndex(m =>
  m.type !== 'system' && m.type !== 'progress'
)

// assistant 结尾 = 正常完成
if (lastMessage.type === 'assistant') {
  return { kind: 'none' }
}

// user + tool_result (Brief模式) = 正常完成
if (isTerminalToolResult(lastMessage)) {
  return { kind: 'none' }
}

// user + tool_result (非Brief) = 中断
if (lastMessage.type === 'user' && isToolResultMessage(lastMessage)) {
  return { kind: 'interrupted_turn' }
}

// user 纯文本 = 中断（CC还没开始响应）
if (lastMessage.type === 'user' && !lastMessage.isMeta) {
  return { kind: 'interrupted_prompt' }
}
\`\`\`

**恢复时注入合成消息**："Continue from where you left off."

**反序列化流水线**：

\`\`\`
deserializeMessagesWithInterruptDetection()
├── migrateLegacyAttachmentTypes()  // 旧格式迁移
├── filterUnresolvedToolUses()     // 移除不完整的tool_use
├── filterOrphanedThinkingOnlyMessages()  // 孤立thinking块
├── filterWhitespaceOnlyAssistantMessages()  // 空输出
└── detectTurnInterruption()      // 核心检测
\`\`\``
      },
      {
        title: "9.3 MCP 系统架构：工具桥接",
        content: `**src/services/mcp/client.ts**

MCP (Model Context Protocol) 将外部工具桥接到 Claude Code：

\`\`\`typescript
// MCP 工具名格式
mcp__\${normalizedServerName}__\${normalizedToolName}
// 例如: mcp__github__create_issue

// 连接时覆盖 MCPTool 的属性
const tool = {
  ...MCPTool,
  name: fullyQualifiedName,
  mcpInfo: { serverName, toolName },
  isMcp: true
}
\`\`\`

**支持的传输类型**：

| 传输 | 用途 |
|------|------|
| stdio | 子进程 stdin/stdout |
| sse | Server-Sent Events over HTTP |
| streamable-http | HTTP 流式 |
| websocket | WebSocket |
| sdk | 同进程 SDK 通信 |

**连接状态机**：

\`\`\`
pending → connected → failed
         ↘ needs-auth ↗
         ↘ disabled
\`\`\``
      },
      {
        title: "9.4 MCP 指令注入：Delta 追踪",
        content: `**src/utils/mcpInstructionsDelta.ts**

MCP 服务器的 instructions 通过附件持久化追踪：

\`\`\`typescript
// 计算增量
getMcpInstructionsDelta(connectedServers, announcedServers) {
  // 返回: addedNames, addedBlocks, removedNames
}

// 指令来源
1. Server-authored: InitializeResult.instructions (握手时提供)
2. Client-side: synthesize (如 claude-in-chrome)
\`\`\`

**Prompt 集成**：

\`\`\`typescript
// prompts.ts
function getMcpInstructionsSection(mcpClients) {
  return getMcpInstructions()  // 返回格式化指令文本
}

// 使用 DANGEROUS_uncachedSystemPromptSection
// 因为 MCP server 可能连接/断开，指令会变化
\`\`\``
      },
      {
        title: "9.5 Plugin 系统：5大扩展点",
        content: `**src/utils/plugins/**

Plugin 是 Claude Code 能力的扩展容器：

\`\`\`
my-plugin/
├── .claude-plugin/plugin.json    # 清单
├── commands/                     # 自定义 slash commands
│   └── build.md
├── agents/                       # 自定义 agents
│   └── test-runner.md
├── skills/                       # Skills
│   └── my-skill/SKILL.md
├── hooks/                        # Hook 配置
│   └── hooks.json
├── output-styles/                # 输出样式
└── .mcp.json                    # MCP 服务器
\`\`\`

**5大扩展点**：

1. **Commands** - markdown 文件定义 slash commands
2. **Agents** - 自定义 agent，带 tools/color/model 配置
3. **Skills** - 带 frontmatter 的 workflow 封装
4. **Hooks** - PreToolUse/PostToolUse 等事件处理
5. **Output Styles** - 响应格式化定制

**Hook 类型**：command / prompt / agent / http`
      },
      {
        title: "9.6 Plugin 市场与自动更新",
        content: `**src/utils/plugins/marketplaceManager.ts**

Plugin 市场支持多种来源：

\`\`\`typescript
type MarketplaceSource =
  | { source: 'github', repo: string }
  | { source: 'git', url: string }
  | { source: 'npm', package: string }
  | { source: 'file', path: string }
  | { source: 'directory', path: string }
  | { source: 'settings', inline: PluginManifest }
\`\`\`

**自动更新机制**：

\`\`\`typescript
// 启动时检查开启了 autoUpdate 的市场
// Anthropic 官方市场默认 autoUpdate: true
// 通过 GCS 镜像加速更新

pluginAutoupdate.checkAndUpdate(plugin, marketplace)
\`\`\`

**存储结构**：

\`\`\`
~/.claude/plugins/
├── known_marketplaces.json    # 市场注册表
├── installed_plugins.json    # 已安装插件
└── marketplaces/             # 市场缓存
    └── github-marketplace/
        └── .claude-plugin/
            └── marketplace.json
\`\`\``
      },
      {
        title: "9.7 Skill 系统：17个bundled skills",
        content: `**src/skills/bundledSkills.ts**

Skill 是带 frontmatter 的 markdown 封装：

\`\`\`yaml
---
name: verify
description: Verify changes work correctly
allowed-tools: [BashTool, WebFetchTool]
model: opus
effort: high
---
# Skill content here
\`\`\`

**Skill 定义结构**：

\`\`\`typescript
type BundledSkillDefinition = {
  name: string
  description: string
  whenToUse?: string       // 自动匹配依据
  allowedTools?: string[]   // 工具白名单
  model?: string           // 指定模型
  context?: 'inline' | 'fork'  // 执行模式
  getPromptForCommand: (args, context) => Promise<ContentBlockParam[]>
}
\`\`\`

**执行模式**：

| 模式 | 行为 |
|------|------|
| inline | 内容展开到当前对话 |
| fork | 在隔离子 agent 中运行，有独立 token 预算 |`
      },
      {
        title: "9.8 Skill 匹配：模型自主决策",
        content: `**没有自动匹配算法**

Skill 匹配是模型根据描述自主决策的：

\`\`\`typescript
// SkillTool 的 prompt 告诉模型：
// "Available skills are listed in system-reminder messages"
// "When a skill matches, invoke Skill tool BEFORE generating response"
// "NEVER mention a skill without actually calling this tool"
\`\`\`

**条件激活**：

\`\`\`typescript
// 带 paths 的 skill 只在匹配文件时激活
// 使用 gitignore 风格的模式匹配
if (skill.paths && matchesPath(skill.paths, touchedFile)) {
  activateSkill(skill)
}
\`\`\`

**bundled skills 示例**：

| Skill | 用途 |
|-------|------|
| verify | 验证代码变更 (ANT only) |
| simplify | 代码审查，启动3个并行 review agents |
| batch | 跨5-30个隔离 worktree 并行变更 |
| loop | 周期性任务调度 |
| debug | 诊断会话问题 |`
      },
      {
        title: "9.9 Skill 执行：参数替换与变量",
        content: `**src/skills/loadSkillsDir.ts**

Skill 内容处理流水线：

\`\`\`typescript
// 1. 追加 base directory
finalContent = \`Base directory: \${baseDir}\\n\\n\${content}\`

// 2. 替换参数占位符
finalContent = substituteArguments(content, args, ...)

// 3. 替换技能目录变量
finalContent = content.replace(/\\$\\{CLAUDE_SKILL_DIR\\}/g, skillDir)

// 4. 替换会话ID
finalContent = content.replace(/\\$\\{CLAUDE_SESSION_ID\\}/g, sessionId)

// 5. 执行内联 shell 命令 (\`...\`)
finalContent = executeShellCommandsInPrompt(content)
\`\`\`

**内置 Skill 示例 (simplify)**：

\`\`\`typescript
// 同时启动3个并行 review agents
// 1. Reuse Agent - 检查重复和抽象
// 2. Quality Agent - 检查质量和错误
// 3. Efficiency Agent - 检查性能
\`\`\``
      },
      {
        title: "9.10 MCP + Plugin + Skill 协作",
        content: `**三者如何配合**

\`\`\`
Plugin                    MCP Server
├── hooks/               ├── tools/list
├── commands/            ├── tools/call
├── skills/             └── resources/list
└── .mcp.json
\`\`\`

**典型场景**：

1. **Plugin 提供 MCP 服务器配置**
   \`\`\`json
   { "mcpServers": { "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] } } }
   \`\`\`

2. **MCP 工具暴露给 Claude Code**
   - 通过 mcp__github__create_issue 调用

3. **Skill 封装复杂工作流**
   - skill 调用 MCP 工具 + 内置工具
   - 批量操作、循环、条件判断

**扩展优先级**：

| 扩展方式 | 适用场景 |
|----------|----------|
| MCP | 连接现有外部工具/API |
| Plugin | 添加新能力（hooks/commands/agents） |
| Skill | 封装重复性 workflow |`
      }
    ],
    keyTakeaways: [
      "Session 以 JSONL + parentUuid 链存储，支持快速列表和完整恢复",
      "中断检测基于消息类型判断：Brieff模式tool_result正常，否则中断",
      "MCP 通过标准化传输连接外部工具，桥接为 mcp__server__tool 格式",
      "MCP 指令用 Delta 追踪增量，支持高效的跨 turn 更新",
      "Plugin 是能力扩展容器，支持 5 大扩展点",
      "Plugin 市场支持多种来源，自动更新通过 GCS 加速",
      "Skill 是 markdown 封装，模型根据描述自主决策是否使用",
      "Skill 支持 inline/fork 两种执行模式",
      "MCP + Plugin + Skill 形成完整的扩展生态"
    ],
    relatedFiles: [
      "src/utils/sessionStorage.ts (4500+行) - Session 持久化",
      "src/utils/conversationRecovery.ts - 中断检测算法",
      "src/services/mcp/client.ts (3300+行) - MCP 客户端",
      "src/utils/mcpInstructionsDelta.ts - 指令增量追踪",
      "src/utils/plugins/pluginLoader.ts - 插件加载",
      "src/utils/plugins/marketplaceManager.ts - 市场管理",
      "src/skills/bundledSkills.ts - Bundled Skills 注册",
      "src/skills/loadSkillsDir.ts - Skill 加载与执行"
    ]
  },

  s10: {
    intro: `Claude Code 的基础设施三大件：CLI 入口、状态管理、TUI 渲染。理解这三者，才能理解一个交互式应用是如何从零启动到持续运行的。

**源码位置**：src/entrypoints/cli.tsx, src/main.tsx (238KB), src/state/ (状态管理), src/ink/ (TUI渲染)

这章不是讲"做什么"，而是讲"怎么连起来"。`,
    sections: [
      {
        title: "10.1 CLI 入口：Fast-Path 分发",
        content: `**src/entrypoints/cli.tsx**

CLI 入口的核心思想是：**特殊标志走快速路径，主流程才加载完整模块**。

\`\`\`typescript
// Fast-path：零模块加载
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  console.log(\`\${MACRO.VERSION} (Claude Code)\`);
  return;  // 直接返回，不加载 main.tsx
}

// Fast-path：MCP 服务器
if (args[0] === '--claude-in-chrome-mcp') { ... }

// Fast-path：Daemon 模式
if (args[0] === 'daemon') { ... }

// 没有特殊标志？加载完整主模块
const { main: cliMain } = await import('../main.js');
await cliMain();
\`\`\`

**所有 Fast-Path 标志**：

| 标志 | 行为 |
|------|------|
| --version / -v | 输出版本，退出 |
| --dump-system-prompt | 输出 system prompt，退出 |
| --claude-in-chrome-mcp | 启动 Chrome MCP |
| --computer-use-mcp | 启动 computer use MCP |
| daemon [sub] | 守护进程模式 |
| ps\|logs\|attach\|kill | Session 管理 |
| new\|list\|reply | 模板作业命令 |
| remote-control / rc | Bridge 模式 |

**为什么这样设计？**

\`-v\` 是最常用标志，如果每次都加载 238KB 的 main.tsx，响应会慢 500ms+。`
      },
      {
        title: "10.2 main.tsx：命令分发与初始化",
        content: `**src/main.tsx (238KB)**

main.tsx 是整个应用的核心，分三个阶段：

**阶段1：早期初始化 (main 函数)**

\`\`\`typescript
export async function main() {
  // 安全：防止 Windows PATH 劫持
  process.env.NoDefaultCurrentDirectoryInExePath = '1';

  initializeWarningHandler();

  // 处理 deep link (cc://)、SSH 远程
  // 处理 \`claude assistant [sessionId]\`

  const isNonInteractive = hasPrintFlag || !process.stdout.isTTY;
  setIsInteractive(!isNonInteractive);
  initializeEntrypoint(isNonInteractive);

  await run();  // 进入命令分发
}
\`\`\`

**阶段2：命令分发 (run 函数)**

\`\`\`typescript
async function run(): Promise<CommanderCommand> {
  const program = new CommanderCommand()

  // preAction：在任何命令执行前运行
  program.hook('preAction', async () => {
    await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()]);
    await init();  // 核心初始化
    runMigrations();
  });

  // 定义所有 CLI 选项和子命令...
  // -p, --print 非交互输出
  // -c, --continue 继续对话
  // -r, --resume [sessionId] 恢复会话
  // --model, --agent 模型/Agent 选择
  // --permission-mode 权限模式
  // ...

  await program.parseAsync(process.argv);
}
\`\`\`

**阶段3：交互式 vs 非交互式**

\`\`\`typescript
if (isNonInteractiveSession) {
  // 非交互：headless 模式
  const { runHeadless } = await import('src/cli/print.js');
  void runHeadless(inputPrompt, store.getState, store.setState, ...);
  return;
}

// 交互式：创建 Ink TUI
const { createRoot } = await import('./ink.js');
root = await createRoot(ctx.renderOptions);
await showSetupScreens(root, ...);  // 信任对话框、OAuth
initializeLspServerManager();       // LSP 初始化
await launchRepl(root, ...);        // 启动 REPL
\`\`\``
      },
      {
        title: "10.3 初始化流水线：init → setup → REPL",
        content: `**src/entrypoints/init.ts**

\`init()\` 是备忘录化的，只运行一次：

\`\`\`typescript
export const init = memoize(async (): Promise<void> => {
  enableConfigs();
  applySafeConfigEnvironmentVariables();
  setupGracefulShutdown();

  // 1P 事件日志 (OpenTelemetry)
  // OAuth 账户信息
  // JetBrains IDE 检测
  // 远程托管设置加载
  // 记录首次启动时间
  // 配置全局 mTLS 设置
  // 配置全局 HTTP agents (proxy)
  // 预连接 Anthropic API (~100-200ms 重叠)
  // 设置 git-bash (Windows)
  // 注册 LSP manager 清理
  // 初始化 scratchpad 目录
});
\`\`\`

**setup.ts 任务**：

\`\`\`typescript
const setupPromise = setup(preSetupCwd, permissionMode, allowDangerouslySkipPermissions, ...);

// 并行运行
// - 检查 Node.js 版本 >= 18
// - 启动 UDS 消息服务器
// - 捕获 teammate 模式快照
// - 恢复终端备份 (iTerm2, Terminal.app)
// - 初始化 session memory
// - 初始化文件变更监听器
// - 检查 release notes
// - 创建 worktree (--worktree)
// - 创建 tmux session (--tmux)
\`\`\`

**启动流程图**：

\`\`\`
cli.tsx
  ├─ Fast-path (--version, daemon, etc.)
  └─ main.tsx::main()
          ├─ init() [once per session]
          ├─ run()
          │   └─ program.parseAsync()
          │       └─ action handler
          │           ├─ setup()
          │           ├─ getCommands() + getAgentDefinitions()
          │           ├─ MCP config resolution
          │           │
          │           ├─ NON-INTERACTIVE (-p)
          │           │   └─ runHeadless()
          │           │
          │           └─ INTERACTIVE
          │               ├─ createRoot() [ink.js]
          │               ├─ showSetupScreens()
          │               └─ launchRepl()
          │                   └─ <App><REPL/></App>
          └─ gracefulShutdown
\`\`\``
      },
      {
        title: "10.4 状态管理：自定义 Store 模式",
        content: `**src/state/store.ts**

Claude Code 使用**自定义 Store**，不是 Zustand：

\`\`\`typescript
// 基于 React useSyncExternalStore
export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return  // 浅比较，相同则跳过
      state = next
      onChange?.({ newState: next, oldState: prev })
      listeners.forEach(listener => listener())
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
\`\`\`

**为什么不用 Zustand？**

这个实现更轻量，直接适配 React 18 的 useSyncExternalStore，没有额外抽象层。`
      },
      {
        title: "10.5 AppState：状态切片结构",
        content: `**src/state/AppStateStore.ts**

\`\`\`typescript
export type AppState = DeepImmutable<{
  // 核心设置和 UI
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  statusLineText: string | undefined
  expandedView: 'none' | 'tasks' | 'teammates'

  // 任务管理
  tasks: { [taskId: string]: TaskState }
  agentNameRegistry: Map<string, AgentId>
  foregroundedTaskId?: string

  // MCP 和插件
  mcp: { clients, tools, commands, resources, pluginReconnectKey }
  plugins: { enabled, disabled, commands, errors, installationStatus }

  // UI 状态
  notifications: { current, queue }
  elicitation: { queue }
  activeOverlays: ReadonlySet<string>

  // 推测执行 (prompt prediction)
  speculation: SpeculationState
  promptSuggestion: { text, promptId, shownAt, acceptedAt }

  // 团队上下文
  teamContext?: { teamName, teammates, selfAgentId, ... }
  inbox: { messages: Array<{id, from, text, timestamp, status}> }

  // 权限
  toolPermissionContext: ToolPermissionContext
}>
\`\`\`

**关键设计：消息不在 AppState**

消息存储在**各个 TaskState 对象**中，不是全局 AppState：

\`\`\`typescript
// LocalAgentTaskState
interface LocalAgentTaskState {
  messages?: Message[]  // 在 TaskState 里，不在 AppState
  // ...
}

// AppState 只有任务引用
tasks: { [taskId: string]: TaskState }
\`\`\`

这样设计是因为每个 Agent/Teammate 有独立的消息历史。`
      },
      {
        title: "10.6 状态访问：useAppState 模式",
        content: `**src/state/AppState.tsx**

三个核心 Hook：

\`\`\`typescript
// 订阅某个 slice，只在值变化时重渲染
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  return useSyncExternalStore(store.subscribe, get, get)
}

// 获取 setState 但不订阅
export function useSetAppState() {
  return useAppStore().setState
}

// 获取原始 store（非 React 代码用）
export function useAppStateStore(): AppStateStore {
  return useAppStore()
}
\`\`\`

**使用模式**：

\`\`\`typescript
// 推荐：独立字段多次调用
const verbose = useAppState(s => s.verbose)
const model = useAppState(s => s.mainLoopModel)

// 推荐：选择已有子对象
const { text, promptId } = useAppState(s => s.promptSuggestion)

// 避免：每次创建新对象（会导致不必要重渲染）
const { a, b } = useAppState(s => ({ a: s.a, b: s.b }))
\`\`\`

**onChangeAppState 副作用处理**：

\`\`\`typescript
// 任何状态变化都会触发
onChangeAppState: ({ newState, oldState }) => {
  // 权限模式同步到 CCR/SDK
  // 设置持久化到全局配置
  // 清除 API key、AWS、GCP 凭证缓存
  // 当 settings.env 变化时重新应用环境变量
}
\`\`\``
      },
      {
        title: "10.7 TUI 框架：Ink 渲染原理",
        content: `**src/ink/ink.tsx**

Ink 是基于 React 的 TUI 框架，用 Yoga (flexbox) 做布局：

\`\`\`
React 组件变化 → Reconciler 提交 → onComputeLayout() → scheduleRender() → onRender() → Frame → Diff → 终端
\`\`\`

**渲染循环**：

\`\`\`typescript
// scheduleRender：节流渲染
scheduleRender = throttle(deferredRender, FRAME_INTERVAL_MS)

// onRender：每次提交后产生 Frame
onRender() {
  const frame = this.renderer()  // 从 Yoga 布局计算
  const diff = LogUpdate.diff(prevFrame, frame)  // Diff 只写变化的单元格
  term.write(diff)
}
\`\`\`

**Frame 数据结构**：

\`\`\`typescript
type Frame = {
  readonly screen: Screen      // 单元格缓冲区
  readonly viewport: Size      // 终端尺寸
  readonly cursor: Cursor     // 光标位置
  readonly scrollHint?: ScrollHint  // DECSTBM 滚动优化
}
\`\`\``
      },
      {
        title: "10.8 消息渲染：MessageRow 分发",
        content: `**src/components/messages/**

消息渲染链：

\`\`\`
MessageRow.tsx → Message.tsx → AssistantTextMessage / UserToolResultMessage / ...
\`\`\`

**消息类型分发**：

\`\`\`typescript
// MessageRow 根据 type 分发到正确组件
switch (message.type) {
  case 'assistant':
    if (message.content.some(c => c.type === 'tool_use')) {
      return <AssistantToolUseMessage message={message} />
    }
    return <AssistantTextMessage message={message} />
  case 'user':
    return <UserTextMessage message={message} />
  // ...
}
\`\`\`

**工具结果渲染**：

\`\`\`
Tool Result → UserToolResultMessage → tool.renderToolResultMessage() → React Components
\`\`\`

每个 Tool 实现 \`renderToolResultMessage()\` 自定义输出格式。`
      },
      {
        title: "10.9 用户输入：事件捕获链",
        content: `**src/ink/hooks/use-input.ts**

输入处理链：

\`\`\`
终端输入 → useInput() hook → dispatcher.ts → 组件 props
\`\`\`

**useInput 使用示例 (REPL.tsx)**：

\`\`\`typescript
useInput((input, key) => {
  // input: 字符串输入
  // key: { upArrow, downArrow, delete, return, ... }

  if (key.return) {
    submitInput()  // 提交输入
  } else if (key.ctrl && input === 'c') {
    interrupt()     // 中断
  } else if (key.upArrow) {
    historyPrev()   // 命令历史上一条
  }
})
\`\`\`

**事件传播**：

\`\`\`typescript
// dispatcher.ts 支持捕获/冒泡阶段
dispatcher.dispatch(event, { phase: 'capture' | 'bubble' })

// 组件通过 props 声明处理的事件
<Box onKeyDown={handleKeyDown} />
\`\`\``
      },
      {
        title: "10.10 状态与渲染的连接",
        content: `**三者如何协作**

\`\`\`
状态变化 (setState)
    │
    ├─→ onChangeAppState() 副作用处理
    │
    └─→ React 重渲染
            │
            ├─→ useAppState() 订阅的组件更新
            │
            └─→ Ink reconciler 计算新布局
                    │
                    └─→ Frame diff → 终端输出
\`\`\`

**关键连接点**：

| 连接 | 机制 |
|------|------|
| 状态 → UI | React useSyncExternalStore 订阅 |
| UI → 状态 | useSetAppState() |
| 工具 → 状态 | ToolUseContext.getAppState/setAppState |
| 子 Agent → 状态 | setAppStateForTasks (穿透嵌套) |
| 外部 → 状态 | React Context (AppStateProvider) |

**REPL 启动流程**：

\`\`\`typescript
await launchRepl(root, appProps, replProps, renderAndRun)

// launchRepl 内部：
const { App } = await import('./components/App.js');
const { REPL } = await import('./screens/REPL.js');

await renderAndRun(root,
  <App {...appProps}>
    <REPL {...replProps} />
  </App>
);
\`\`\`

**sessionConfig 传递给 REPL**：

\`\`\`typescript
const sessionConfig = {
  commands,
  initialTools,
  mcpClients,
  systemPrompt,
  appendSystemPrompt,
  taskListId,
  thinkingConfig,
  onTurnComplete: (messages) => {
    void uploaderReady.then(uploader => uploader?.(messages));
  }
};
\`\`\``
      }
    ],
    keyTakeaways: [
      "CLI 入口用 Fast-Path 避免无用模块加载，-v 响应 < 10ms",
      "main.tsx 分三阶段：早期初始化 → 命令分发 → 交互/非交互",
      "init() 备忘录化保证只运行一次，setup() 做运行时准备",
      "自定义 Store 基于 useSyncExternalStore，比 Zustand 更轻",
      "消息存储在 TaskState，不在全局 AppState",
      "useAppState 用浅比较跳过无变化更新",
      "Ink 用 Yoga 做布局，Frame diff 只写变化的单元格",
      "状态 → React → Ink reconciler → 终端输出"
    ],
    relatedFiles: [
      "src/entrypoints/cli.tsx - CLI 快速入口",
      "src/main.tsx (238KB) - 主应用入口",
      "src/entrypoints/init.ts - 初始化",
      "src/state/store.ts - Store 实现",
      "src/state/AppStateStore.ts - AppState 定义",
      "src/state/AppState.tsx - 状态 Hook",
      "src/ink/ink.tsx - Ink TUI 框架",
      "src/components/messages/ - 消息渲染",
      "src/screens/REPL.tsx - REPL 屏幕"
    ]
  },

  s11: {
    intro: `支撑模块决定系统健壮性。日志、网络、配置、认证，这些看似边角的模块，却是生产环境的最后一道防线。

**源码位置**：src/utils/log.ts, src/utils/http.ts, src/utils/settings/, src/utils/auth.ts

这章讲的不是功能，是让系统"不出事"的机制。`,
    sections: [
      {
        title: "11.1 日志系统：Sink 模式与错误环缓冲",
        content: `**src/utils/log.ts**

日志系统的核心是** Sink 模式** + **启动前事件队列**：

\`\`\`typescript
// 问题：启动早期错误在 sink 设置前就发生了
// 解决：先队列，启动后一次性排出

let errorLogSink: ErrorLogSink | null = null
const queuedEvents: LogEvent[] = []

export function attachErrorLogSink(newSink: ErrorLogSink): void {
  if (errorLogSink !== null) return  // 只允许设置一次
  errorLogSink = newSink
  // 立即排出队列中的事件
  for (const event of queuedEvents) {
    errorLogSink(event)
  }
}

// 启动前调用：加入队列
export function logEvent(event: LogEvent): void {
  if (errorLogSink !== null) {
    errorLogSink(event)  // 已有 sink，直接写
  } else {
    queuedEvents.push(event)  // 还在启动，排队
  }
}
\`\`\`

**错误环缓冲**：

\`\`\`typescript
const ERROR_RING_BUFFER_SIZE = 100
const errorRingBuffer = new CircularBuffer<ErrorEntry>(ERROR_RING_BUFFER_SIZE)

// 内存中保留最近 100 条错误，供调试使用
\`\`\``
      },
      {
        title: "11.2 网络层：认证头与 OAuth 重试",
        content: `**src/utils/http.ts**

网络层的核心是**认证头自动注入**和 **401 重试刷新 Token**：

\`\`\`typescript
export function getAuthHeaders(): AuthHeaders {
  if (isClaudeAISubscriber()) {
    // OAuth 用户：用 Bearer Token
    return {
      headers: {
        Authorization: \`Bearer \${oauthTokens.accessToken}\`,
        'anthropic-beta': OAUTH_BETA_HEADER
      }
    }
  }
  // API Key 用户：用 x-api-key
  return {
    headers: { 'x-api-key': getAnthropicApiKey() }
  }
}
\`\`\`

**401 重试刷新**：

\`\`\`typescript
// 当 API 返回 401，可能是因为 clock drift
// 自动刷新 token 后重试
async function fetchWithRetry(url, options) {
  const response = await fetch(url, options)
  if (response.status === 401) {
    await refreshOAuthToken()  // 刷新
    return fetch(url, options)  // 重试
  }
  return response
}
\`\`\``
      },
      {
        title: "11.3 配置系统：多源合并与优先级",
        content: `**src/utils/settings/settings.ts**

配置来自多个源，按优先级合并：

\`\`\`
优先级从低到高：
1. 默认值
2. User 配置 (~/.claude/settings.json)
3. Project 配置 (.claude/settings.json)
4. Local 配置 (.claude/settings.local.json)
5. Policy 配置 (托管设置 + drop-ins)
6. Flag 覆盖 (命令行参数)
\`\`\`

**合并逻辑**：

\`\`\`typescript
// 使用 lodash mergeWith，数组用 concat 而非覆盖
const result = mergeWith({}, base, override, (obj, src) => {
  if (Array.isArray(src)) {
    return [...(obj || []), ...src]  // 数组拼接
  }
})

// 会话级缓存避免重复 I/O
const getSettingsWithErrors = memoize(() => {
  return loadSettingsFromDisk()
})
\`\`\``
      },
      {
        title: "11.4 认证系统：凭证链与文件锁",
        content: `**src/utils/auth.ts**

认证支持多种来源，按序查找：

\`\`\`typescript
// 认证来源优先级
const authSourceChain = [
  process.env.CLAUDE_CODE_API_KEY,      // 1. 环境变量
  process.env.ANTHROPIC_API_KEY,         // 2. 旧环境变量
  keychain.read('anthropic'),            // 3. Keychain
  settings.json.apiKey,                   // 4. 配置文件
  apiKeyHelper.read()                   // 5. 辅助程序
]

export const getAnthropicApiKey = memoize(() => {
  for (const source of authSourceChain) {
    if (source) return source
  }
  throw new Error('No API key found')
})
\`\`\`

**OAuth Token 刷新文件锁**：

\`\`\`typescript
// 防止多个进程同时刷新 token
const refreshLock = await fs.mlock('oauth-refresh.lock')
try {
  const tokens = await refreshOAuthToken()
  await saveOAuthToken(tokens)
} finally {
  await refreshLock.unlock()
}
\`\`\``
      },
      {
        title: "11.5 远程连接：分层架构",
        content: `**src/bridge/**

远程连接采用分层架构：

\`\`\`
bridge/
├── bridgeMain.ts      # 主入口
├── remoteBridgeCore.ts  # 核心逻辑
├── replBridge.ts     # REPL 桥接
├── bridgeMessaging.ts  # 消息协议
└── bridgeTransport.ts # 传输层
\`\`\`

**核心功能**：
- WebSocket 远程 session
- JWT 处理和刷新
- 权限桥接（远程权限透传）
- Session 生命周期管理`
      },
      {
        title: "11.6 LSP 集成：工厂函数模式",
        content: `**src/services/lsp/**

LSP 使用**工厂函数**而非类：

\`\`\`typescript
// 工厂函数返回闭包封装的 LSP 实例
export function createLSPClient(
  serverName: string,
  onCrash?: (error: Error) => void
): LSPClient {
  let process: ChildProcess | undefined
  let connection: MessageConnection | undefined

  return {
    start: async () => { /* 启动进程 */ },
    initialize: async (params) => { /* 发送 initialize 请求 */ },
    sendRequest: async (method, params) => { /* JSON-RPC 请求 */ },
    sendNotification: (method, params) => { /* 通知 */ },
    onNotification: (method, handler) => { /* 订阅通知 */ },
    onRequest: (method, handler) => { /* 订阅请求 */ },
    stop: () => { /* 清理 */ }
  }
}
\`\`\`

**文件变更同步**：

\`\`\`typescript
// LSP 服务器需要知道文件打开/编辑/保存/关闭
lspClient.sendNotification('textDocument/didOpen', { uri, text })
lspClient.sendNotification('textDocument/didChange', { uri, changes })
lspClient.sendNotification('textDocument/didSave', { uri })
lspClient.sendNotification('textDocument/didClose', { uri })
\`\`\``
      }
    ],
    keyTakeaways: [
      "日志 Sink 模式确保启动早期错误不丢失",
      "错误环缓冲保留最近 100 条供调试",
      "网络层自动注入认证头，401 自动刷新 OAuth",
      "配置多源合并，数组用 concat 而非覆盖",
      "认证来源链：env → keychain → config → helper",
      "OAuth 刷新用文件锁防止并发",
      "LSP 用工厂函数封装状态而非类"
    ],
    relatedFiles: [
      "src/utils/log.ts - 日志系统",
      "src/utils/http.ts - 网络层",
      "src/utils/settings/settings.ts - 配置系统",
      "src/utils/auth.ts - 认证系统",
      "src/bridge/ - 远程连接",
      "src/services/lsp/ - LSP 集成"
    ]
  }
};
