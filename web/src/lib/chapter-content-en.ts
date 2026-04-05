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

export const CHAPTER_CONTENT_EN: Record<string, ChapterContent> = {
  s01: {
    intro: `At the heart of Claude Code lies an elegant while loop. From the moment you type a command in the terminal, to the model understanding your intent, executing tools, and returning results — the entire chain runs through this loop. Understanding it is understanding half of Claude Code.

This loop isn't not simply "ask one question, get one answer." It's state-driven: each iteration passes context through a state object, accumulates conversation history through messages[], and decides whether to continue or exit based on stop_reason.

**Source Location**: src/query.ts (1730 lines)

query.ts is the heart of the entire system, an async generator with a while(true) loop inside. The code comments explicitly state there are 9 different continue points, each corresponding to a different reason for "why run another round."`,
    sections: [
      {
        title: "2.1 How a Request Runs",
        content: `The path from cli.tsx to final model response:

1. cli.tsx dispatches to main.tsx
2. main.tsx initializes state, registers tools, constructs ToolUseContext
3. User input enters the query() function
4. query() enters queryLoop(), a while(true) main loop
5. Each iteration: compress context → assemble system prompt → call model API → process tool calls → continue or exit

**Key Files:**
- src/cli.tsx - CLI entry
- src/main.tsx - Main application (4683 lines)
- src/query.ts - Main loop (1730 lines)
- src/QueryEngine.ts - Query engine (1295 lines)`
      },
      {
        title: "2.2 query.ts: A State Machine with 9 Continue Points",
        content: `**State object carrying cross-iteration state (query.ts:204-217):**

\`\`\`typescript
type State = {
  messages: Message[]                    // Message history
  toolUseContext: ToolUseContext        // Tool context
  autoCompactTracking: AutoCompactTrackingState | undefined  // Auto compact state
  maxOutputTokensRecoveryCount: number  // Output token recovery count
  hasAttemptedReactiveCompact: boolean // Whether reactive compact attempted
  maxOutputTokensOverride: number | undefined  // Max output token override
  pendingToolUseSummary: Promise | undefined  // Pending tool summary
  stopHookActive: boolean | undefined  // Stop hook active flag
  turnCount: number                    // Turn count
  transition: Continue | undefined       // Why the last turn continued
}
\`\`\`

**9 Continue Points (state transition reasons):**

1. **model_fallback** (Line 950) - Switch to fallback model when degraded
2. **collapse_drain_retry** (Line 1115) - Context collapse drain retry
3. **reactive_compact_retry** (Line 1165) - Reactive compact retry after 413
4. **max_output_tokens_escalate** (Line 1220) - Output token limit escalation (8k→64k)
5. **max_output_tokens_recovery** (Line 1251) - Output token limit recovery
6. **stop_hook_blocking** (Line 1305) - Stop hook blocking continuation
7. **token_budget_continuation** (Line 1340) - Token budget insufficient
8. **next_turn** (Line 1725) - Normal next turn (has tool results)

**Why while(true) + state instead of recursion?**

Early versions used recursive calls. But recursion blows the stack in long sessions. The while(true) + state object design uses continue for each state transition. State is clear, no stack overflow.`
      },
      {
        title: "2.3 Four Compaction Mechanisms",
        content: `**Compaction Priority (query.ts:396-447):**

Each iteration, the message list goes through four compaction stages:

**1. Snip Compact** (Line 401-410) - Truncates overly long historical messages
\`\`\`typescript
if (feature('HISTORY_SNIP')) {
  const snipResult = snipModule!.snipCompactIfNeeded(messagesForQuery)
  messagesForQuery = snipResult.messages
  snipTokensFreed = snipResult.tokensFreed
}
\`\`\`

**2. Micro Compact** (Line 413-426) - Cache-based edits via tool_use_id
\`\`\`typescript
const microcompactResult = await deps.microcompact(messagesForQuery, toolUseContext, querySource)
messagesForQuery = microcompactResult.messages
\`\`\`

**3. Context Collapse** (Line 440-447) - Folds inactive context regions into summaries
\`\`\`typescript
if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
  const collapseResult = await contextCollapse.applyCollapsesIfNeeded(messagesForQuery, ...)
  messagesForQuery = collapseResult.messages
}
\`\`\`

**4. Auto Compact** (Line 453-543) - Full compression when token count approaches threshold
\`\`\`typescript
const { compactionResult, consecutiveFailures } = await deps.autocompact(messagesForQuery, ...)
if (compactionResult) {
  logEvent('tengu_auto_compact_succeeded', {...})
  tracking = { compacted: true, turnId: deps.uuid(), turnCounter: 0, consecutiveFailures: 0 }
}
\`\`\`

**Priority Principle**: Do lightweight ones first (snip, micro), then heavy ones (collapse, auto). If lightweight compression already压到阈值以下, heavy compression doesn't need to run.`
      },
      {
        title: "2.4 Streaming Tool Execution",
        content: `**StreamingToolExecutor** (query.ts:561-568, src/services/tools/StreamingToolExecutor.ts)

Traditional approach waits for model to fully output all tool_use blocks, then executes together. Claude Code optimized: while model is still outputting, completed tool_use blocks start executing.

\`\`\`typescript
const useStreamingToolExecution = config.gates.streamingToolExecution
let streamingToolExecutor = useStreamingToolExecution
  ? new StreamingToolExecutor(toolUseContext.options.tools, canUseTool, toolUseContext)
  : null
\`\`\`

**Execution Flow (query.ts:1366-1408):**
\`\`\`typescript
if (streamingToolExecutor) {
  // Streaming: execute while receiving
  logEvent('tengu_streaming_tool_execution_used', { tool_count: toolUseBlocks.length, ... })
} else {
  // Traditional batch execution
  logEvent('tengu_streaming_tool_execution_not_used', { tool_count: toolUseBlocks.length, ... })
}

const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()
  : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)
\`\`\`

**Performance Impact**: If there are 5 tool calls, traditional approach waits for model output completion (5-30 seconds) then executes; in streaming mode, first tool finishes while model is still generating the second tool_use.`
      },
      {
        title: "2.5 Token Budget and +500k Auto-Continue",
        content: `**src/query/tokenBudget.ts**

When user specifies a token target (e.g., "+500k"), system tracks each turn's output tokens, injects nudge message when approaching target to let model continue.

\`\`\`typescript
const budgetTracker = feature('TOKEN_BUDGET') ? createBudgetTracker() : null

// Check token budget
if (feature('TOKEN_BUDGET')) {
  const decision = checkTokenBudget(budgetTracker!, toolUseContext.agentId, ...)
  if (decision.action === 'continue') {
    incrementBudgetContinuationCount()
    // Inject continue message
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

**Nudge message example**:
"Token budget nearly exhausted. Continue working efficiently - do not stop or summarize."`
      },
      {
        title: "2.6 Reactive Compact: Insurance for API 413",
        content: `**src/services/compact/reactiveCompact.ts**

If four compaction mechanisms can't reduce token count enough and API returns 413 (prompt too long), triggers reactive compact mechanism.

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
    // Compact succeeded, retry
    state = {
      ...state,
      hasAttemptedReactiveCompact: true,
      transition: { reason: 'reactive_compact_retry' }
    }
    continue
  }
}
\`\`\`

**Loop Protection**: hasAttemptedReactiveCompact flag ensures each turn only attempts once.`
      },
      {
        title: "2.7 Session Memory: Background Automatic Summary Extraction",
        content: `**src/services/SessionMemory/**

Session Memory is a background service that automatically maintains session notes, deeply integrated into context:

\`\`\`typescript
// sessionMemory.ts core logic
export function shouldExtractMemory(messages: Message[]): boolean {
  // Both thresholds must be met simultaneously to trigger extraction
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)
  const hasMetToolCallThreshold = toolCallsSinceLastUpdate >= getToolCallsBetweenUpdates()

  // Or: no tool call and token threshold met (natural conversation gap)
  const shouldExtract = (hasMetTokenThreshold && hasMetToolCallThreshold) ||
                       (hasMetTokenThreshold && !hasToolCallsInLastTurn)
}
\`\`\`

**Key Design**:
- Uses runForkedAgent() to fork a sub-agent in background for extraction, doesn't block main conversation
- Only triggers when both tool call count and token count thresholds are met
- Registered as postSamplingHook, runs automatically after model response
- Restricted to editing memory files only via createMemoryFileCanUseTool()`
      },
      {
        title: "2.8 Agent Summary: 30-Second Interval Fork Progress Summary",
        content: `**src/services/AgentSummary/agentSummary.ts**

Forks a sub-agent every 30 seconds to generate a 1-2 sentence progress summary:

\`\`\`typescript
const SUMMARY_INTERVAL_MS = 30_000

function buildSummaryPrompt(previousSummary: string | null): string {
  return \`Describe your most recent action in 3-5 words using present tense (-ing).
Name the file or function, not the branch. Do not use tools.
Good: "Reading runAgent.ts"
Good: "Fixing null check in validate.ts"\`
}
\`\`\`

**Key Design**:
- Leverages main thread's prompt cache (skip maxOutputTokens to keep cache key consistent)
- Rejects tool calls via canUseTool callback
- Used for UI to display agent real-time progress
- Summary format: git-commit style, concise and powerful`
      },
      {
        title: "2.9 forkedAgent: Cache Sharing and Sub-Agent Isolation",
        content: `**src/utils/forkedAgent.ts**

**CacheSafeParams Design**:

\`\`\`typescript
// Cache key parameters must be exactly consistent
export type CacheSafeParams = {
  systemPrompt: SystemPrompt      // Must be exactly consistent
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext  // tools, model must be consistent
  forkContextMessages: Message[]  // messages prefix must be consistent
}

// Key: Cannot set maxOutputTokens, otherwise will change budget_tokens causing cache miss
// "DO NOT set maxOutputTokens here. The fork piggybacks on the main
// thread's prompt cache by sending identical cache-key params"
\`\`\`

**Sub-Agent Isolation Mechanism**:

\`\`\`typescript
export function createSubagentContext(parentContext, overrides?): ToolUseContext {
  return {
    readFileState: cloneFileStateCache(...),    // Cloned, not shared
    abortController: createChildAbortController(...),  // Child controller linked to parent
    getAppState: () => ({
      ...parentContext.getAppState(),
      toolPermissionContext: {
        ...state.toolPermissionContext,
        shouldAvoidPermissionPrompts: true  // Sub-agent doesn't pop permission dialogs
      }
    }),
    // Mutation callbacks all set to no-op
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
  }
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "while(true) + state object replaces recursion, avoids stack overflow",
      "9 continue points, each corresponds to a reason for running another round",
      "Four compaction mechanisms: Snip → Micro → Collapse → Auto",
      "Streaming Tool Execution lets tools execute in parallel while model outputs",
      "Token Budget implements auto-continue for long tasks",
      "Reactive Compact is insurance for 413, has loop protection",
      "Session Memory auto-extracts summaries without blocking main conversation",
      "Agent Summary forks every 30s for real-time progress updates"
    ],
    relatedFiles: [
      "src/query.ts (1730 lines) - Main loop state machine",
      "src/QueryEngine.ts (1295 lines) - Query engine",
      "src/main.tsx (4683 lines) - Main application entry",
      "src/query/tokenBudget.ts - Token budget system",
      "src/services/compact/reactiveCompact.ts - Reactive compaction",
      "src/services/tools/StreamingToolExecutor.ts - Streaming tool execution",
      "src/services/SessionMemory/ - Session memory service",
      "src/services/AgentSummary/ - Agent progress summary service",
      "src/utils/forkedAgent.ts - Fork sub-agent utility"
    ]
  },

  s02: {
    intro: `If query.ts is the loop engine, then prompts.ts is the assembly engine. Claude Code's system prompt isn't a single string, but a precision assembly machine: static parts are cacheable, dynamic parts are injected based on state, separated by a magical marker in the middle.

**Source Location**: src/constants/prompts.ts (914 lines)

Understanding the prompt assembly mechanism is key to understanding Claude Code's behavioral control.`,
    sections: [
      {
        title: "2.4 Prompt Assembly: SYSTEM_PROMPT_DYNAMIC_BOUNDARY",
        content: `**src/constants/prompts.ts**

getSystemPrompt() returns an array of strings, each element corresponding to a section. Separated in the middle by SYSTEM_PROMPT_DYNAMIC_BOUNDARY:

\`\`\`typescript
const fullSystemPrompt = asSystemPrompt(
  appendSystemContext(systemPrompt, systemContext)
)
\`\`\`

**Static Parts (cacheable) - before boundary:**
- Identity positioning: getSimpleIntroSection
- System operation specs: getSimpleSystemSection
- Task behavior specs: getSimpleDoingTasksSection
- Risky action specs: getActionsSection
- Tool usage syntax: getUsingYourToolsSection
- Tone and style: getSimpleToneAndStyleSection
- Output efficiency: getOutputEfficiencySection

**Dynamic Parts (injected by session) - after boundary:**
- Session guidance (currently enabled tools)
- Memory (CLAUDE.md content)
- Environment info (OS, shell, cwd, model name)
- Language preferences, output style
- MCP server instructions
- Token budget instructions

**Cache Optimization Principle**: API can cache system prompt prefix. If two requests have identical prefix (byte-level), second skips prefix processing. Putting unchanging content first and variable content later improves cache hit rate.`
      },
      {
        title: "2.5 getSimpleDoingTasksSection: The Most Valuable Behavior Spec",
        content: `**src/constants/prompts.ts**

getSimpleDoingTasksSection() might be the most valuable part of the entire prompt. Source code comment says it's "the most useful section":

**Discouraged behaviors:**
- Don't add features user didn't ask for
- Don't over-abstract; three lines of duplicate code is better than one immature abstraction
- Don't add comments or docstrings to code you didn't change
- Don't add unnecessary error handling or fallback logic
- Don't design future-proof abstractions
- Don't casually create new files
- Don't give time estimates

**Encouraged behaviors:**
- Read code before modifying it
- When a method fails, diagnose first, don't blindly retry
- Report results honestly; don't say you've run something you haven't

**Why does this matter?**

Anyone who's used other coding agents has encountered: you ask it to fix a bug, it顺手 refactors half the file; you ask it to add one feature, it adds three layers of abstraction and five error handling cases.

The root cause is that model behavior isn't constrained. Claude Code's approach: write behavioral specs as rules, don't rely on model's situational judgment.`
      },
      {
        title: "2.6 Prompt Section Registry Cache Mechanism",
        content: `**src/constants/systemPromptSections.ts**

Dynamic parts of sections aren't recalculated every time:

\`\`\`typescript
// Create cacheable section
const section = systemPromptSection({
  id: 'memory',
  content: () => getMemoryContent(),
  // Only DANGEROUS marked ones recalculate every time
})

// MCP instructions use DANGEROUS version
const mcpInstructions = DANGEROUS_uncachedSystemPromptSection({
  id: 'mcp-instructions',
  content: () => getMcpInstructions()
})
\`\`\`

**Cache Invalidation**: /clear or /compact commands

**Why MCP uses DANGEROUS**: MCP servers may connect or disconnect between turns, instructions content changes.`
      }
    ],
    keyTakeaways: [
      "System prompt divides into static (cacheable) and dynamic (state-injected) parts",
      "SYSTEM_PROMPT_DYNAMIC_BOUNDARY is key to cache optimization",
      "Behavioral specs should be written as rules, not relying on model initiative",
      "Prompt Section Registry implements fine-grained cache control"
    ],
    relatedFiles: [
      "src/constants/prompts.ts (914 lines) - System prompt assembly",
      "src/constants/systemPromptSections.ts - Section cache mechanism",
      "src/utils/systemPromptType.ts - Type definitions"
    ]
  },

  s03: {
    intro: `42 tools, a 14-step governance pipeline. The tool system is the boundary of Claude Code's capabilities, and also the last line of defense for security risks.

**Source Location**: src/Tool.ts (30308 bytes), src/services/tools/toolExecution.ts (1745 lines)

The core idea: tool calls aren't simply "model says call, then call." They go through input validation, permission checks, risk prediction, and failure handling.`,
    sections: [
      {
        title: "3.1 Tool.ts: 10+ Method Interface",
        content: `**src/Tool.ts**

Key methods of Tool interface:

\`\`\`typescript
interface Tool {
  // Execution
  call(input: any, context: ToolUseContext, ...): Promise<ToolResult>

  // Input validation
  inputSchema: ZodSchema  // Zod schema definition
  validateInput?(input: any, context: ToolUseContext): ValidationResult

  // Permissions
  checkPermissions?(input: any, context: ToolUseContext): PermissionResult
  preparePermissionMatcher?(input: any): PermissionMatcher

  // Classification
  isReadOnly(): boolean           // Is read-only
  isDestructive(): boolean        // Is destructive
  isConcurrencySafe(): boolean     // Is concurrency-safe

  // Description
  prompt(context: ToolUseContext): string  // Dynamically generate description

  // Observability
  backfillObservableInput?(input: any): void
  toAutoClassifierInput(): CompactRepresentation

  // Render methods (6+)
  render*(...)  // Display, progress, results, errors, rejections, grouping
}
\`\`\`

**buildTool() fail-closed defaults:**
\`\`\`typescript
isConcurrencySafe: () => false  // Default unsafe, serial execution
isReadOnly: () => false        // Default writes, strict permission check
checkPermissions: () => 'allow' // Delegate to common permission system
\`\`\`

"Strict when forgotten" design prevents dangerous operations from slipping through.`
      },
      {
        title: "3.2 Tool Execution Pipeline: 14 Steps Detailed",
        content: `**src/services/tools/toolExecution.ts**

**Step 1-2: Find Tool (runToolUse, Line 337-410)**
\`\`\`typescript
let tool = findToolByName(toolUseContext.options.tools, toolName)
if (!tool) {
  // Try finding via alias (old version name compatibility)
  const fallbackTool = findToolByName(getAllBaseTools(), toolName)
  if (fallbackTool?.aliases?.includes(toolName)) {
    tool = fallbackTool
  }
}
\`\`\`

**Step 3: Zod Schema Validation (Line 614-680)**
\`\`\`typescript
const parsedInput = tool.inputSchema.safeParse(input)
if (!parsedInput.success) {
  return [{ message: createUserMessage({
    content: [{ type: 'tool_result', content: \`InputValidationError: ...\` }]
  })]
}
\`\`\`

**Step 4: Tool-Specific Validation (Line 682-733)**
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

**Step 7: Permission Decision (Line 921-1104)**
\`\`\`typescript
const resolved = await resolveHookPermissionDecision(
  hookPermissionResult, tool, processedInput, toolUseContext, canUseTool, ...
)
const permissionDecision = resolved.decision
processedInput = resolved.input
\`\`\`

**Step 8: Input Correction (Line 1128-1132)**
\`\`\`typescript
if (permissionDecision.updatedInput !== undefined) {
  processedInput = permissionDecision.updatedInput
}
\`\`\`

**Step 9: Execute tool.call() (Line 1207-1222)**
\`\`\`typescript
const result = await tool.call(callInput, { ...toolUseContext, toolUseId: toolUseID }, canUseTool, assistantMessage, progress => {...})
\`\`\`

**Step 10: Result Processing (Line 1227-1380)**
\`\`\`typescript
const mappedToolResultBlock = tool.mapToolResultToToolResultBlockParam(result.data, toolUseID)
const toolResultStr = jsonStringify(result.data)
endToolSpan(toolResultStr)
\`\`\`

**Step 11-12: OTel Logging (Line 1376-1395, 1371-1380)**
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
        title: "3.3 Classification of 42 Tools",
        content: `**src/tools/ directory**

By functionality:

**File Operations (6):**
- FileReadTool - Read files
- FileEditTool - Edit files
- FileWriteTool - Write files
- GlobTool - File pattern matching
- GrepTool - Content search
- NotebookEditTool - Jupyter notebook editing

**Shell Execution (2):**
- BashTool - Bash command execution
- PowerShellTool - PowerShell command execution

**Agent Scheduling (6):**
- AgentTool - Agent orchestration
- TaskCreateTool, TaskGetTool, TaskListTool, TaskUpdateTool, TaskStopTool - Task management

**MCP Integration (4):**
- MCPTool - MCP protocol tools
- ListMcpResourcesTool, ReadMcpResourceTool - MCP resource access
- McpAuthTool - MCP authentication

**Web Capabilities (2):**
- WebSearchTool - Web search
- WebFetchTool - Web fetch

**User Interaction (2):**
- AskUserQuestionTool - Ask user questions
- SendMessageTool - Send messages

**Mode Switching (4):**
- EnterPlanModeTool, ExitPlanModeTool - Plan mode
- EnterWorktreeTool, ExitWorktreeTool - Git worktree

**Others (16+):**
- SkillTool, SleepTool, TodoWriteTool, ConfigTool, ToolSearchTool, BriefTool...`
      },
      {
        title: "3.7 buildTool Factory: Defaults and Type Safety",
        content: `**src/Tool.ts**

\`buildTool()\` is the creation entry point for all tools, encapsulating default value logic:

\`\`\`typescript
// Factory function signature
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>

// Default strategy: fail-closed
const TOOL_DEFAULTS = {
  // Default disallows concurrency — more secure
  isConcurrencySafe: () => false,

  // Default is write operation — strict permissions
  isReadOnly: () => false,
  isDestructive: () => false,

  // Default allows — specific tools can be stricter
  checkPermissions: () => ({ behavior: 'allow', updatedInput: input }),

  // Empty string as default input representation
  toAutoClassifierInput: () => '',

  // Default uses tool name as display name
  userFacingName: () => def.name,
}
\`\`\`

**Tool Result Processing Pipeline (toolExecution.ts)**:

\`\`\`typescript
// 1. Tool returns ToolResult
const result = await tool.call(args, context, canUseTool, parentMessage, onProgress)

// 2. Convert to API format
const mappedResult = tool.mapToolResultToToolResultBlockParam(result.data, toolUseID)

// 3. Check if persistence needed
const { shouldPersist, preview, storedPath } = await maybePersistLargeToolResult(
  result.data,
  tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS
)

// 4. Run post-tool hooks
const hookResults = await runPostToolUseHooks({ tool, result: mappedResult, ... })
\`\`\`

**Large Result Persistence Strategy**:

\`\`\`typescript
// utils/toolResultStorage.ts
const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000

// When exceeding limit:
// 1. Show first 2000 characters as summary
// 2. Save full content to session directory
// 3. Return file path reference
if (result.size > maxSize) {
  const summary = result.data.substring(0, 2000)
  const storedPath = await saveToSessionDir(result.data, toolName, toolUseID)
  return { summary, storedPath, truncated: true }
}
\`\`\``
      },
      {
        title: "3.8 Tool Registry and assembleToolPool",
        content: `**src/tools.ts**

\`getAllBaseTools()\` returns all built-in tools:

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

// Conditional compilation: some tools depend on feature flags or user type
...(hasEmbeddedSearchTools() ? [] : [GlobTool, GrepTool]),
...(isTodoV2Enabled() ? [TaskCreateTool, TaskUpdateTool, ...] : []),
...(process.env.USER_TYPE === 'ant' ? [ConfigTool, TungstenTool] : []),
\`\`\`

**Tool Filtering Pipeline**:

\`\`\`typescript
// assembleToolPool = filter + combine
function assembleToolPool(
  permissionContext: ToolPermissionContext,
  mcpTools: MCPTool[]
): Tool[] {
  // 1. Get all built-in tools
  let tools = getAllBaseTools()

  // 2. Filter by deny rules
  tools = filterToolsByDenyRules(tools, permissionContext)

  // 3. Filter by allow rules
  tools = filterToolsByAllowRules(tools, permissionContext)

  // 4. Merge MCP tools
  tools = [...tools, ...mcpTools]

  return tools
}

// Filter logic: deny > allow
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
        title: "3.9 Tool Orchestration: Concurrency Control",
        content: `**src/services/tools/toolOrchestration.ts**

How do multiple tool calls decide serial vs parallel?

\`\`\`typescript
// Tool partitioning: concurrency-safe vs non-concurrency-safe
interface ToolCallPartition {
  isConcurrencySafe: boolean
  blocks: ToolUseBlock[]
}

// partitionToolCalls classifies tools by two properties
function partitionToolCalls(blocks: ToolUseBlock[], tools: Tool[]): ToolCallPartition[] {
  const partitions: Map<boolean, ToolUseBlock[]> = new Map([
    [true, []],   // Concurrency-safe
    [false, []]   // Not concurrency-safe
  ])

  for (const block of blocks) {
    const tool = findToolByName(tools, block.name)
    if (!tool) continue

    // Check if tool is concurrency-safe
    const isSafe = tool.isConcurrencySafe?.(block.input) ?? false
    partitions.get(isSafe)!.push(block)
  }

  return [
    { isConcurrencySafe: true, blocks: partitions.get(true)! },
    { isConcurrencySafe: false, blocks: partitions.get(false)! },
  ]
}

// Concurrency-safe + read-only → parallel
// Not concurrency-safe or write → serial
\`\`\`

**Concurrency Limit Configuration**:

\`\`\`typescript
// Max concurrent tool runs
const MAX_TOOL_USE_CONCURRENCY = parseInt(
  process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY ?? '10'
)

// Semaphore controls concurrency
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
        title: "3.10 Security Layer: Seven-Step Permission Decision",
        content: `**src/utils/permissions/permissions.ts**

Permission checking is a multi-stage decision process:

\`\`\`typescript
async function hasPermissionsToUseTool(
  tool: Tool,
  input: any,
  context: ToolUseContext,
  canUseTool: CanUseToolFn
): Promise<PermissionResult> {

  // === Step 1: Rule Matching ===

  // 1a: Entire tool in deny list?
  const denyRule = matchToolRule(tool.name, context.alwaysDenyRules)
  if (denyRule) return { behavior: 'deny', reason: 'Tool denied by rule' }

  // 1b: Entire tool in ask list?
  const askRule = matchToolRule(tool.name, context.alwaysAskRules)
  if (askRule && !context.sandboxAutoAllow) {
    return { behavior: 'ask', suggestions: buildSuggestions(askRule) }
  }

  // 1c: Tool-specific permission check (e.g., Bash subcommand rules)
  const toolSpecificResult = await tool.checkPermissions?.(input, context)
  if (toolSpecificResult?.behavior === 'deny') {
    return toolSpecificResult
  }

  // === Step 2: Mode-Level Allow ===

  // 2a: bypassPermissions mode or plan mode + bypass
  if (context.permissionMode === 'bypassPermissions' ||
      (context.permissionMode === 'plan' && context.canBypassPlanMode)) {
    return { behavior: 'allow' }
  }

  // 2b: Tool in always-allow list?
  const allowRule = matchToolRule(tool.name, context.alwaysAllowRules)
  if (allowRule) return { behavior: 'allow' }

  // === Step 3: Fallback ask ===
  return { behavior: 'ask' }
}
\`\`\`

**Safety Check Bypass Immunity**:

\`\`\`typescript
// These checks run even in bypassPermissions mode
const SAFETY_CHECKS = [
  // .git/ directory protection
  { pattern: /^\\.git\\//, reason: 'Cannot modify .git directory' },
  // .claude/ config directory protection
  { pattern: /^\\.claude\\//, reason: 'Cannot modify .claude directory' },
  // Shell config files
  { pattern: /\\.(bashrc|zshrc|profile)$/, reason: 'Shell config modification blocked' },
]

// These run in checkSafetyValidations(), never bypassed
\`\`\``
      },
      {
        title: "3.11 Bash Permissions: AST Parsing and Dangerous Patterns",
        content: `**src/tools/BashTool/bashPermissions.ts**

Bash permission checking uses tree-sitter for AST parsing:

\`\`\`typescript
// Parse Bash command into AST
const ast = parseBashCommand(command)

// Traverse AST nodes, extract actual commands
function extractCommandsFromAST(ast): string[] {
  const commands: string[] = []

  for (const node of ast.descendants()) {
    if (node.type === 'command') {
      const cmdName = getCommandName(node)
      commands.push(cmdName)
    }

    // Handle compound commands (&&, |, ;)
    if (node.type === 'and') {
      commands.push(...extractCommandsFromAST(node.left))
      commands.push(...extractCommandsFromAST(node.right))
    }
  }

  return commands
}
\`\`\`

**Dangerous Command Patterns**:

\`\`\`typescript
// DANGEROUS_BASH_PATTERNS
const DANGEROUS_PATTERNS = [
  { pattern: /\\beval\\s/, reason: 'eval is dangerous' },
  { pattern: /\\bsudo\\s+su\\b/, reason: 'sudo su is dangerous' },
  { pattern: /\\bcurl\\s+.*\\|\\s*sh\\b/, reason: 'pipe to shell is dangerous' },
  { pattern: /\\bwget\\s+.*\\|\\s*sh\\b/, reason: 'wget pipe to shell is dangerous' },
  { pattern: /\\brm\\s+-rf\\s+\\/\\b/, reason: 'rm -rf / is dangerous' },
  { pattern: /\\bchmod\\s+-R\\s+777\\b/, reason: 'world-writable permissions' },
]

// Check if matches dangerous pattern
function checkDangerousPatterns(command: string): Match | null {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { reason, pattern }
    }
  }
  return null
}
\`\`\`

**Safe Wrapper Stripping**:

\`\`\`typescript
// Strip safe wrappers to prevent bypass
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

// Also strip all env vars (prefix prevents env FOO=bar git bypass)
function stripAllLeadingEnvVars(command: string): string {
  return command.replace(/^[A-Z_][A-Z0-9_]*=.*?\\s+/g, '')
}
\`\`\``
      },
      {
        title: "3.12 Path Validation: Protection Mechanisms",
        content: `**src/utils/permissions/pathValidation.ts**

Path validation prevents dangerous path operations:

\`\`\`typescript
// UNC path blocking (prevent credential leakage)
const UNC_PATH_REGEX = /^\\\\|^\\\\\\\\

function validatePath(path: string): ValidationResult {
  // Block UNC paths
  if (UNC_PATH_REGEX.test(path)) {
    return { valid: false, reason: 'UNC paths are not allowed' }
  }

  // Block ~user style paths
  if (/^~[a-zA-Z]/.test(path)) {
    return { valid: false, reason: 'Home directory shortcuts not allowed' }
  }

  // Block shell expansion
  if (/\\$[A-Z_][A-Z0-9_]*|\\$\\{[^}]+\\}|\\$\\([^)]+\\)/.test(path)) {
    return { valid: false, reason: 'Shell expansion not allowed in paths' }
  }

  // Block glob patterns for writes
  if (isGlobPattern(path) && operationType === 'write') {
    return { valid: false, reason: 'Glob patterns not allowed for write operations' }
  }

  // Dangerous removal path detection
  if (isDangerousRemovalPath(path)) {
    return { valid: false, reason: 'This removal pattern is blocked' }
  }
}
\`\`\`

**Dangerous Removal Patterns**:

\`\`\`typescript
// Block rm -rf / or similar fatal operations
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

**Working Directory Check**:

\`\`\`typescript
// Write operations must be within working directory (or subdirectory)
function validateWorkingDirectory(filePath: string, cwd: string): boolean {
  const resolvedPath = resolve(filePath)
  const resolvedCwd = resolve(cwd)

  // Ensure file path is subdirectory of cwd
  return resolvedPath.startsWith(resolvedCwd + sep)
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "Tool interface has 10+ methods, considers fail-closed defaults",
      "14-step execution pipeline ensures safe and controlled tool calls",
      "Speculative classifier analyzes Bash command risk asynchronously in advance",
      "Pre/Post Hook system provides powerful extension points",
      "resolveHookPermissionDecision is the core of permission decision",
      "buildTool factory encapsulates default strategy, fail-closed design",
      "Tool partitioning: concurrency-safe tools parallel, unsafe tools serial",
      "Seven-step permission flow: rule matching → mode check → fallback ask",
      "Bash uses AST parsing instead of regex, prevents command injection bypass",
      "Path validation blocks UNC paths, shell expansion, glob writes"
    ],
    relatedFiles: [
      "src/Tool.ts (30308 bytes) - Tool base class",
      "src/services/tools/toolExecution.ts (1745 lines) - Execution pipeline",
      "src/services/tools/toolHooks.ts - Hook system",
      "src/tools/BashTool/bashPermissions.ts - Bash permission checking",
      "src/utils/permissions/pathValidation.ts - Path validation",
      "src/services/tools/toolOrchestration.ts - Concurrency control"
    ]
  },

  s04: {
    intro: `Claude Code has at least 6 built-in Agents: General Purpose Agent, Explore Agent, Plan Agent, Verification Agent, Claude Code Guide Agent, Statusline Setup Agent.

**Source Location**: src/tools/AgentTool/AgentTool.tsx (1397 lines), src/tools/AgentTool/runAgent.ts (973 lines)

The rationale: letting one Agent research, plan, implement, and verify simultaneously means doing everything poorly. Splitting roles allows each to focus on their specific responsibilities.`,
    sections: [
      {
        title: "4.2 Explore Agent: Read-Only Expert",
        content: `**src/tools/AgentTool/built-in/exploreAgent.ts**

Explore Agent is explicitly prohibited from:
- Creating new files (any form)
- Modifying existing files
- Deleting files
- Writing files with redirects
- Running any commands that change system state

**Available Tools**: Glob, Grep, FileRead, Bash (only ls, git status, git log, etc. read operations)

**Prompt Key Content**:
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

**Performance Optimization**: External users default to Haiku model (faster, cheaper), internal users inherit main model. Exploration doesn't need strongest reasoning; speed matters more.`
      },
      {
        title: "4.3 Verification Agent: 130 Lines of 'Try to Break It'",
        content: `**src/tools/AgentTool/built-in/verificationAgent.ts**

Verification Agent's prompt is 130 lines, possibly the most carefully designed piece of text in the entire source code.

**Core Responsibility**: try to break it

**Two Common Failure Modes**:
1. Verification avoidance - only looks at code, doesn't run checks, writes PASS and leaves
2. Misled by first 80% - UI looks good, tests pass, ignoring remaining 20%

**Mandatory Verification Strategies**:
\`\`\`
Based on change type:
- Frontend: Start dev server, use browser automation to click through
- Backend: curl for actual testing
- CLI: Check stdout/stderr/exit code
- DB migration: Test up/down and existing data
\`\`\`

**Recognizing Rationalization Tendencies**:
- "Code looks right" → Check if that's verification. Run it.
- "Implementer's tests passed" → Implementer is also LLM. Verify independently.
- "Probably fine" → Probably isn't verification. Run it.

**Implementer and Verifier Separation** is common sense in traditional software engineering, but most AI Agent products haven't done it yet.`
      },
      {
        title: "4.6 runAgent.ts: Complete Lifecycle for Sub-Agents",
        content: `**src/tools/AgentTool/runAgent.ts (973 lines)**

\`\`\`typescript
export async function* runAgent(params: AgentParams): AsyncGenerator<...> {
  // 1. Initialize agent-exclusive MCP servers
  const mcpServers = await initializeAgentMcpServers(params.frontmatter)

  // 2. Clone file state cache
  const clonedCache = cloneFileStateCache()

  // 3. Get user/system context
  const context = await getAgentContext(params)

  // 4. Trim content for read-only agents
  const trimmedContext = params.readonly
    ? trimForReadOnly(context)
    : context

  // 5. Build agent-exclusive permission mode
  const permissionMode = buildAgentPermissionMode(params)

  // 6. Assemble tool pool
  const tools = assembleToolPool(params)

  // 7. Register frontmatter hooks
  registerFrontmatterHooks(params)

  // 8. Preload skills
  await preloadSkills(params)

  // 9. Call query() to enter main loop
  yield* query({
    messages: params.messages,
    systemPrompt: params.systemPrompt,
    toolUseContext: { ...context, tools, permissionMode },
    ...
  })

  // 10. Record transcript
  recordSidechainTranscript(params.agentId, ...)

  // 11. Cleanup
  cleanupAgentTracking(params.agentId)
  killShellTasksForAgent(params.agentId)
}
\`\`\`

**Key Design**: Agents can bring their own MCP servers, connecting exclusive external tools via frontmatter configuration.`
      },
      {
        title: "4.7 Fork Subagent: Implicit Fork Mechanism",
        content: `**src/tools/AgentTool/forkSubagent.ts**

Fork Subagent is an implicit fork mechanism: when user doesn't specify subagent_type, triggers a child agent that inherits the parent's full context.

\`\`\`typescript
// Fork trigger condition
export function isForkSubagentEnabled(): boolean {
  if (feature('FORK_SUBAGENT')) {
    if (isCoordinatorMode()) return false  // Mutually exclusive with coordinator
    if (getIsNonInteractiveSession()) return false
    return true
  }
  return false
}

// Fork subagent definition
export const FORK_AGENT = {
  agentType: FORK_SUBAGENT_TYPE,
  tools: ['*'],           // Inherit parent tool pool
  useExactTools: true,    // Exact tool set (maintain cache key consistency)
  permissionMode: 'bubble', // Permission dialogs propagate to parent terminal
  model: 'inherit',       // Inherit parent model
}
\`\`\`

**Fork Message Construction**:

\`\`\`typescript
// All fork children must produce byte-identical API request prefixes
// Keep parent's assistant message with all tool_use blocks
// Generate identical placeholder results for each tool_use
const FORK_PLACEHOLDER_RESULT = 'Fork started — processing in background'

// Build: parent assistant + virtual tool_results + child directive
const toolResultBlocks = toolUseBlocks.map(block => ({
  type: 'tool_result',
  tool_use_id: block.id,
  content: [{ type: 'text', text: FORK_PLACEHOLDER_RESULT }]
}))

return [fullAssistantMessage, toolResultMessage]
\`\`\`

**Child Agent Rules (Hardcoded)**:

\`\`\`
1. Your system prompt says "default to forking" — IGNORE IT. You ARE the fork.
2. Do NOT converse, ask questions, or suggest next steps
3. Do NOT editorialize or add meta-commentary
4. USE your tools directly (Bash, Read, Write, etc.)
5. Modify files then commit, include commit hash in report
6. Do NOT emit text between tool calls
7. Stay strictly within directive scope
8. Keep report under 500 words
9. MUST begin with "Scope:"
10. Report structured facts, then stop
\`\`\``
      },
      {
        title: "4.8 CacheSafeParams: Prompt Cache Sharing Mechanism",
        content: `**src/utils/forkedAgent.ts**

CacheSafeParams is the key design for achieving Prompt Cache sharing between parent and child processes.

\`\`\`typescript
// Parameters that affect API cache key must be exactly consistent
export type CacheSafeParams = {
  systemPrompt: SystemPrompt      // Must be byte-level consistent
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext  // tools, model must be consistent
  forkContextMessages: Message[]  // messages prefix must be consistent
}

// Critical constraint: Cannot set maxOutputTokens
// "DO NOT set maxOutputTokens here. The fork piggybacks on the main
// thread's prompt cache by sending identical cache-key params"
// Setting maxOutputTokens changes budget_tokens, causing cache miss
\`\`\`

**createSubagentContext Isolation Design**:

\`\`\`typescript
export function createSubagentContext(parentContext, overrides?): ToolUseContext {
  return {
    // Cloned, not shared — prevent state pollution
    readFileState: cloneFileStateCache(parentContext.readFileState),

    // Child controller linked to parent — parent abort cascades
    abortController: createChildAbortController(parentContext.abortController),

    // Mutation callbacks all set to no-op — complete isolation
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},

    // But share setAppStateForTasks — tasks need to register to root store
    setAppStateForTasks: parentContext.setAppStateForTasks,

    // Sub-agent doesn't pop permission dialogs
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

**Parent-Child Isolation Levels**:

| State Type | Isolation Strategy | Reason |
|------------|-------------------|--------|
| readFileState | Clone | Prevent file handle conflicts |
| abortController | Child linked to parent | Cascading abort on parent abort |
| setAppState | no-op | Prevent state pollution |
| setAppStateForTasks | Share | Tasks need root store registration |
| toolPermissionContext | shouldAvoidPermissionPrompts | Sub-agents don't show dialogs |
| contentReplacementState | Clone | Maintain cache key consistency |`
      },
      {
        title: "4.9 AgentTool Orchestration: Full Lifecycle",
        content: `**src/tools/AgentTool/AgentTool.tsx**

AgentTool is the unified entry point for 6 built-in agents, routing via subagent_type:

\`\`\`typescript
// AgentTool.tsx:420 - call() method entry
export const AgentTool = buildTool({
  name: AGENT_TOOL_NAME,
  inputSchema: AgentToolInput,
  call: async (input, context, canUseTool, parentMessage, onProgress) => {
    // Route based on subagent_type
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
        return runCustomAgent(input, context, canUseTool, parentMessage, onProgress)
    }
  }
})
\`\`\`

**Agent Lifecycle Management (agentToolUtils.ts)**:

\`\`\`typescript
// Async agents registered to global tracking table
registerAsyncAgent(agentId, {
  parentRequestId,
  agentType,
  status: 'running',
  startedAt: Date.now()
})

// Mark completed
completeAsyncAgent(agentId, { finalStatus: 'completed', output: agentResult })

// Mark failed and notify
failAsyncAgent(agentId, { error: error.message, stack: error.stack })

// Cleanup on abort
killAsyncAgent(agentId) // Abort + cleanup
\`\`\`

**Background Agent Completion Notification (agentToolUtils.ts:340-380)**:

\`\`\`typescript
// When sub-agent completes, notify parent terminal via AppState
async function notifyParentOfCompletion(agentId: string, result: AgentResult) {
  const state = getAppState()
  // Add to pendingAgentResults, parent checks in next turn
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
        title: "4.10 Agent Context: AsyncLocalStorage Isolation",
        content: `**src/utils/agentContext.ts**

Claude Code uses AsyncLocalStorage for agent identity tracking, solving context isolation problems with concurrent background agents:

\`\`\`typescript
// Two agent context types
type SubagentContext = {
  agentId: string           // Sub-agent UUID
  parentSessionId?: string  // Team lead's session ID
  agentType: 'subagent'
  subagentName?: string
  isBuiltIn?: boolean
  invocationKind?: 'spawn' | 'resume'
}

type TeammateAgentContext = {
  agentId: string           // Full agent ID, e.g., "researcher@my-team"
  agentName: string        // Display name
  teamName: string
  planModeRequired: boolean
  parentSessionId: string
  isTeamLead: boolean
  agentType: 'teammate'
}
\`\`\`

**Why not regular variables?**

AppState is a singleton shared. When multiple background agents run concurrently:
\`\`\`typescript
// Problem scenario
async function runBackgroundAgent() {
  currentAgentId = 'agent-1'  // Global variable
  await someAsyncOp()         // Suspended - other agent might modify currentAgentId
  log(currentAgentId)          // Might already be 'agent-2'!
}
\`\`\`

**AsyncLocalStorage Isolation Principle**:

\`\`\`typescript
const agentContextStorage = new AsyncLocalStorage<AgentContext>()

// Each async chain binds its own context
agentContextStorage.run(agentContext, () => {
  // Any async operation here gets correct agentId via getAgentContext()
  return runAgent(params)
})

// Even with await in between, won't leak to other agent's context
\`\`\`

**Context Propagation Patterns**:

\`\`\`typescript
// Sub-agent inherits parent context
runWithAgentContext(parentContext, () => runAgent(params))

// Teammate uses independent context
runWithTeammateContext(teammateIdentity, () => inProcessRunner(params))
\`\`\``
      },
      {
        title: "4.11 Mailbox: File-based Agent Communication",
        content: `**src/utils/teammateMailbox.ts**

Teammate agents communicate through filesystem messages stored at:
\`~\.claude\teams\{team_name}\inboxes\{agent_name}.json\`

\`\`\`typescript
type TeammateMessage = {
  from: string           // Sender name
  text: string          // Message content
  timestamp: string     // ISO timestamp
  read: boolean         // Read flag
  color?: string        // Sender color
  summary?: string      // Message summary (for display)
}

// Core operations
writeToMailbox(recipientName, message, teamName)
readMailbox(agentName, teamName)
markMessageAsReadByIndex(agentName, teamName, index)
\`\`\`

**SendMessageTool Protocol**:

\`\`\`typescript
// Message routing
type MessageRouting = {
  sender: string
  senderColor?: string
  target: string
  targetColor?: string
  summary?: string
  content?: string
}

// Supported message types
type StructuredMessage =
  | { type: 'idle_notification' }
  | { type: 'shutdown_request', request_id: string, reason?: string }
  | { type: 'shutdown_response', request_id: string, approve: boolean }
  | { type: 'plan_approval_request', request_id: string }
  | { type: 'plan_approval_response', request_id: string, approve: boolean }
  | { type: 'task_assignment', taskId: string, summary: string }
  | { type: 'mode_set_request', mode: PermissionMode }
  | { type: 'team_permission_update', rules: PermissionRule[] }
\`\`\`

**Polling Mechanism**:

\`\`\`typescript
// In-process teammate uses 500ms polling
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

**Mailbox Lock Mechanism**:

\`\`\`typescript
// Write operations use locks to prevent concurrent writes
await mailboxLock.runExclusive(async () => {
  const messages = await readMailboxFile(path)
  messages.push(newMessage)
  await writeMailboxFile(path, messages)
})
\`\`\``
      },
      {
        title: "4.12 In-Process Runner: Same-Process Teammate Execution",
        content: `**src/utils/swarm/inProcessRunner.ts**

Teammate agents can run in the same Node.js process using AsyncLocalStorage:

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
  // 1. Establish agent context
  const context = createTeammateAgentContext(params.identity)

  // 2. Run in isolated context
  await runWithTeammateContext(context, async () => {
    // 3. Message processing loop
    while (!abortController.signal.aborted) {
      // 3.1 Check mailbox
      const messages = readMailbox(params.identity.name, params.identity.team)

      // 3.2 Process new messages
      for (const msg of messages.filter(m => !m.read)) {
        await handleTeammateMessage(msg)
        markMessageAsReadByIndex(...)
      }

      // 3.3 Check task list
      const task = claimAvailableTask(params.identity.team, params.identity.name)
      if (task) await executeTask(task)

      // 3.4 Report progress
      updateProgress(params.taskId, getCurrentProgress())

      await sleep(500)
    }
  })
}
\`\`\`

**Difference from Subagent**:

| Feature | Subagent | In-Process Teammate |
|---------|----------|-------------------|
| Lifecycle | Short-lived task | Long-lived |
| Communication | Direct return | Mailbox messages |
| Context | Inherits parent | Independent context |
| Concurrency | Multiple parallel | Single running |
| Use case | Fork subtasks | Team collaboration |`
      }
    ],
    keyTakeaways: [
      "Explore Agent is trimmed to read-only, can only use Glob/Grep/FileRead",
      "Verification Agent's responsibility is 'try to break it', 130-line prompt",
      "Implementer and verifier separation avoids verification bias",
      "Fork path shares parent process prompt cache via CacheSafeParams",
      "createSubagentContext isolates state, all mutable state cloned",
      "maxOutputTokens breaks cache key, cannot be set in fork",
      "AsyncLocalStorage solves context isolation for concurrent background agents",
      "Mailbox is file-based message queue supporting structured protocol messages",
      "In-Process Runner runs teammates in same process via polling"
    ],
    relatedFiles: [
      "src/tools/AgentTool/AgentTool.tsx (1397 lines) - Orchestration",
      "src/tools/AgentTool/runAgent.ts (973 lines) - Sub-agent runtime",
      "src/tools/AgentTool/built-in/exploreAgent.ts - Explore agent",
      "src/tools/AgentTool/built-in/verificationAgent.ts - Verification agent",
      "src/utils/forkedAgent.ts - Fork utility functions",
      "src/tools/AgentTool/forkSubagent.ts - Implicit fork mechanism",
      "src/utils/agentContext.ts - AsyncLocalStorage context",
      "src/utils/teammateMailbox.ts - Mailbox communication",
      "src/utils/swarm/inProcessRunner.ts - Same-process runner"
    ]
  },

  s05: {
    intro: `Security isn't one layer of steel, but three layers of protection that cooperate without bypassing each other. From Bash command risk classification, to the Hook system's flexible policies, to final permission decisions — each layer has its own boundary of responsibility.

**Source Location**: src/utils/permissions/ (27 files), src/services/tools/toolHooks.ts (650 lines)

Understanding this system is understanding how Claude Code maintains control over dangerous operations while allowing the model to act fully.`,
    sections: [
      {
        title: "5.1 Permission System Overview",
        content: `**src/utils/permissions/**

\`\`\`
27 files managing complete permission model:
├── PermissionMode.ts       - default/plan/auto modes
├── PermissionRule.ts       - Rule definitions (allow/deny/ask)
├── PermissionResult.ts      - Decision results
├── bashClassifier.ts       - Bash command risk classification
├── yoloClassifier.ts       - auto mode classifier
├── dangerousPatterns.ts     - Dangerous command pattern matching
├── shellRuleMatching.ts    - Shell command rule matching
└── pathValidation.ts       - File path validation
\`\`\`

**PermissionMode Modes**:
- **default**: Interactive confirmation
- **plan**: Plan mode, read-only operations
- **auto**: Auto allow/deny`
      },
      {
        title: "5.2 Hook System: Pre/Post/Failure Three Timing Points",
        content: `**src/services/tools/toolHooks.ts**

Three timing points:
\`\`\`typescript
runPreToolUseHooks()    // Before tool execution
runPostToolUseHooks()    // After successful tool execution
runPostToolUseFailureHooks()  // After tool execution failure
\`\`\`

**What Pre-hook can do** (toolExecution.ts:800-861):
\`\`\`typescript
switch (result.type) {
  case 'hookPermissionResult':
    hookPermissionResult = result.hookPermissionResult; break
  case 'hookUpdatedInput':
    processedInput = result.updatedInput; break  // Modify input
  case 'preventContinuation':
    shouldPreventContinuation = result.shouldPreventContinuation; break
  case 'blockingError':
    return [{ message: createToolResultStopMessage(...) }]  // Direct block
  case 'additionalContext':
    resultingMessages.push(result.message); break  // Supplement context
}
\`\`\`

**What Post-hook can do**:
- Modify MCP tool output
- Append messages
- Inject context
- Trigger continue/block continue`
      },
      {
        title: "5.3 resolveHookPermissionDecision: Key Adhesive Layer",
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

**Core Rules**:

| Hook Result | Settings Rule | Final Decision |
|-------------|---------------|----------------|
| allow + no updatedInput | Tool requires interaction | Still goes through canUseTool |
| allow | settings has deny | deny takes effect |
| allow | settings has ask | Still prompts |
| deny | - | Direct deny |
| ask | - | Passed as forceDecision to prompt |

**"Powerful but Controlled" Design**:

Hook has enough expressiveness for runtime policy adjustment, but can't bypass core security model. Even if Hook has a bug or is maliciously exploited, it can't quietly let an operation blocked by settings deny pass through.`
      },
      {
        title: "5.4 Three Layers of Protection",
        content: `**Protection Layers**:

**Layer 1: Speculative Classifier**
\`\`\`typescript
// BashTool's risk classifier runs in parallel with Hook execution
if (tool.name === 'BashTool') {
  startSpeculativeClassifierCheck(command, permissionContext, isNonInteractive)
}
\`\`\`
- Doesn't block main flow
- Starts async computation in advance
- Results assist permission decision

**Layer 2: Hook Policy Layer**
\`\`\`typescript
for await (const result of runPreToolUseHooks(...)) {
  // Can make permission decisions, modify input, block flow
}
\`\`\`

**Layer 3: Permission Decision**
\`\`\`typescript
const resolved = await resolveHookPermissionDecision(...)
// Synthesizes Hook results, rule configuration, user interaction
\`\`\`

**Mutual Non-bypass Principle**:
- Speculative results are just auxiliary, can't bypass Hook
- Hook's allow can't bypass settings deny
- Each layer has its own responsibility boundary`
      }
    ],
    keyTakeaways: [
      "Hook system supports Pre/Post/Failure three timing points",
      "resolveHookPermissionDecision defines 'Hook can't bypass Settings deny' rule",
      "Speculative classifier predicts in advance but doesn't block flow",
      "Three layers of protection: classifier → Hook → Permission Decision"
    ],
    relatedFiles: [
      "src/utils/permissions/ (27 files) - Permission system",
      "src/services/tools/toolHooks.ts (650 lines) - Hook system",
      "src/tools/BashTool/bashPermissions.ts - Bash risk classification"
    ]
  },

  s06: {
    intro: `Skill is a workflow package with metadata. Plugin is an extension at the model behavior level. MCP is a tool bridge + behavior instruction injection.

**Source Location**: src/skills/ (17 bundled skills), src/utils/plugins/ (42 files), src/services/mcp/ (23 files)

But the key to making the ecosystem work is letting the model "perceive" its own capabilities.`,
    sections: [
      {
        title: "6.1 Skill: 17 Bundled Skills",
        content: `**src/skills/**

Skill form is a markdown file with frontmatter metadata:

\`\`\`yaml
---
name: verify
description: Verify changes work correctly
allowed-tools: [BashTool, WebFetchTool]
model: opus
effort: high
---
\`\`\`

**17 Bundled Skills**:
- verify - Verify changes
- commit - Commit code
- loop - Loop execution
- simplify - Simplify code
- stuck - Handle stuck situations
- debug - Debug problems
- ... etc.

**Inject on demand**: Only injected when matched, not stuffed in at startup.`
      },
      {
        title: "6.2 Plugin: 42 Files Complete Chain",
        content: `**src/utils/plugins/**

\`\`\`
42 files covering complete chain:
├── loader.ts         - Plugin loading
├── validator.ts     - Plugin validation
├── marketplace.ts   - Marketplace management
└── ...
\`\`\`

**Plugin Capabilities**:
- Markdown commands and SKILL.md directory
- Hooks (Pre/PostToolUse)
- Output styles
- MCP server configuration
- Model and effort hints
- Runtime variable substitution (\${CLAUDE_PLUGIN_ROOT})
- Auto-update, version management, blocklist

**Plugin vs Ordinary CLI Plugin**:

Plugin can affect model behavior: change prompts, add tools, modify permission rules.`
      },
      {
        title: "6.3 MCP: Tool Bridge + Behavior Instruction Injection",
        content: `**src/services/mcp/**

When MCP server connects, if it provides instructions, they get appended to system prompt:

\`\`\`typescript
// prompts.ts
if (mcpServer.instructions) {
  systemPrompt.push({
    type: 'text',
    text: mcpServer.instructions
  })
}
\`\`\`

**MCP's Dual Value**:
1. New tools (registered via MCP protocol)
2. Instructions on how to use them (injected into prompt via instructions)

**Model doesn't just know "this tool exists", it knows "when to use it and how."**`
      },
      {
        title: "6.4 Key to Ecosystem: Model Perceives Its Own Capabilities",
        content: `**Channels for model perception**:

\`\`\`typescript
// 1. Skills list
systemPrompt.push({ type: 'text', text: getSkillList() })

// 2. Agent list
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

**Many platforms also have plugin systems, but model doesn't know when to use which.**

Claude Code lets model see its capability list. This is the prerequisite for the ecosystem to truly work.`
      }
    ],
    keyTakeaways: [
      "MCP server provides tools + usage instructions",
      "Plugin can change prompts, add tools, modify permission rules",
      "Skill injects on demand, not stuffed in at start",
      "Ecosystem works when model perceives its own capabilities"
    ],
    relatedFiles: [
      "src/skills/ (17 bundled skills)",
      "src/utils/plugins/ (42 files)",
      "src/services/mcp/ (23 files)"
    ]
  },

  s07: {
    intro: `Every Token has a cost, every piece of information takes space. Claude Code has four compaction mechanisms to ensure the most useful information fits in the limited context window.

**Source Location**: src/services/compact/ (11 files), src/query/tokenBudget.ts

Understanding context economics is understanding why Claude Code remains efficient in long sessions.`,
    sections: [
      {
        title: "7.1 Four Compaction Mechanisms Detailed",
        content: `**src/services/compact/**

Claude Code adopts a "four defense lines" compaction strategy, triggered on demand:

**First Line: Snip Compact (Lightweight Truncation)**

\`\`\`typescript
// snipCompact.ts - Truncate single overly long messages
interface SnipResult {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message  // Preserve message boundary
}

// Strategy: Keep head and tail of message, truncate middle if too long
// Reason: Conversation head/tail may contain critical context (task description, conclusion)
\`\`\`

**Second Line: Micro Compact (Cache Edit Optimization)**

\`\`\`typescript
// microcompact.ts - Incremental compression based on tool_use_id
interface MicrocompactResult {
  messages: Message[]
  compactionInfo?: {
    pendingCacheEdits: PendingCacheEdit[]  // Cache edit state
  }
}

// Leverages API's prompt cache mechanism
// Same file edits only transfer delta, cache hit means token fee only
\`\`\`

**Third Line: Context Collapse (Region Folding)**

\`\`\`typescript
// contextCollapse/ - Fold inactive regions into summaries
interface CollapseResult {
  messages: Message[]
  summaryMessages: Message[]  // Summary message
  attachments: Attachment[]
  hookResults: HookResult[]
}

// Identify "silent regions": conversation segments with no tool calls for N turns
// After collapse: one summary message + key tool_result references retained
\`\`\`

**Fourth Line: Auto Compact (Full Compression)**

\`\`\`typescript
// autoCompact.ts - Trigger threshold and circuit breaker
const AUTOCOMPACT_BUFFER_TOKENS = 13_000
const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// Stop retrying after 3 consecutive failures
// Only attempt once per turn
\`\`\`

**Compaction Priority Principle**: Lightweight first (snip/micro), then heavy (collapse/auto).

If lightweight compaction already reduces token count below threshold, heavyweight compression doesn't need to run.`
      },
      {
        title: "7.2 Auto Compact Threshold Calculation",
        content: `**src/services/compact/autoCompact.ts**

\`\`\`typescript
// Calculate effective context window (minus output reservation)
export function getEffectiveContextWindowSize(model: string): number {
  const maxOutputTokens = getMaxOutputTokensForModel(model)

  // Reserve space for compact summary output (p99.99 ~17k tokens)
  const reservedTokens = Math.min(maxOutputTokens, 20_000)

  let contextWindow = getContextWindowForModel(model)

  // Override via environment variable
  const autoCompactWindow = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW
  if (autoCompactWindow) {
    contextWindow = Math.min(contextWindow, parseInt(autoCompactWindow))
  }

  return contextWindow - reservedTokens
}

// Trigger threshold = effective window - 13K buffer
export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}
\`\`\`

**Token Warning State Machine**:

\`\`\`typescript
calculateTokenWarningState(tokenUsage, model) {
  // 100% → 0%: Remaining token percentage
  // isAboveWarningThreshold: Enter warning zone (20K remaining)
  // isAboveAutoCompactThreshold: Trigger auto compression
  // isAtBlockingLimit: Reached blocking boundary (3K remaining)
}
\`\`\``
      },
      {
        title: "7.3 Reactive Compact: Insurance for API 413",
        content: `**src/services/compact/reactiveCompact.ts**

When all four defense lines fail and API returns 413, this is the last layer of insurance:

\`\`\`typescript
interface ReactiveCompactParams {
  hasAttempted: boolean      // Loop protection flag
  querySource: string
  aborted: boolean
  messages: Message[]
  cacheSafeParams: {...}
}

async tryReactiveCompact(params: ReactiveCompactParams): Promise<Compacted | null> {
  // Critical: Only attempt once per turn
  if (params.hasAttempted) {
    return null
  }

  // Emergency compaction: use stronger strategy to compress in one shot
  const compacted = await performEmergencyCompact(params.messages)
  if (compacted) {
    return compacted
  }

  return null  // On failure, report error, don't retry
}
\`\`\`

**Loop Protection Design**:

| Mechanism | Purpose |
|-----------|---------|
| hasAttempted | Only attempt once per turn |
| consecutiveFailures counter | Circuit breaker after 3 consecutive failures |
| Fallback strategy | Emergency compression uses stronger summarization |

**Why is this needed?**

Even with correct token budget calculation, history message complexity, tool result accumulation, and thinking content inflation can cause actual token usage to exceed expectations. 413 is the final warning signal.`
      },
      {
        title: "7.4 Memory Prefetch and Tool Result Budget",
        content: `**Memory prefetch (query.ts:301-304)**
\`\`\`typescript
using pendingMemoryPrefetch = startRelevantMemoryPrefetch(
  state.messages,
  state.toolUseContext,
)
// Prefetch possibly relevant memory while model is streaming output
\`\`\`

**Tool result budget (utils/toolResultStorage.ts)**
\`\`\`typescript
if (result.size > maxResultSizeChars) {
  // Persist to disk, keep only summary
  const summary = await createSummary(result.data)
  return { summary, storedPath: saveToDisk(result.data) }
}
\`\`\``
      },
      {
        title: "7.5 Cron Scheduler: Distributed Lock Prevents Duplicate Execution",
        content: `**src/utils/cronScheduler.ts**

Scheduled task scheduler supporting one-shot/recurring tasks:

\`\`\`typescript
// Distributed lock prevents duplicate execution across sessions
isOwner = await tryAcquireSchedulerLock(lockOpts)
if (!isOwner) {
  // Non-owner periodically probes to take over
  lockProbeTimer = setInterval(() => {
    tryAcquireSchedulerLock(lockOpts).then(owned => {
      if (owned) isOwner = true  // Previous owner crashed, take over
    })
  }, LOCK_PROBE_INTERVAL_MS)
}
\`\`\`

**Key Design**:
- Persists to .claude/scheduled_tasks.json
- Supports jittered next fire to prevent :00 moment stampede
- One-shot tasks auto-delete after expiration, recurring tasks support maxAge
- Missed tasks notify user on startup`
      },
      {
        title: "7.6 conversationRecovery: Interruption Detection and Recovery",
        content: `**src/utils/conversationRecovery.ts**

**Interruption Detection Algorithm**:

\`\`\`typescript
function detectTurnInterruption(messages: NormalizedMessage[]): InternalInterruptionState {
  const lastMessage = messages.findLastIndex(m => m.type !== 'system' && m.type !== 'progress')

  if (lastMessage.type === 'assistant') {
    return { kind: 'none' }  // assistant ending = normal completion
  }

  if (lastMessage.type === 'user') {
    if (lastMessage.isMeta || lastMessage.isCompactSummary) {
      return { kind: 'none' }
    }
    if (isToolUseResultMessage(lastMessage)) {
      // brief mode (SendUserMessage ending) is normal completion, not interruption
      if (isTerminalToolResult(lastMessage, messages, lastMessageIdx)) {
        return { kind: 'none' }
      }
      return { kind: 'interrupted_turn' }
    }
    return { kind: 'interrupted_prompt', message: lastMessage }
  }
}
\`\`\`

**Key Design**:
- filterUnresolvedToolCalls() filters incomplete tool calls
- filterOrphanedThinkingOnlyMessages() handles orphaned thinking messages in streaming output
- Injects "Continue from where you left off." synthetic message after interruption`
      },
      {
        title: "7.7 Session Memory Compact: Memory-Based Compression",
        content: `**src/services/compact/sessionMemoryCompact.ts**

Session Memory Compact is an experimental compression strategy that uses extracted session memory to guide compression:

\`\`\`typescript
interface SessionMemoryCompactParams {
  minTokens: number         // Minimum 10,000 tokens to trigger
  minTextBlockMessages: number  // Minimum 5 text messages
  maxTokens: number         // Keep maximum 40,000 tokens
}

async function sessionMemoryCompact(
  messages: Message[],
  context: ToolUseContext
): Promise<CompactResult | null> {
  // 1. Check trigger conditions
  if (!hasMetTokenThreshold(currentTokenCount)) return null
  if (!hasMetMessageCountThreshold(messages)) return null

  // 2. Get session memory
  const sessionMemory = await extractSessionMemory(messages)
  if (!sessionMemory) return null  // Fall back to traditional if memory empty

  // 3. Calculate keep index
  const keepIndex = calculateMessagesToKeepIndex(messages, sessionMemory)

  // 4. Preserve key messages: memory + recent + tool pairs
  const preservedMessages = [
    ...sessionMemory.messages,
    ...messages.slice(keepIndex)
  ]

  // 5. Rebuild tool call pair integrity
  return ensureToolUsePairsIntact(preservedMessages)
}
\`\`\`

**Comparison with Full Compact**:

| Feature | Full Compact | Session Memory Compact |
|---------|-------------|----------------------|
| Trigger | Token threshold | Token + message count dual threshold |
| Summary | AI full summary | Depends on existing session memory |
| Use case | General | Scenarios with clear session goals |
| Fallback | N/A | Falls back to traditional when memory empty |`
      },
      {
        title: "7.8 Message Grouping: By API Round",
        content: `**src/services/compact/grouping.ts**

Before compression, need to find safe truncation points. Claude Code groups messages by API round:

\`\`\`typescript
interface ApiRound {
  roundId: number
  messages: Message[]
  startIdx: number
  endIdx: number
}

// Identify API round boundaries: assistant message end
function groupMessagesByApiRound(messages: Message[]): ApiRound[] {
  const rounds: ApiRound[] = []
  let currentRound: Message[] = []
  let roundId = 0

  for (const msg of messages) {
    currentRound.push(msg)

    // Assistant message end = one API round's end
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

**Why Group by API Round Matters?**

\`\`\`typescript
// Tool calls must be paired: tool_use + tool_result
// Truncating in the middle causes orphaned tool_use

// Wrong example:
  // [user] → [assistant: tool_use(id=1)] → [truncate!] → [tool_result(id=1)]
  //                              ↑ Missing tool_result, API will error

// Correct example: truncate at round boundary
  // [user] → [assistant: tool_use(id=1)] → [truncate] → [user]
  // Ensure: each tool_use has corresponding tool_result
\`\`\`

**Compact Boundary Message**:

\`\`\`typescript
// Insert boundary marker after compaction
const boundaryMessage = createCompactBoundaryMessage({
  originalMessageCount: messages.length,
  preservedMessageCount: preserved.length,
  summary: summarizeContent(excisedMessages),
  timestamp: Date.now()
})
\`\`\``
      },
      {
        title: "7.9 Image Stripping and Summary Strategy",
        content: `**src/services/compact/compact.ts**

Compression itself can trigger 413! Images and documents become a burden during summary compression:

\`\`\`typescript
async function compactConversation(params: CompactParams): Promise<CompactResult> {
  // Step 1: Strip image content
  const messagesWithoutImages = await stripImagesFromMessages(params.messages)

  // Step 2: If still too long, strip documents
  const messagesWithoutMedia = await stripDocumentsIfNeeded(
    messagesWithoutImages,
    maxTokens
  )

  // Step 3: Summarize remaining content
  const summary = await generateCompactSummary(messagesWithoutMedia)

  return {
    summary,
    attachments: params.attachments,  // Preserve attachment references
    hookResults: params.hookResults     // Preserve hook results
  }
}
\`\`\`

**Image Marker Strategy**:

\`\`\`typescript
// Replace with placeholder markers
const IMAGE_REPLACEMENT = '[image]'
const DOCUMENT_REPLACEMENT = '[document]'

// Markers preserve original information references
interface MediaMarker {
  type: 'image' | 'document'
  originalIndex: number
  size?: number
  path?: string  // If persisted to disk
}
\`\`\`

**Post-Compact Recovery Mechanism**:

\`\`\`typescript
// Recover key context after compaction
async function buildPostCompactMessages(params: PostCompactParams) {
  const { summary, boundaryMessage, messagesToKeep } = params

  // 1. Re-attach recent file read results (max 5)
  const recentFileReads = await restoreRecentFileReads(
    messagesToKeep,
    POST_COMPACT_MAX_FILES_TO_RESTORE,
    POST_COMPACT_MAX_TOKENS_PER_FILE
  )

  // 2. Re-attach skill content (max 25k tokens)
  const skillContent = await restoreSkillContent(
    messagesToKeep,
    POST_COMPACT_SKILLS_TOKEN_BUDGET,
    POST_COMPACT_MAX_TOKENS_PER_SKILL
  )

  // 3. Combine final messages
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
        title: "7.10 Token Counting: Estimation vs Reality",
        content: `**src/services/tokenEstimation.ts**

Token counting is the foundation of compaction decisions. Claude Code uses estimation rather than precise counting:

\`\`\`typescript
// Get precise token usage from API response
interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation?: number   // Cache creation token
  cache_read?: number       // Cache read token
}

// Estimate token count for new messages
function estimateTokenCount(message: Message): number {
  // 1. Base: string length / 4 (Chinese ~2 chars/token)
  const baseEstimate = message.content.length / 4

  // 2. Tool call weighting
  if (message.type === 'tool_use') {
    return baseEstimate + TOOL_USE_OVERHEAD
  }

  // 3. Thinking block weighting
  if (message.thinking) {
    return baseEstimate + THINKING_OVERHEAD
  }

  return baseEstimate
}

// Combine precise count + estimation
function tokenCountWithEstimation(
  messages: Message[],
  lastUsage: TokenUsage | null
): number {
  if (lastUsage) {
    // Use precise count from API
    return lastUsage.input_tokens +
           lastUsage.cache_creation +
           lastUsage.cache_read +
           lastUsage.output_tokens +
           estimateNewMessages(messages)
  }

  // No precise count, all estimation
  return messages.reduce((sum, msg) => sum + estimateTokenCount(msg), 0)
}
\`\`\`

**Cache Token Special Handling**:

\`\`\`typescript
// Cache tokens don't count against context window (but have limits)
// 1M context model: max 900k cache
// 200K context model: max 180k cache

const CACHE_RATIO_LIMIT = 0.9

function calculateEffectiveContextUsed(tokenUsage: TokenUsage): number {
  const { input_tokens, cache_read, cache_creation } = tokenUsage

  // cache_read is free (cache hit)
  // cache_creation is one-time cost
  const effectiveUsed = input_tokens + cache_creation

  return effectiveUsed
}
\`\`\``
      }
    ],
    keyTakeaways: [
      "Four compaction mechanisms: Snip → Micro → Collapse → Auto",
      "Priority: Lightweight first, then heavy",
      "Reactive compact is insurance for 413, has loop protection",
      "Token budget implements auto-continue for long tasks",
      "Memory/Skill prefetch runs in parallel while model outputs",
      "Cron Scheduler uses distributed lock to prevent duplicate execution",
      "conversationRecovery detects interruptions and recovers intelligently",
      "Session Memory Compact uses existing memory to guide compression",
      "Group by API Round ensures tool_use/tool_result pair integrity",
      "Images stripped before compression to prevent 413 during summarization",
      "Token counting uses API precise + new message estimation hybrid"
    ],
    relatedFiles: [
      "src/services/compact/ (11 files) - Compaction system",
      "src/query/tokenBudget.ts - Token budget",
      "src/utils/toolResultStorage.ts - Result persistence",
      "src/utils/cronScheduler.ts - Scheduled task scheduler",
      "src/utils/conversationRecovery.ts - Conversation recovery",
      "src/services/compact/sessionMemoryCompact.ts - Memory compression",
      "src/services/tokenEstimation.ts - Token estimation"
    ]
  },

  s08: {
    intro: `After reviewing all previous modules, 7 design principles can be summarized. These aren't empty slogans; each has corresponding source code implementation as support.

Understanding these principles is understanding why Claude Code is designed this way and not another.`,
    sections: [
      {
        title: "Principle 1: Don't Trust Model's Initiative",
        content: `**Write good behavior as rules**

\`\`\`typescript
// Core content of getSimpleDoingTasksSection()
const rules = [
  "Don't add features the user didn't ask for",
  "Don't over-abstract",
  "Don't add comments to code you didn't change",
  "Read code before modifying it",
  "Report results honestly"
]
\`\`\`

**Behavioral specs in prompt + permission checks at runtime layer = institutionalized behavior**`
      },
      {
        title: "Principle 2: Split Roles",
        content: `**At least separate "the person who does the work" from "the person who verifies"**

\`\`\`
Explore Agent - read-only, cannot modify any files
Verification Agent - "try to break it"
Plan Agent - only plan, don't execute
\`\`\`

**The same Agent implementing and verifying is naturally inclined to think it did fine.**
Responsibility separation brings obvious improvement.`
      },
      {
        title: "Principle 3: Tool Calls Need Governance",
        content: `**14-step pipeline ensures safe and controlled tool calls**

\`\`\`
1. Zod schema validation
2. Tool-specific validation
3. Speculative classifier
4. PreToolUse hooks
5. Permission decision
6. Input correction
7. Execute tool.call()
8. Result processing
9. PostToolUse hooks
10. OTel logging
11. ...
14. PostToolUseFailure hooks
\`\`\`

**Governance determines how the system performs under abnormal conditions.**`
      },
      {
        title: "Principle 4: Context is Budget",
        content: `**Every token has a cost**

\`\`\`typescript
// SYSTEM_PROMPT_DYNAMIC_BOUNDARY
// Static parts first, higher cache hit rate

// Fork path optimization
const forkContext = {
  systemPrompt: mainContext.systemPrompt,  // Reuse cache
  ...
}
\`\`\`

**Cache what can be cached, load on demand what doesn't need to be stuffed in at start, compress what can be compressed.**`
      },
      {
        title: "Principle 5: Security Layers Don't Bypass Each Other",
        content: `**Three layers of protection**

\`\`\`
Layer 1: Speculative Classifier - advance prediction
Layer 2: Hook Policy Layer - policy decision
Layer 3: Permission Decision - final decision
\`\`\`

**Rules of resolveHookPermissionDecision**:
- Hook allow + settings deny → deny takes effect
- Hook allow + settings ask → still prompts
- Hook deny → takes effect directly

**Even if one layer has a problem, overall security doesn't collapse.**`
      },
      {
        title: "Principle 6: Key to Ecosystem is Model Perception",
        content: `**The final step of the extension mechanism is letting the model see its own capabilities**

\`\`\`typescript
// Channels for model perception
const感知Channels = [
  getSkillList(),           // Skills list
  getAgentList(),           // Agents list
  getMcpInstructions(),      // MCP instructions
  getSessionGuidance(),      // Session guidance
  getCommandList()           // Command list
]
\`\`\`

**Connect 10 plugins to the system, but model doesn't know when to use which — equivalent to not existing.**`
      },
      {
        title: "Principle 7: Productization is Handling Day 2",
        content: `**runAgent.ts's cleanup chain**

\`\`\`typescript
// Complete lifecycle cleanup
cleanupAgentTracking(agentId)      // Cleanup tracking state
killShellTasksForAgent(agentId)      // Kill shell processes
cleanupSessionHooks(agentId)         // Cleanup session hooks
cloneFileStateCache(agentId)         // Cleanup cloned file state
removeTodos(agentId)               // Cleanup todos entry
disconnectMcpConnections(agentId)    // Disconnect MCP connections
\`\`\`

**How to resume interrupted long tasks? How to clean dirty state? What to do about process leaks? How to restore sessions?**

Without solving these problems, the product can only be a Demo.`
      }
    ],
    keyTakeaways: [
      "Write good behavior as rules, don't rely on model initiative",
      "Responsibility separation: implementer and verifier separate",
      "Tool calls need governance, 14-step pipeline ensures safety",
      "Security layers don't bypass each other, three layers each with own responsibilities",
      "Context is budget, cache/compress what can be cached/compressed",
      "Ecosystem key is letting model perceive its own capabilities",
      "Productization = handling Day 2 problems"
    ],
    relatedFiles: [
      "src/constants/prompts.ts - Behavioral specs",
      "src/services/tools/toolExecution.ts - 14-step pipeline",
      "src/services/tools/toolHooks.ts - Security layers",
      "src/tools/AgentTool/runAgent.ts - Lifecycle cleanup"
    ]
  },

  s09: {
    intro: `Session is Claude Code's memory palace, MCP is the bridge to the outside world, Plugin is the extension of capabilities, Skill is the encapsulation of behavior.

Understanding these four modules is understanding how Claude Code maintains core simplicity while achieving infinite extensibility.

**Source Location**: src/utils/sessionStorage.ts (4500+ lines), src/services/mcp/ (23 files), src/utils/plugins/ (42 files), src/skills/ (17 bundled skills)`,
    sections: [
      {
        title: "9.1 Session Persistence: JSONL Transcript",
        content: `**src/utils/sessionStorage.ts**

Sessions are stored in JSONL format at ~/.claude/projects/<project-path>/

\`\`\`typescript
// Each message is a TranscriptMessage
type TranscriptMessage = {
  uuid: string           // Unique message ID
  parentUuid: string    // Parent message ID, forms chain
  sessionId: string
  cwd: string
  timestamp: string
  version: string
  gitBranch?: string
  // message content: user/assistant/system/attachment
}

// Write: append mode
appendEntryToFile(sessionId, message)

// Read: parse JSONL
loadMessageLogs(sessionId)
\`\`\`

**parentUuid chain**: Messages form a linked list via parentUuid. buildConversationChain() walks from leaf to root, then reverses to preserve order.

**Lite Log Optimization**: For listing, only read head/tail (65KB each) to extract firstPrompt, customTitle, tag - avoids loading full history.`
      },
      {
        title: "9.2 Conversation Recovery: Interruption Detection Algorithm",
        content: `**src/utils/conversationRecovery.ts**

**Core interruption detection logic** (detectTurnInterruption):

\`\`\`typescript
// Find last relevant message
const lastMessageIdx = messages.findLastIndex(m =>
  m.type !== 'system' && m.type !== 'progress'
)

// assistant end = normal completion
if (lastMessage.type === 'assistant') {
  return { kind: 'none' }
}

// user + tool_result (Brief mode) = normal completion
if (isTerminalToolResult(lastMessage)) {
  return { kind: 'none' }
}

// user + tool_result (non-Brief) = interrupted
if (lastMessage.type === 'user' && isToolResultMessage(lastMessage)) {
  return { kind: 'interrupted_turn' }
}

// user plain text = interrupted (CC hadn't started responding)
if (lastMessage.type === 'user' && !lastMessage.isMeta) {
  return { kind: 'interrupted_prompt' }
}
\`\`\`

**Synthetic message on recovery**: "Continue from where you left off."

**Deserialization Pipeline**:

\`\`\`
deserializeMessagesWithInterruptDetection()
├── migrateLegacyAttachmentTypes()
├── filterUnresolvedToolUses()
├── filterOrphanedThinkingOnlyMessages()
├── filterWhitespaceOnlyAssistantMessages()
└── detectTurnInterruption()
\`\`\``
      },
      {
        title: "9.3 MCP System Architecture: Tool Bridging",
        content: `**src/services/mcp/client.ts**

MCP (Model Context Protocol) bridges external tools to Claude Code:

\`\`\`typescript
// MCP tool name format
mcp__\${normalizedServerName}__\${normalizedToolName}
// Example: mcp__github__create_issue

// Override MCPTool properties at connection time
const tool = {
  ...MCPTool,
  name: fullyQualifiedName,
  mcpInfo: { serverName, toolName },
  isMcp: true
}
\`\`\`

**Supported Transport Types**:

| Transport | Use Case |
|-----------|----------|
| stdio | Subprocess stdin/stdout |
| sse | Server-Sent Events over HTTP |
| streamable-http | HTTP streaming |
| websocket | WebSocket |
| sdk | In-process SDK communication |

**Connection State Machine**:

\`\`\`
pending → connected → failed
         ↘ needs-auth ↗
         ↘ disabled
\`\`\``
      },
      {
        title: "9.4 MCP Instruction Injection: Delta Tracking",
        content: `**src/utils/mcpInstructionsDelta.ts**

MCP server instructions are tracked via attachments:

\`\`\`typescript
// Compute delta
getMcpInstructionsDelta(connectedServers, announcedServers) {
  // Returns: addedNames, addedBlocks, removedNames
}

// Instruction sources
1. Server-authored: InitializeResult.instructions (provided at handshake)
2. Client-side: synthesized (e.g., claude-in-chrome)
\`\`\`

**Prompt Integration**:

\`\`\`typescript
// prompts.ts
function getMcpInstructionsSection(mcpClients) {
  return getMcpInstructions()
}

// Uses DANGEROUS_uncachedSystemPromptSection
// Because MCP servers can connect/disconnect, instructions change
\`\`\``
      },
      {
        title: "9.5 Plugin System: 5 Extension Points",
        content: `**src/utils/plugins/**

Plugin is an extension container for Claude Code capabilities:

\`\`\`
my-plugin/
├── .claude-plugin/plugin.json    # Manifest
├── commands/                     # Custom slash commands
│   └── build.md
├── agents/                       # Custom agents
│   └── test-runner.md
├── skills/                       # Skills
│   └── my-skill/SKILL.md
├── hooks/                        # Hook configurations
│   └── hooks.json
├── output-styles/                # Output styles
└── .mcp.json                    # MCP servers
\`\`\`

**5 Extension Points**:

1. **Commands** - markdown files defining slash commands
2. **Agents** - custom agents with tools/color/model config
3. **Skills** - workflow encapsulation with frontmatter
4. **Hooks** - PreToolUse/PostToolUse event handlers
5. **Output Styles** - response formatting customization

**Hook Types**: command / prompt / agent / http`
      },
      {
        title: "9.6 Plugin Marketplace and Auto-Update",
        content: `**src/utils/plugins/marketplaceManager.ts**

Plugin marketplace supports multiple sources:

\`\`\`typescript
type MarketplaceSource =
  | { source: 'github', repo: string }
  | { source: 'git', url: string }
  | { source: 'npm', package: string }
  | { source: 'file', path: string }
  | { source: 'directory', path: string }
  | { source: 'settings', inline: PluginManifest }
\`\`\`

**Auto-Update Mechanism**:

\`\`\`typescript
// Check at startup for markets with autoUpdate: true
// Anthropic official marketplace defaults to autoUpdate: true
// Updates via GCS mirror for speed

pluginAutoupdate.checkAndUpdate(plugin, marketplace)
\`\`\`

**Storage Structure**:

\`\`\`
~/.claude/plugins/
├── known_marketplaces.json    # Marketplace registry
├── installed_plugins.json    # Installed plugins
└── marketplaces/             # Marketplace cache
    └── github-marketplace/
        └── .claude-plugin/
            └── marketplace.json
\`\`\``
      },
      {
        title: "9.7 Skill System: 17 Bundled Skills",
        content: `**src/skills/bundledSkills.ts**

Skill is markdown encapsulation with frontmatter:

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

**Skill Definition Structure**:

\`\`\`typescript
type BundledSkillDefinition = {
  name: string
  description: string
  whenToUse?: string       // Auto-match的依据
  allowedTools?: string[]   // Tool whitelist
  model?: string           // Specified model
  context?: 'inline' | 'fork'  // Execution mode
  getPromptForCommand: (args, context) => Promise<ContentBlockParam[]>
}
\`\`\`

**Execution Modes**:

| Mode | Behavior |
|------|----------|
| inline | Expand content into current conversation |
| fork | Run in isolated sub-agent with separate token budget |`
      },
      {
        title: "9.8 Skill Matching: Model Autonomous Decision",
        content: `**No automatic matching algorithm**

Skill matching is model's autonomous decision based on descriptions:

\`\`\`typescript
// SkillTool prompt tells model:
// "Available skills are listed in system-reminder messages"
// "When a skill matches, invoke Skill tool BEFORE generating response"
// "NEVER mention a skill without actually calling this tool"
\`\`\`

**Conditional Activation**:

\`\`\`typescript
// Skills with paths only activate when matching files are touched
// Uses gitignore-style pattern matching
if (skill.paths && matchesPath(skill.paths, touchedFile)) {
  activateSkill(skill)
}
\`\`\`

**Bundled Skills Examples**:

| Skill | Purpose |
|-------|---------|
| verify | Verify code changes (ANT only) |
| simplify | Code review, launches 3 parallel review agents |
| batch | Parallel changes across 5-30 isolated worktree agents |
| loop | Recurring task scheduling |
| debug | Diagnose session issues |`
      },
      {
        title: "9.9 Skill Execution: Argument Substitution and Variables",
        content: `**src/skills/loadSkillsDir.ts**

Skill content processing pipeline:

\`\`\`typescript
// 1. Append base directory
finalContent = \`Base directory: \${baseDir}\\n\\n\${content}\`

// 2. Replace argument placeholders
finalContent = substituteArguments(content, args, ...)

// 3. Replace skill directory variable
finalContent = content.replace(/\\$\\{CLAUDE_SKILL_DIR\\}/g, skillDir)

// 4. Replace session ID
finalContent = content.replace(/\\$\\{CLAUDE_SESSION_ID\\}/g, sessionId)

// 5. Execute inline shell commands (\`...\`)
finalContent = executeShellCommandsInPrompt(content)
\`\`\`

**Bundled Skill Example (simplify)**:

\`\`\`typescript
// Launches 3 parallel review agents simultaneously
// 1. Reuse Agent - checks for duplication and abstraction
// 2. Quality Agent - checks quality and errors
// 3. Efficiency Agent - checks performance
\`\`\``
      },
      {
        title: "9.10 MCP + Plugin + Skill Collaboration",
        content: `**How they work together**

\`\`\`
Plugin                    MCP Server
├── hooks/               ├── tools/list
├── commands/            ├── tools/call
├── skills/             └── resources/list
└── .mcp.json
\`\`\`

**Typical Scenarios**:

1. **Plugin provides MCP server configuration**
   \`\`\`json
   { "mcpServers": { "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] } } }
   \`\`\`

2. **MCP tools exposed to Claude Code**
   - Call via mcp__github__create_issue

3. **Skill encapsulates complex workflows**
   - Skill calls MCP tools + built-in tools
   - Batch operations, loops, conditionals

**Extension Priority**:

| Extension | Use Case |
|-----------|----------|
| MCP | Connect existing external tools/APIs |
| Plugin | Add new capabilities (hooks/commands/agents) |
| Skill | Encapsulate repetitive workflows |`
      }
    ],
    keyTakeaways: [
      "Session stored as JSONL with parentUuid chain, supports fast listing and full recovery",
      "Interruption detection based on message type: Brief mode tool_result normal, otherwise interrupted",
      "MCP bridges external tools via standardized transport, format mcp__server__tool",
      "MCP instructions use Delta tracking for efficient cross-turn updates",
      "Plugin is capability extension container with 5 extension points",
      "Plugin marketplace supports multiple sources, auto-update via GCS",
      "Skill is markdown encapsulation, model autonomously decides based on description",
      "Skill supports inline/fork execution modes",
      "MCP + Plugin + Skill form complete extension ecosystem"
    ],
    relatedFiles: [
      "src/utils/sessionStorage.ts (4500+ lines) - Session persistence",
      "src/utils/conversationRecovery.ts - Interruption detection",
      "src/services/mcp/client.ts (3300+ lines) - MCP client",
      "src/utils/mcpInstructionsDelta.ts - Instruction delta tracking",
      "src/utils/plugins/pluginLoader.ts - Plugin loading",
      "src/utils/plugins/marketplaceManager.ts - Marketplace management",
      "src/skills/bundledSkills.ts - Bundled skills registration",
      "src/skills/loadSkillsDir.ts - Skill loading and execution"
    ]
  },

  s10: {
    intro: `The three foundations of Claude Code: CLI entry, state management, and TUI rendering. Understanding these three reveals how an interactive application starts from zero and runs continuously.

**Source Location**: src/entrypoints/cli.tsx, src/main.tsx (238KB), src/state/ (state management), src/ink/ (TUI rendering)

This chapter is not about "what it does" but "how it connects together".`,
    sections: [
      {
        title: "10.1 CLI Entry: Fast-Path Dispatch",
        content: `**src/entrypoints/cli.tsx**

The CLI entry's core idea: **special flags go fast-path, main flow loads full modules**.

\`\`\`typescript
// Fast-path: zero module loading
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  console.log(\`\${MACRO.VERSION} (Claude Code)\`);
  return;  // Direct return, don't load main.tsx
}

// Fast-path: MCP servers
if (args[0] === '--claude-in-chrome-mcp') { ... }

// Fast-path: Daemon mode
if (args[0] === 'daemon') { ... }

// No special flags? Load full main module
const { main: cliMain } = await import('../main.js');
await cliMain();
\`\`\`

**All Fast-Path Flags**:

| Flag | Behavior |
|------|----------|
| --version / -v | Output version, exit |
| --dump-system-prompt | Output system prompt, exit |
| --claude-in-chrome-mcp | Start Chrome MCP |
| --computer-use-mcp | Start computer use MCP |
| daemon [sub] | Daemon mode |
| ps\|logs\|attach\|kill | Session management |
| new\|list\|reply | Template job commands |
| remote-control / rc | Bridge mode |

**Why This Design?**

\`-v\` is the most common flag. Loading 238KB main.tsx every time would add 500ms+ latency.`
      },
      {
        title: "10.2 main.tsx: Command Dispatch and Initialization",
        content: `**src/main.tsx (238KB)**

main.tsx is the core of the entire application, in three stages:

**Stage 1: Early Initialization (main function)**

\`\`\`typescript
export async function main() {
  // SECURITY: Prevent Windows PATH hijacking
  process.env.NoDefaultCurrentDirectoryInExePath = '1';

  initializeWarningHandler();

  // Handle deep links (cc://), SSH remote
  // Handle \`claude assistant [sessionId]\`

  const isNonInteractive = hasPrintFlag || !process.stdout.isTTY;
  setIsInteractive(!isNonInteractive);
  initializeEntrypoint(isNonInteractive);

  await run();  // Enter command dispatch
}
\`\`\`

**Stage 2: Command Dispatch (run function)**

\`\`\`typescript
async function run(): Promise<CommanderCommand> {
  const program = new CommanderCommand()

  // preAction: runs BEFORE any command executes
  program.hook('preAction', async () => {
    await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()]);
    await init();  // Core initialization
    runMigrations();
  });

  // Define all CLI options and subcommands...
  // -p, --print non-interactive output
  // -c, --continue continue conversation
  // -r, --resume [sessionId] resume session
  // --model, --agent model/agent selection
  // --permission-mode permission mode
  // ...

  await program.parseAsync(process.argv);
}
\`\`\`

**Stage 3: Interactive vs Non-Interactive**

\`\`\`typescript
if (isNonInteractiveSession) {
  // Non-interactive: headless mode
  const { runHeadless } = await import('src/cli/print.js');
  void runHeadless(inputPrompt, store.getState, store.setState, ...);
  return;
}

// Interactive: create Ink TUI
const { createRoot } = await import('./ink.js');
root = await createRoot(ctx.renderOptions);
await showSetupScreens(root, ...);  // Trust dialog, OAuth
initializeLspServerManager();       // LSP initialization
await launchRepl(root, ...);        // Launch REPL
\`\`\``
      },
      {
        title: "10.3 Initialization Pipeline: init → setup → REPL",
        content: `**src/entrypoints/init.ts**

\`init()\` is memoized and runs only once:

\`\`\`typescript
export const init = memoize(async (): Promise<void> => {
  enableConfigs();
  applySafeConfigEnvironmentVariables();
  setupGracefulShutdown();

  // 1P event logging (OpenTelemetry)
  // OAuth account info
  // JetBrains IDE detection
  // Remote managed settings loading
  // Record first start time
  // Configure global mTLS settings
  // Configure global HTTP agents (proxy)
  // Preconnect Anthropic API (~100-200ms overlap)
  // Setup git-bash (Windows)
  // Register LSP manager cleanup
  // Initialize scratchpad directory
});
\`\`\`

**setup.ts Tasks**:

\`\`\`typescript
const setupPromise = setup(preSetupCwd, permissionMode, allowDangerouslySkipPermissions, ...);

// Runs in parallel
// - Check Node.js version >= 18
// - Start UDS messaging server
// - Capture teammate mode snapshot
// - Restore terminal backups (iTerm2, Terminal.app)
// - Initialize session memory
// - Initialize file changed watcher
// - Check for release notes
// - Create worktree (--worktree)
// - Create tmux session (--tmux)
\`\`\`

**Startup Flow Diagram**:

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
        title: "10.4 State Management: Custom Store Pattern",
        content: `**src/state/store.ts**

Claude Code uses a **custom Store**, not Zustand:

\`\`\`typescript
// Based on React useSyncExternalStore
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
      if (Object.is(next, prev)) return  // Shallow compare, skip if same
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

**Why Not Zustand?**

This implementation is lighter, directly adapted to React 18's useSyncExternalStore with no extra abstraction layer.`
      },
      {
        title: "10.5 AppState: State Slice Structure",
        content: `**src/state/AppStateStore.ts**

\`\`\`typescript
export type AppState = DeepImmutable<{
  // Core settings and UI
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  statusLineText: string | undefined
  expandedView: 'none' | 'tasks' | 'teammates'

  // Task management
  tasks: { [taskId: string]: TaskState }
  agentNameRegistry: Map<string, AgentId>
  foregroundedTaskId?: string

  // MCP and plugins
  mcp: { clients, tools, commands, resources, pluginReconnectKey }
  plugins: { enabled, disabled, commands, errors, installationStatus }

  // UI state
  notifications: { current, queue }
  elicitation: { queue }
  activeOverlays: ReadonlySet<string>

  // Speculation (prompt prediction)
  speculation: SpeculationState
  promptSuggestion: { text, promptId, shownAt, acceptedAt }

  // Team context
  teamContext?: { teamName, teammates, selfAgentId, ... }
  inbox: { messages: Array<{id, from, text, timestamp, status}> }

  // Permissions
  toolPermissionContext: ToolPermissionContext
}>
\`\`\`

**Key Design: Messages NOT in AppState**

Messages are stored in **individual TaskState objects**, not global AppState:

\`\`\`typescript
// LocalAgentTaskState
interface LocalAgentTaskState {
  messages?: Message[]  // In TaskState, not in AppState
  // ...
}

// AppState only has task references
tasks: { [taskId: string]: TaskState }
\`\`\`

This design is because each Agent/Teammate has independent message history.`
      },
      {
        title: "10.6 State Access: useAppState Pattern",
        content: `**src/state/AppState.tsx**

Three core Hooks:

\`\`\`typescript
// Subscribe to a slice, only re-renders when value changes
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore()
  return useSyncExternalStore(store.subscribe, get, get)
}

// Get setState without subscribing
export function useSetAppState() {
  return useAppStore().setState
}

// Get raw store (for non-React code)
export function useAppStateStore(): AppStateStore {
  return useAppStore()
}
\`\`\`

**Usage Patterns**:

\`\`\`typescript
// Recommended: multiple calls for independent fields
const verbose = useAppState(s => s.verbose)
const model = useAppState(s => s.mainLoopModel)

// Recommended: select existing sub-object
const { text, promptId } = useAppState(s => s.promptSuggestion)

// Avoid: creating new object each time (causes unnecessary re-renders)
const { a, b } = useAppState(s => ({ a: s.a, b: s.b }))
\`\`\`

**onChangeAppState Side Effects**:

\`\`\`typescript
// Any state change triggers
onChangeAppState: ({ newState, oldState }) => {
  // Permission mode sync to CCR/SDK
  // Settings persistence to global config
  // Clear API key, AWS, GCP credential caches
  // Re-apply environment when settings.env changes
}
\`\`\``
      },
      {
        title: "10.7 TUI Framework: Ink Rendering Principle",
        content: `**src/ink/ink.tsx**

Ink is a React-based TUI framework using Yoga (flexbox) for layout:

\`\`\`
React component change → Reconciler commit → onComputeLayout() → scheduleRender() → onRender() → Frame → Diff → Terminal
\`\`\`

**Rendering Loop**:

\`\`\`typescript
// scheduleRender: throttled render
scheduleRender = throttle(deferredRender, FRAME_INTERVAL_MS)

// onRender: produces Frame after each commit
onRender() {
  const frame = this.renderer()  // From Yoga layout calculation
  const diff = LogUpdate.diff(prevFrame, frame)  // Diff only writes changed cells
  term.write(diff)
}
\`\`\`

**Frame Data Structure**:

\`\`\`typescript
type Frame = {
  readonly screen: Screen      // Cell buffer
  readonly viewport: Size      // Terminal dimensions
  readonly cursor: Cursor    // Cursor position
  readonly scrollHint?: ScrollHint  // DECSTBM scroll optimization
}
\`\`\``
      },
      {
        title: "10.8 Message Rendering: MessageRow Dispatch",
        content: `**src/components/messages/**

Message rendering chain:

\`\`\`
MessageRow.tsx → Message.tsx → AssistantTextMessage / UserToolResultMessage / ...
\`\`\`

**Message Type Dispatch**:

\`\`\`typescript
// MessageRow dispatches based on type
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

**Tool Result Rendering**:

\`\`\`
Tool Result → UserToolResultMessage → tool.renderToolResultMessage() → React Components
\`\`\`

Each Tool implements \`renderToolResultMessage()\` to customize output format.`
      },
      {
        title: "10.9 User Input: Event Capture Chain",
        content: `**src/ink/hooks/use-input.ts**

Input handling chain:

\`\`\`
Terminal input → useInput() hook → dispatcher.ts → component props
\`\`\`

**useInput Usage (REPL.tsx)**:

\`\`\`typescript
useInput((input, key) => {
  // input: string input
  // key: { upArrow, downArrow, delete, return, ... }

  if (key.return) {
    submitInput()  // Submit input
  } else if (key.ctrl && input === 'c') {
    interrupt()     // Interrupt
  } else if (key.upArrow) {
    historyPrev()   // Previous command history
  }
})
\`\`\`

**Event Propagation**:

\`\`\`typescript
// dispatcher.ts supports capture/bubble phases
dispatcher.dispatch(event, { phase: 'capture' | 'bubble' })

// Components declare handled events via props
<Box onKeyDown={handleKeyDown} />
\`\`\``
      },
      {
        title: "10.10 Connecting State and Rendering",
        content: `**How The Three Cooperate**

\`\`\`
State change (setState)
    │
    ├─→ onChangeAppState() side effect processing
    │
    └─→ React re-render
            │
            ├─→ useAppState() subscribed components update
            │
            └─→ Ink reconciler calculates new layout
                    │
                    └─→ Frame diff → Terminal output
\`\`\`

**Key Connection Points**:

| Connection | Mechanism |
|------------|-----------|
| State → UI | React useSyncExternalStore subscription |
| UI → State | useSetAppState() |
| Tool → State | ToolUseContext.getAppState/setAppState |
| Sub-Agent → State | setAppStateForTasks (penetrates nesting) |
| External → State | React Context (AppStateProvider) |

**REPL Launch Flow**:

\`\`\`typescript
await launchRepl(root, appProps, replProps, renderAndRun)

// Inside launchRepl:
const { App } = await import('./components/App.js');
const { REPL } = await import('./screens/REPL.js');

await renderAndRun(root,
  <App {...appProps}>
    <REPL {...replProps} />
  </App>
);
\`\`\`

**sessionConfig Passed to REPL**:

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
      "CLI entry uses Fast-Path to avoid unnecessary module loading, -v response < 10ms",
      "main.tsx has three stages: early init → command dispatch → interactive/non-interactive",
      "init() memoized to run once, setup() does runtime preparation",
      "Custom Store based on useSyncExternalStore, lighter than Zustand",
      "Messages stored in TaskState, not global AppState",
      "useAppState uses shallow compare to skip unchanged updates",
      "Ink uses Yoga for layout, Frame diff only writes changed cells",
      "State → React → Ink reconciler → Terminal output"
    ],
    relatedFiles: [
      "src/entrypoints/cli.tsx - CLI fast entry",
      "src/main.tsx (238KB) - Main application entry",
      "src/entrypoints/init.ts - Initialization",
      "src/state/store.ts - Store implementation",
      "src/state/AppStateStore.ts - AppState definition",
      "src/state/AppState.tsx - State hooks",
      "src/ink/ink.tsx - Ink TUI framework",
      "src/components/messages/ - Message rendering",
      "src/screens/REPL.tsx - REPL screen"
    ]
  },

  s11: {
    intro: `Foundation modules determine system robustness. Logging, networking, config, authentication — these seemingly peripheral modules are the last line of defense in production.

**Source Location**: src/utils/log.ts, src/utils/http.ts, src/utils/settings/, src/utils/auth.ts

This chapter is not about features, but mechanisms that keep the system "out of trouble".`,
    sections: [
      {
        title: "11.1 Logging System: Sink Pattern and Error Ring Buffer",
        content: `**src/utils/log.ts**

The logging system's core is **Sink Pattern** + **Pre-startup Event Queue**:

\`\`\`typescript
// Problem: early startup errors happen before sink is set
// Solution: queue first, drain after

let errorLogSink: ErrorLogSink | null = null
const queuedEvents: LogEvent[] = []

export function attachErrorLogSink(newSink: ErrorLogSink): void {
  if (errorLogSink !== null) return  // Set only once
  errorLogSink = newSink
  // Drain queued events immediately
  for (const event of queuedEvents) {
    errorLogSink(event)
  }
}

// Called before startup: join queue
export function logEvent(event: LogEvent): void {
  if (errorLogSink !== null) {
    errorLogSink(event)  // Has sink, write directly
  } else {
    queuedEvents.push(event)  // Still starting, queue
  }
}
\`\`\`

**Error Ring Buffer**:

\`\`\`typescript
const ERROR_RING_BUFFER_SIZE = 100
const errorRingBuffer = new CircularBuffer<ErrorEntry>(ERROR_RING_BUFFER_SIZE)

// Keep last 100 errors in memory for debugging
\`\`\``
      },
      {
        title: "11.2 Network Layer: Auth Headers and OAuth Retry",
        content: `**src/utils/http.ts**

Network layer's core is **automatic auth header injection** and **401 retry refresh**:

\`\`\`typescript
export function getAuthHeaders(): AuthHeaders {
  if (isClaudeAISubscriber()) {
    // OAuth user: use Bearer Token
    return {
      headers: {
        Authorization: \`Bearer \${oauthTokens.accessToken}\`,
        'anthropic-beta': OAUTH_BETA_HEADER
      }
    }
  }
  // API Key user: use x-api-key
  return {
    headers: { 'x-api-key': getAnthropicApiKey() }
  }
}
\`\`\`

**401 Retry Refresh**:

\`\`\`typescript
// When API returns 401, may be due to clock drift
// Automatically refresh token and retry
async function fetchWithRetry(url, options) {
  const response = await fetch(url, options)
  if (response.status === 401) {
    await refreshOAuthToken()  // Refresh
    return fetch(url, options)  // Retry
  }
  return response
}
\`\`\``
      },
      {
        title: "11.3 Config System: Multi-Source Merge and Priority",
        content: `**src/utils/settings/settings.ts**

Config comes from multiple sources, merged by priority:

\`\`\`
Priority from low to high:
1. Default values
2. User config (~/.claude/settings.json)
3. Project config (.claude/settings.json)
4. Local config (.claude/settings.local.json)
5. Policy config (managed settings + drop-ins)
6. Flag overrides (command line args)
\`\`\`

**Merge Logic**:

\`\`\`typescript
// Use lodash mergeWith, arrays concat not replace
const result = mergeWith({}, base, override, (obj, src) => {
  if (Array.isArray(src)) {
    return [...(obj || []), ...src]  // Array concatenation
  }
})

// Session-level cache to avoid repeated I/O
const getSettingsWithErrors = memoize(() => {
  return loadSettingsFromDisk()
})
\`\`\``
      },
      {
        title: "11.4 Auth System: Credential Chain and File Lock",
        content: `**src/utils/auth.ts**

Auth supports multiple sources, searched in order:

\`\`\`typescript
// Auth source priority chain
const authSourceChain = [
  process.env.CLAUDE_CODE_API_KEY,      // 1. Environment variable
  process.env.ANTHROPIC_API_KEY,         // 2. Legacy env var
  keychain.read('anthropic'),            // 3. Keychain
  settings.json.apiKey,                  // 4. Config file
  apiKeyHelper.read()                    // 5. Helper program
]

export const getAnthropicApiKey = memoize(() => {
  for (const source of authSourceChain) {
    if (source) return source
  }
  throw new Error('No API key found')
})
\`\`\`

**OAuth Token Refresh File Lock**:

\`\`\`typescript
// Prevent multiple processes from refreshing token simultaneously
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
        title: "11.5 Remote Connection: Layered Architecture",
        content: `**src/bridge/**

Remote connection uses layered architecture:

\`\`\`
bridge/
├── bridgeMain.ts      # Main entry
├── remoteBridgeCore.ts  # Core logic
├── replBridge.ts     # REPL bridge
├── bridgeMessaging.ts  # Messaging protocol
└── bridgeTransport.ts # Transport layer
\`\`\`

**Core Features**:
- WebSocket remote session
- JWT handling and refresh
- Permission bridging (remote permission passthrough)
- Session lifecycle management`
      },
      {
        title: "11.6 LSP Integration: Factory Function Pattern",
        content: `**src/services/lsp/**

LSP uses **factory function** instead of class:

\`\`\`typescript
// Factory function returns LSP instance encapsulated in closure
export function createLSPClient(
  serverName: string,
  onCrash?: (error: Error) => void
): LSPClient {
  let process: ChildProcess | undefined
  let connection: MessageConnection | undefined

  return {
    start: async () => { /* Start process */ },
    initialize: async (params) => { /* Send initialize request */ },
    sendRequest: async (method, params) => { /* JSON-RPC request */ },
    sendNotification: (method, params) => { /* Notification */ },
    onNotification: (method, handler) => { /* Subscribe to notification */ },
    onRequest: (method, handler) => { /* Subscribe to request */ },
    stop: () => { /* Cleanup */ }
  }
}
\`\`\`

**File Change Sync**:

\`\`\`typescript
// LSP server needs to know file open/edit/save/close
lspClient.sendNotification('textDocument/didOpen', { uri, text })
lspClient.sendNotification('textDocument/didChange', { uri, changes })
lspClient.sendNotification('textDocument/didSave', { uri })
lspClient.sendNotification('textDocument/didClose', { uri })
\`\`\``
      }
    ],
    keyTakeaways: [
      "Log Sink pattern ensures no early startup errors are lost",
      "Error ring buffer keeps last 100 errors for debugging",
      "Network layer auto-injects auth headers, 401 auto-refreshes OAuth",
      "Config multi-source merge, arrays concat not replace",
      "Auth source chain: env → keychain → config → helper",
      "OAuth refresh uses file lock to prevent concurrent refresh",
      "LSP uses factory function to encapsulate state instead of class"
    ],
    relatedFiles: [
      "src/utils/log.ts - Logging system",
      "src/utils/http.ts - Network layer",
      "src/utils/settings/settings.ts - Config system",
      "src/utils/auth.ts - Auth system",
      "src/bridge/ - Remote connection",
      "src/services/lsp/ - LSP integration"
    ]
  }
};
