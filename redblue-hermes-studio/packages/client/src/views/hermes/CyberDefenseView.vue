<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NEmpty, NSpin, NTag, useMessage } from 'naive-ui'
import { getActiveProfileName } from '@/api/client'
import { runCyberDefenseChat } from '@/api/hermes/cyber-defense'
import { fetchConversationSummaries, type ConversationSummary } from '@/api/hermes/conversations'
import { getTask, listBoards, listTasks, type KanbanTask, type KanbanTaskDetail } from '@/api/hermes/kanban'
import { fetchSession, type HermesMessage, type SessionDetail } from '@/api/hermes/sessions'
import { fetchSkills } from '@/api/hermes/skills'
import { createWorkflow, listWorkflows, type WorkflowRecord } from '@/api/hermes/workflows'
import CyberTaskWorkspace from '@/components/hermes/cyber-defense/CyberTaskWorkspace.vue'
import CyberAgentStudio from '@/components/hermes/cyber-defense/CyberAgentStudio.vue'
import AlertNoiseWorkbench from '@/components/hermes/cyber-defense/AlertNoiseWorkbench.vue'
import { useAppStore } from '@/stores/hermes/app'
import {
  cloneCyberAgents,
  cloneCyberEdges,
  type CyberStudioAgent,
  type CyberStudioEdge,
} from '@/components/hermes/cyber-defense/cyber-studio'

type ViewName = 'overview' | 'tasks' | 'alerts' | 'agents' | 'chain' | 'report'
type AgentRunStatus = 'idle' | 'running' | 'completed' | 'failed'
type TraceEvent = { id: string; agent: string; action: string; detail: string; at: number; status: 'info' | 'success' | 'warning' }
type TaskRunState = {
  running: boolean
  taskId: string | null
  taskTitle: string
  phase: string
  elapsed: number
}

const BOARD = 'cyber-defense'
const STUDIO_KEY = 'redblue-hermes-studio-v2'
const TASK_STATUS_LABELS: Record<string, string> = {
  todo: '待处理', ready: '待处理', scheduled: '已排期', in_progress: '处理中', running: '处理中',
  triage: '研判中', review: '待复核', blocked: '已阻塞', done: '已完成', archived: '已归档',
}
const SANITIZED_WAF_REPORT_URL = `${import.meta.env.BASE_URL}reports/robot-waf-practice-sanitized.html`
const SANITIZED_10010_REPORT_URL = `${import.meta.env.BASE_URL}reports/10010-security-assessment-sanitized.html`
const archivedReports = [
  {
    id: '10010-security-assessment',
    code: 'SA',
    coverLabel: 'INTERNET EXPOSURE ASSESSMENT',
    coverTitle: '10010.com\n安全评估报告',
    coverMeta: '2026 · RED / BLUE ASSESSMENT',
    date: '2026-08-29',
    title: '10010.com 互联网暴露面安全评估',
    description: '整理 28 项风险发现、安全头与 TLS 配置、应用边界、资产暴露面及分阶段修复建议。IP、内部路径、凭据、利用代码与可识别细节均已脱敏，并标注为历史时点结论。',
    facts: [
      { value: '28', label: '风险发现' },
      { value: '6', label: '高危项' },
      { value: '已脱敏', label: '归档状态' },
    ],
    url: SANITIZED_10010_REPORT_URL,
    downloadName: '10010安全评估报告-脱敏版-20260829.html',
    tone: 'red',
  },
  {
    id: 'robot-waf-practice',
    code: 'RB',
    coverLabel: 'AUTHORIZED SECURITY REPORT',
    coverTitle: '机器人 WAF 加密机制\n验证方案与实践',
    coverMeta: '2026 · SECURITY OPERATIONS',
    date: '2026-08-25',
    title: '授权安全验证技术报告',
    description: '保留技术过程、验证方法和复核说明；目标、凭据、令牌、签名特征及原始截图均已替换或移除。完整文档作为归档附件保留，不再占用事件报告主视图。',
    facts: [
      { value: 'HTML', label: '报告格式' },
      { value: '内部', label: '数据级别' },
      { value: '已脱敏', label: '归档状态' },
    ],
    url: SANITIZED_WAF_REPORT_URL,
    downloadName: '机器人WAF验证报告-脱敏版-20260825.html',
    tone: 'blue',
  },
]
const router = useRouter()
const toast = useMessage()
const appStore = useAppStore()

const VIEW_NAMES: ViewName[] = ['overview', 'tasks', 'alerts', 'agents', 'chain', 'report']
const CACHED_VIEWS = new Set<ViewName>(['tasks', 'alerts', 'agents'])

function readViewFromHash(): ViewName {
  const hashQuery = window.location.hash.split('?')[1] || ''
  const queryView = new URLSearchParams(hashQuery).get('view') as ViewName | null
  return queryView && VIEW_NAMES.includes(queryView) ? queryView : 'overview'
}

function persistView(view: ViewName) {
  const next = view === 'overview' ? '#/security-operations' : `#/security-operations?view=${view}`
  if (window.location.hash !== next) history.replaceState(history.state, '', next)
}

const activeView = ref<ViewName>(readViewFromHash())
const cachedViews = ref<Set<ViewName>>(new Set(CACHED_VIEWS.has(activeView.value) ? [activeView.value] : []))
const taskCreateRequest = ref(0)
const taskRunState = ref<TaskRunState>({ running: false, taskId: null, taskTitle: '', phase: 'idle', elapsed: 0 })
const loading = ref(true)
const conversations = ref<ConversationSummary[]>([])
const skillCount = ref(0)
const workflows = ref<WorkflowRecord[]>([])
const tasks = ref<KanbanTask[]>([])
const selectedTaskId = ref<string | null>(null)
const taskDetail = ref<KanbanTaskDetail | null>(null)
const sessionDetail = ref<SessionDetail | null>(null)
const periodDays = ref(30)
const agents = ref<CyberStudioAgent[]>(cloneCyberAgents())
const edges = ref<CyberStudioEdge[]>(cloneCyberEdges())
const selectedAgentId = ref('red-commander')
const agentStatuses = ref<Record<string, AgentRunStatus>>({})
const agentResults = ref<Record<string, string>>({})
const trace = ref<TraceEvent[]>([])

const navItems: Array<{ id: ViewName; label: string; icon: string; child?: boolean }> = [
  { id: 'overview', label: '态势总览', icon: '◫' },
  { id: 'tasks', label: '任务中心', icon: '▣' },
  { id: 'alerts', label: '告警降噪研判', icon: '↳', child: true },
  { id: 'agents', label: '智能体编排', icon: '◆' },
  { id: 'chain', label: '攻击链分析', icon: '⌁' },
  { id: 'report', label: '报告中心', icon: '▤' },
]

const viewMeta: Record<ViewName, { eyebrow: string; title: string; subtitle: string }> = {
  overview: { eyebrow: 'SECURITY OPERATIONS', title: '红蓝队安全运营态势', subtitle: '实时问答、授权任务与智能体运行状态' },
  tasks: { eyebrow: 'SECURITY TASK WORKSPACE', title: '红蓝队任务与协作会话', subtitle: '在任务中心完成创建、研判、问答与结果沉淀' },
  alerts: { eyebrow: 'ALERT INTELLIGENCE', title: '告警降噪智能研判', subtitle: '从原始告警到多智能体调查、证据融合与可审计结论' },
  agents: { eyebrow: 'AGENT WORKFLOW STUDIO', title: '红蓝队智能体编排', subtitle: '拖动节点、建立连接、编辑配置并调用真实安全分析会话' },
  chain: { eyebrow: 'EVIDENCE-BACKED PATH', title: '攻击链与证据分析', subtitle: '只根据当前任务的真实消息、工具调用和执行记录生成视图' },
  report: { eyebrow: 'SECURITY REPORT CENTER', title: '红蓝队安全报告中心', subtitle: '汇总当前事件报告与已脱敏历史归档' },
}

const activeMeta = computed(() => viewMeta[activeView.value])
const taskRunElapsed = computed(() => {
  const seconds = taskRunState.value.elapsed
  const minutes = Math.floor(seconds / 60)
  return `${minutes ? `${minutes}m ` : ''}${String(seconds % 60).padStart(2, '0')}s`
})
const currentTask = computed(() => taskDetail.value?.task || tasks.value.find(task => task.id === selectedTaskId.value) || null)
const cutoff = computed(() => Math.floor(Date.now() / 1000) - periodDays.value * 86_400)
const periodConversations = computed(() => conversations.value.filter(item => item.last_active >= cutoff.value))
const qaMessages = computed(() => periodConversations.value.reduce((sum, item) => sum + item.message_count, 0))
const activeTasks = computed(() => tasks.value.filter(task => !['done', 'archived'].includes(task.status)))
const completedAgents = computed(() => Object.values(agentStatuses.value).filter(status => status === 'completed').length)
const redAgents = computed(() => agents.value.filter(agent => agent.group === 'red'))
const blueAgents = computed(() => agents.value.filter(agent => agent.group === 'blue'))
const authorizedTask = computed(() => /AUTHORIZED_SECURITY_(?:TEST|VALIDATION)/.test(currentTask.value?.body || ''))
const evidenceMessages = computed<HermesMessage[]>(() => {
  if (sessionDetail.value?.messages) return sessionDetail.value.messages
  return (taskDetail.value?.session?.messages || []) as HermesMessage[]
})
const evidenceRows = computed(() => evidenceMessages.value
  .filter(message => message.role !== 'system' && (message.content || message.tool_name || message.tool_calls?.length))
  .slice(-40)
  .map((message, index) => ({
    id: `${message.session_id}:${message.id}:${index}`, index: index + 1, role: message.role,
    title: displaySafeText(message.tool_name || (message.role === 'user' ? '操作员输入' : message.role === 'assistant' ? '智能体分析' : '工具结果')),
    content: displaySafeText(message.content || message.tool_calls?.map(call => call?.function?.name || call?.name).filter(Boolean).join(', ') || '已记录工具调用'),
    at: message.timestamp,
  })))
const sessionToolNames = computed(() => Array.from(new Set(evidenceMessages.value.flatMap(message => {
  const names = [message.tool_name, ...(message.tool_calls || []).map(call => call?.function?.name || call?.name)]
  return names.filter((name): name is string => typeof name === 'string' && Boolean(name))
}))))
const reportGeneratedAt = new Date().toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
const reportTaskStatus = computed(() => TASK_STATUS_LABELS[currentTask.value?.status || ''] || currentTask.value?.status || '未创建')
const reportPriority = computed(() => currentTask.value ? `P${currentTask.value.priority}` : '—')
const reportPriorityLabel = computed(() => ({ 0: '紧急', 1: '高', 2: '中', 3: '低' }[currentTask.value?.priority ?? 3] || '低'))
const reportTaskSummary = computed(() => displaySafeText(currentTask.value?.body || '')
  .replace(/^\s*\d+\s*/, '')
  .replace(/#{1,6}\s*/g, '')
  .replace(/\s+-\s+/g, ' · ')
  .replace(/\s+/g, ' ')
  .trim())
const reportTimelineRows = computed(() => evidenceRows.value.filter(row => {
  const content = `${row.title} ${row.content}`
  const conversational = /讲个?故事|年轻人叫|阿哲|故事讲完|你会做啥/
  const securitySignal = /告警|攻击|漏洞|授权|靶场|资产|风险|日志|证据|扫描|渗透|拒绝|验证|处置|工具|命令|端口|域名|\bIP\b/i
  return !conversational.test(content) && (row.role === 'tool' || securitySignal.test(content))
}).slice(-6))
const reportAgentFindings = computed(() => agents.value
  .filter(agent => agentStatuses.value[agent.id] === 'completed' && agentResults.value[agent.id])
  .map(agent => ({
    id: agent.id,
    name: displaySafeText(agent.name),
    role: displaySafeText(agent.role),
    group: agent.group,
    result: displaySafeText(agentResults.value[agent.id]),
  })))
const reportReadinessChecks = computed(() => [
  { label: '任务信息', detail: currentTask.value ? '任务标识与优先级已载入' : '尚未选择任务', ok: Boolean(currentTask.value) },
  { label: '授权边界', detail: authorizedTask.value ? '执行范围已在任务中记录' : '任务中未识别到授权确认', ok: authorizedTask.value },
  { label: '会话记录', detail: sessionDetail.value ? `${sessionDetail.value.message_count || 0} 条消息` : '尚未建立任务会话', ok: Boolean(sessionDetail.value) },
  { label: '证据节点', detail: evidenceRows.value.length ? `${evidenceRows.value.length} 个可追溯节点` : '尚无可引用证据', ok: evidenceRows.value.length > 0 },
  { label: '工具记录', detail: sessionToolNames.value.length ? `${sessionToolNames.value.length} 类工具` : '尚无工具调用记录', ok: sessionToolNames.value.length > 0 },
  { label: '智能体结论', detail: reportAgentFindings.value.length ? `${reportAgentFindings.value.length} 项已完成` : '尚无智能体结论', ok: reportAgentFindings.value.length > 0 },
])
const reportReadinessScore = computed(() => Math.round(reportReadinessChecks.value.filter(item => item.ok).length / reportReadinessChecks.value.length * 100))
const reportNextActions = computed(() => {
  const items: Array<{ title: string; detail: string; tone: 'critical' | 'warning' | 'info' }> = []
  if (!authorizedTask.value) items.push({ title: '补充授权边界', detail: '在任务中明确资产范围、执行窗口和授权确认后再开展操作。', tone: 'critical' })
  if (!sessionDetail.value) items.push({ title: '建立任务会话', detail: '进入任务中心创建会话，保留输入、分析过程和操作记录。', tone: 'warning' })
  if (!evidenceRows.value.length) items.push({ title: '采集可核验证据', detail: '关联告警、日志和工具输出，形成可追溯的事件时间线。', tone: 'warning' })
  if (!sessionToolNames.value.length) items.push({ title: '补充工具侧证据', detail: '在授权范围内运行必要的查询或分析工具，并保留调用结果。', tone: 'info' })
  if (!reportAgentFindings.value.length) items.push({ title: '执行专项智能体', detail: '根据事件类型选择红队或蓝队智能体，生成具备证据引用的结论。', tone: 'info' })
  if (!items.length) items.push({ title: '复核并归档报告', detail: '核对时间线、工具记录和智能体结论后导出报告归档。', tone: 'info' })
  return items.slice(0, 4)
})

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function displaySafeText(value: string | null | undefined) {
  return String(value || '')
    .replace(/AUTHORIZED_SECURITY_TEST/g, 'AUTHORIZED_SECURITY_VALIDATION')
    .replace(/测试/g, '验证')
}

function formatTime(value: number | null | undefined) {
  if (!value) return '—'
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function persistStudio() {
  localStorage.setItem(STUDIO_KEY, JSON.stringify({ agents: agents.value, edges: edges.value }))
}

function restoreStudio() {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDIO_KEY) || '{}') as { agents?: CyberStudioAgent[]; edges?: CyberStudioEdge[] }
    if (Array.isArray(saved.agents) && saved.agents.length) agents.value = saved.agents
    if (Array.isArray(saved.edges)) edges.value = saved.edges
  } catch {
    localStorage.removeItem(STUDIO_KEY)
  }
}

async function loadTaskDetail() {
  const id = selectedTaskId.value
  taskDetail.value = null
  sessionDetail.value = null
  if (!id) return
  try {
    taskDetail.value = await getTask(id, { board: BOARD })
    sessionDetail.value = await fetchSession(`cyber-defense-${id}`, getActiveProfileName())
  } catch {
    // A task can exist before its first Hermes conversation.
  }
}

async function loadData(showSpinner = true) {
  if (showSpinner) loading.value = true
  try {
    const [summaryRows, workflowRows, boards, skillRows] = await Promise.all([
      fetchConversationSummaries({ humanOnly: true, limit: 1000 }),
      listWorkflows(getActiveProfileName()),
      listBoards({ includeArchived: false }),
      fetchSkills(getActiveProfileName() || undefined).catch(() => ({ categories: [], archived: [] })),
    ])
    conversations.value = summaryRows
    workflows.value = workflowRows
    skillCount.value = skillRows.categories.reduce((total, category) => (
      total + category.skills.filter(skill => skill.enabled !== false).length
    ), 0)
    if (boards.some(board => board.slug === BOARD)) {
      tasks.value = await listTasks({ board: BOARD, includeArchived: true })
      if (!selectedTaskId.value || !tasks.value.some(task => task.id === selectedTaskId.value)) {
        selectedTaskId.value = tasks.value.find(task => !['done', 'archived'].includes(task.status))?.id || tasks.value[0]?.id || null
      }
      await loadTaskDetail()
    } else {
      tasks.value = []
      selectedTaskId.value = null
    }
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    loading.value = false
  }
}

function switchView(view: ViewName) {
  if (CACHED_VIEWS.has(view) && !cachedViews.value.has(view)) {
    cachedViews.value = new Set(cachedViews.value).add(view)
  }
  if (activeView.value === view) {
    persistView(view)
    return
  }
  activeView.value = view
  persistView(view)
}

function onHashChange() {
  const view = readViewFromHash()
  if (view === activeView.value) return
  if (CACHED_VIEWS.has(view) && !cachedViews.value.has(view)) {
    cachedViews.value = new Set(cachedViews.value).add(view)
  }
  activeView.value = view
}

function openTaskCreator() {
  taskCreateRequest.value += 1
  switchView('tasks')
}

async function selectTask(id: string) {
  selectedTaskId.value = id
  await loadTaskDetail()
}

function handleTaskRunState(state: TaskRunState) {
  const completedTaskId = taskRunState.value.running && !state.running
    ? taskRunState.value.taskId || state.taskId
    : null
  taskRunState.value = state
  if (completedTaskId && selectedTaskId.value === completedTaskId) void loadTaskDetail()
}

function saveAgent(agent: CyberStudioAgent) {
  agents.value = agents.value.map(item => item.id === agent.id ? agent : item)
  persistStudio()
}

function createAgent(agent: CyberStudioAgent) {
  agents.value = [...agents.value, agent]
  selectedAgentId.value = agent.id
  persistStudio()
}

function setAgentPositions(next: CyberStudioAgent[]) {
  agents.value = next
  persistStudio()
}

function setEdges(next: CyberStudioEdge[]) {
  edges.value = next
  persistStudio()
}

function addTrace(agent: string, action: string, detail: string, status: TraceEvent['status']) {
  trace.value = [{ id: `${Date.now()}-${Math.random()}`, agent, action, detail, at: Date.now(), status }, ...trace.value].slice(0, 20)
}

async function runAgent(agent: CyberStudioAgent) {
  if (agentStatuses.value[agent.id] === 'running') return
  if (!currentTask.value || !authorizedTask.value) {
    toast.warning('请先在任务中心创建并选择一个已确认授权边界的任务。')
    return
  }
  selectedAgentId.value = agent.id
  agentStatuses.value = { ...agentStatuses.value, [agent.id]: 'running' }
  addTrace(agent.name, '开始执行', `任务：${currentTask.value.title}；已载入该智能体的编排配置`, 'info')
  try {
    const response = await runCyberDefenseChat({
      session_id: `cyber-agent-${agent.id}-${currentTask.value.id}`,
      profile: getActiveProfileName() || undefined,
      model: appStore.selectedModel || undefined,
      provider: appStore.selectedProvider || undefined,
      timeout_ms: 900_000,
      input: [
        agent.systemPrompt, '',
        '必须遵守以下执行边界：只处理明确授权的 CTF、靶场、自有资产或离线证据；若范围、归属或影响不清楚，停止并请求确认。',
        `当前职责：${agent.role}`,
        `建议使用的已安装 Skills：${agent.skills.join(', ') || '按需选择'}`,
        `工作步骤：${agent.steps.join('；')}`, '',
        `任务标题：${currentTask.value.title}`,
        `任务内容：${currentTask.value.body || ''}`, '',
        '请完成当前智能体职责，并把已观察证据、分析结论、未知项和下一步建议分开输出。',
      ].join('\n'),
    })
    agentResults.value = { ...agentResults.value, [agent.id]: response.output || '安全智能体已完成运行，但本次未返回文本。' }
    agentStatuses.value = { ...agentStatuses.value, [agent.id]: 'completed' }
    addTrace(agent.name, '执行完成', response.output?.slice(0, 180) || '结果已写入任务会话。', 'success')
    await loadData(false)
  } catch (error) {
    agentStatuses.value = { ...agentStatuses.value, [agent.id]: 'failed' }
    addTrace(agent.name, '执行失败', errorText(error), 'warning')
    toast.error(errorText(error))
  }
}

async function syncWorkflow() {
  try {
    const record = await createWorkflow({
      name: `红蓝队协同编排 ${new Date().toLocaleString('zh-CN')}`,
      profile: getActiveProfileName() || 'default',
      nodes: agents.value.map((agent, index) => ({
        id: agent.id, type: 'agent', position: { x: agent.position.x * 10, y: agent.position.y * 7 },
        dragHandle: '.node-header', style: { width: '300px', height: '550px' },
        data: {
          title: agent.name, agent: 'hermes',
          input: `${agent.systemPrompt}\n\n职责：${agent.role}\n执行步骤：${agent.steps.join('；')}`,
          skills: agent.skills, images: [], approvalRequired: index === 0, orchestration: { join: 'all' },
        },
      })),
      edges: edges.value.map(edge => ({ ...edge, type: 'smoothstep', data: { orchestration: { route: 'success' } } })),
      viewport: { x: 20, y: 20, zoom: 0.65 },
    })
    workflows.value = [record, ...workflows.value]
    toast.success('已创建智能体工作流，可在拖拽画布中继续编辑和运行。')
    await router.push({ name: 'hermes.workflow' })
  } catch (error) {
    toast.error(errorText(error))
  }
}

function exportReport() {
  const report = {
    generated_at: new Date().toISOString(), source: 'RedBlue Security Operations Platform', task: currentTask.value ? {
      ...currentTask.value,
      title: displaySafeText(currentTask.value.title),
      body: displaySafeText(currentTask.value.body),
    } : null,
    session: sessionDetail.value ? {
      id: sessionDetail.value.id, model: sessionDetail.value.model,
      message_count: sessionDetail.value.message_count, tool_call_count: sessionDetail.value.tool_call_count,
    } : null,
    evidence: evidenceRows.value, tools: sessionToolNames.value,
    assessment: {
      priority: reportPriority.value,
      priority_label: reportPriorityLabel.value,
      task_status: reportTaskStatus.value,
      completeness: reportReadinessScore.value,
      findings: reportAgentFindings.value,
      recommended_actions: reportNextActions.value,
    },
    agents: agents.value.map(agent => ({
      id: agent.id, name: displaySafeText(agent.name), group: agent.group, status: agentStatuses.value[agent.id] || 'idle',
      result: agentResults.value[agent.id] ? displaySafeText(agentResults.value[agent.id]) : null,
    })),
    authorization: { confirmed: authorizedTask.value, rule: '仅限授权任务；生产变更需要人工审批' },
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${currentTask.value?.id || 'redblue'}-incident-report.json`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  restoreStudio()
  window.addEventListener('hashchange', onHashChange)
  void loadData()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <div class="redblue-shell">
    <aside class="module-sidebar">
      <div class="module-brand"><span>RB</span><div><b>红蓝协同</b><small>智能安全运营平台</small></div></div>
      <nav>
        <button v-for="item in navItems" :key="item.id" :class="{ active: activeView === item.id, child: item.child }" @click="switchView(item.id)"><span>{{ item.icon }}</span>{{ item.label }}</button>
      </nav>
      <div class="runtime-card"><span class="live-dot" /><b>智能体运行服务</b><p>实时会话与工具统计</p><small>{{ authorizedTask ? '当前任务授权边界已记录' : '运行前需要确认任务边界' }}</small><button type="button" @click="router.push({ name: 'hermes.chat' })">进入通用问答</button></div>
    </aside>

    <section class="module-content">
      <header class="module-topbar">
        <div><small>{{ activeMeta.eyebrow }}</small><h1>{{ activeMeta.title }}</h1><p>{{ activeMeta.subtitle }}</p></div>
        <div class="top-actions">
          <NButton v-if="taskRunState.running && activeView !== 'tasks'" size="small" type="info" secondary @click="switchView('tasks')">
            <span class="top-run-indicator"><i />{{ taskRunState.taskTitle || '当前任务' }}研判中 · {{ taskRunElapsed }}</span>
          </NButton>
          <NButton v-if="activeView !== 'alerts'" size="small" secondary @click="loadData()">刷新真实数据</NButton>
          <NButton v-if="activeView !== 'tasks' && activeView !== 'alerts'" size="small" type="primary" @click="openTaskCreator">＋ 新建任务</NButton>
        </div>
      </header>

      <NSpin :show="loading" class="module-body">
        <template v-if="activeView === 'overview'">
          <div class="metric-grid">
            <article><small>近 {{ periodDays }} 天问答会话</small><b>{{ periodConversations.length }}</b><p>最多读取 1,000 个真人会话</p></article>
            <article><small>问答消息</small><b>{{ qaMessages }}</b><p>任务会话真实消息数</p></article>
            <article><small>Skill 数量</small><b>{{ skillCount }}</b><p>当前已启用安全能力</p></article>
            <article><small>授权安全任务</small><b>{{ activeTasks.length }}<i>/{{ tasks.length }}</i></b><p>进行中 / 全部</p></article>
            <article><small>智能体编排</small><b>{{ agents.length }}</b><p>{{ redAgents.length }} 红队 · {{ blueAgents.length }} 蓝队</p></article>
          </div>

          <div class="overview-grid">
            <section class="dark-panel current-task-panel">
              <header class="panel-title"><div><small>CURRENT AUTHORIZED TASK</small><h2>当前任务</h2></div><NTag :type="authorizedTask ? 'success' : 'warning'" size="small">{{ authorizedTask ? '授权边界已记录' : '等待授权任务' }}</NTag></header>
              <template v-if="currentTask">
                <h3>{{ displaySafeText(currentTask.title) }}</h3><p>{{ displaySafeText(currentTask.body) }}</p>
                <div class="task-facts"><span>状态 <b>{{ currentTask.status }}</b></span><span>优先级 <b>P{{ currentTask.priority }}</b></span><span>会话 <b>{{ sessionDetail?.message_count || 0 }} 条消息</b></span></div>
                <NButton type="primary" @click="switchView('tasks')">进入任务问答</NButton>
              </template>
              <NEmpty v-else description="还没有真实红蓝队任务"><template #extra><NButton @click="openTaskCreator">创建任务</NButton></template></NEmpty>
            </section>

            <section class="dark-panel task-queue-panel">
              <header class="panel-title"><div><small>OPERATIONS QUEUE</small><h2>任务队列</h2></div><span>{{ tasks.length }} 项</span></header>
              <div v-if="tasks.length" class="overview-task-list"><button v-for="task in tasks.slice(0, 7)" :key="task.id" :class="{ active: task.id === selectedTaskId }" @click="selectTask(task.id)"><i :class="task.status" /><div><b>{{ displaySafeText(task.title) }}</b><small>P{{ task.priority }} · {{ task.status }}</small></div><span>{{ formatTime(task.created_at) }}</span></button></div>
              <NEmpty v-else size="small" description="暂无任务" />
            </section>

            <section class="dark-panel fleet-summary">
              <header class="panel-title"><div><small>AGENT FLEET</small><h2>智能体矩阵</h2></div><span>{{ completedAgents }}/{{ agents.length }} 已完成</span></header>
              <div class="fleet-groups"><div v-for="group in ['red', 'blue']" :key="group"><small>{{ group === 'red' ? 'RED TEAM' : 'BLUE TEAM' }}</small><button v-for="agent in agents.filter(item => item.group === group)" :key="agent.id" @click="selectedAgentId = agent.id; switchView('agents')"><span>{{ agent.icon }}</span><div><b>{{ displaySafeText(agent.name) }}</b><small>{{ displaySafeText(agent.role) }}</small></div><i :class="agentStatuses[agent.id] || 'idle'" /></button></div></div>
            </section>

          </div>
        </template>

        <CyberTaskWorkspace
          v-if="cachedViews.has('tasks')" v-show="activeView === 'tasks'" embedded
          :create-request="taskCreateRequest" @task-select="selectTask" @run-state="handleTaskRunState"
        />

        <AlertNoiseWorkbench v-if="cachedViews.has('alerts')" v-show="activeView === 'alerts'" />

        <CyberAgentStudio
          v-if="cachedViews.has('agents')" v-show="activeView === 'agents'" :agents="agents" :edges="edges"
          :selected-id="selectedAgentId" :statuses="agentStatuses" :results="agentResults"
          @select="selectedAgentId = $event" @run="runAgent" @save="saveAgent" @create="createAgent"
          @positions="setAgentPositions" @edges="setEdges" @sync="syncWorkflow"
        />

        <template v-if="activeView === 'chain'">
          <section class="dark-panel chain-panel">
            <header class="panel-title"><div><small>EVIDENCE-BACKED PATH</small><h2>{{ currentTask ? displaySafeText(currentTask.title) : '当前任务证据链' }}</h2></div><span>{{ evidenceRows.length ? `${evidenceRows.length} 个真实节点` : '等待会话数据' }}</span></header>
            <div v-if="evidenceRows.length" class="chain-flow"><article v-for="row in evidenceRows" :key="row.id" :class="row.role"><span>{{ row.index }}</span><div><b>{{ row.title }}</b><p>{{ row.content }}</p><small>{{ formatTime(row.at) }}</small></div><i v-if="row.index < evidenceRows.length">→</i></article></div>
            <NEmpty v-else description="当前任务尚无可用于攻击链分析的真实消息或工具记录"><template #extra><NButton @click="switchView('tasks')">进入任务问答</NButton></template></NEmpty>
          </section>
          <section class="dark-panel evidence-panel">
            <header class="panel-title"><div><small>OBSERVED EVIDENCE</small><h2>证据与工具</h2></div></header>
            <div class="evidence-facts"><article><small>任务会话</small><b>{{ sessionDetail?.id || '未创建' }}</b><p>{{ sessionDetail?.model || '—' }}</p></article><article><small>消息</small><b>{{ sessionDetail?.message_count || 0 }}</b><p>输入、分析与工具结果</p></article><article><small>工具</small><b>{{ sessionToolNames.length }}</b><p>{{ sessionToolNames.join(' · ') || '暂无工具调用' }}</p></article><article><small>授权边界</small><b>{{ authorizedTask ? '已记录' : '未记录' }}</b><p>不根据空白数据推断攻击链</p></article></div>
          </section>
        </template>

        <template v-if="activeView === 'report'">
          <section class="report-hero">
            <div class="report-hero-copy">
              <small>SECURITY INCIDENT ASSESSMENT · {{ currentTask?.id || 'NO TASK' }}</small>
              <div class="report-hero-tags">
                <NTag size="small" :type="authorizedTask ? 'success' : 'warning'">{{ authorizedTask ? '授权边界已记录' : '授权边界待补充' }}</NTag>
                <NTag size="small" :type="currentTask?.status === 'done' ? 'success' : currentTask?.status === 'blocked' ? 'error' : 'info'">{{ reportTaskStatus }}</NTag>
              </div>
              <h2>{{ currentTask ? displaySafeText(currentTask.title) : '尚未选择安全任务' }}</h2>
              <p>{{ currentTask ? '基于当前任务会话、证据节点、工具记录和智能体输出形成的动态事件报告。' : '选择任务后，平台将自动组织执行摘要、证据时间线和处置建议。' }}</p>
              <div class="report-hero-meta"><span>生成时间 <b>{{ reportGeneratedAt }}</b></span><span>数据范围 <b>当前任务</b></span><span>报告级别 <b>内部</b></span></div>
            </div>
            <div class="report-risk-card" :class="`priority-${currentTask?.priority ?? 3}`">
              <small>EVENT PRIORITY</small><strong>{{ reportPriority }}</strong><b>{{ reportPriorityLabel }}优先级</b><span>任务状态 · {{ reportTaskStatus }}</span>
            </div>
            <div class="report-cover-actions"><NButton secondary @click="switchView('tasks')">查看任务会话</NButton><NButton type="primary" :disabled="!currentTask" @click="exportReport">↓ 导出事件报告</NButton></div>
          </section>

          <div class="report-kpis">
            <article><span class="cyan">01</span><div><small>证据节点</small><b>{{ evidenceRows.length }}</b><p>可追溯的消息与工具结果</p></div></article>
            <article><span class="blue">02</span><div><small>任务会话</small><b>{{ sessionDetail?.message_count || 0 }}</b><p>{{ sessionDetail?.model || '尚未建立会话' }}</p></div></article>
            <article><span class="amber">03</span><div><small>工具记录</small><b>{{ sessionToolNames.length }}</b><p>{{ sessionToolNames.join(' · ') || '等待工具侧证据' }}</p></div></article>
            <article><span class="red">04</span><div><small>智能体结论</small><b>{{ reportAgentFindings.length }}</b><p>{{ completedAgents }} 个智能体完成运行</p></div></article>
          </div>

          <div class="report-dashboard-grid">
            <section class="dark-panel report-summary-card">
              <header class="panel-title"><div><small>EXECUTIVE SUMMARY</small><h2>执行摘要</h2></div><span>{{ reportPriority }} · {{ reportTaskStatus }}</span></header>
              <div class="report-summary-body">
                <div class="summary-mark"><span>RB</span><small>INCIDENT</small></div>
                <div><h3>{{ currentTask ? displaySafeText(currentTask.title) : '等待任务数据' }}</h3><p>{{ currentTask ? reportTaskSummary : '当前没有可用于生成报告的任务内容。' }}</p></div>
              </div>
              <div class="report-summary-facts"><span><small>授权状态</small><b>{{ authorizedTask ? '已确认' : '待补充' }}</b></span><span><small>任务优先级</small><b>{{ reportPriority }}</b></span><span><small>会话标识</small><b>{{ sessionDetail?.id || '未创建' }}</b></span></div>
            </section>

            <section class="dark-panel report-readiness-card">
              <header class="panel-title"><div><small>REPORT COMPLETENESS</small><h2>报告完整度</h2></div><span>基于当前可用数据</span></header>
              <div class="readiness-body">
                <div class="readiness-dial" :style="{ background: `conic-gradient(#48cfe0 ${reportReadinessScore * 3.6}deg, #142a3a 0deg)` }"><div><b>{{ reportReadinessScore }}</b><small>%</small></div></div>
                <div class="readiness-list"><span v-for="item in reportReadinessChecks" :key="item.label" :class="{ ok: item.ok }"><i>{{ item.ok ? '✓' : '·' }}</i><div><b>{{ item.label }}</b><small>{{ item.detail }}</small></div></span></div>
              </div>
            </section>
          </div>

          <section class="dark-panel report-timeline-panel">
            <header class="panel-title"><div><small>EVIDENCE TIMELINE</small><h2>事件证据时间线</h2></div><span>{{ reportTimelineRows.length }} / {{ evidenceRows.length }} 个最近节点</span></header>
            <div v-if="reportTimelineRows.length" class="report-timeline">
              <article v-for="row in reportTimelineRows" :key="row.id" :class="row.role"><div class="timeline-index">{{ String(row.index).padStart(2, '0') }}</div><div class="timeline-copy"><small>{{ formatTime(row.at) }} · {{ row.role === 'user' ? '操作员' : row.role === 'assistant' ? '智能体' : '工具' }}</small><b>{{ row.title }}</b><p>{{ row.content }}</p></div></article>
            </div>
            <NEmpty v-else description="任务会话产生消息或工具结果后，将自动形成证据时间线" />
          </section>

          <div class="report-lower-grid">
            <section class="dark-panel report-findings-panel">
              <header class="panel-title"><div><small>AGENT FINDINGS</small><h2>智能体关键发现</h2></div><span>{{ reportAgentFindings.length }} 项</span></header>
              <div v-if="reportAgentFindings.length" class="report-findings-list"><article v-for="finding in reportAgentFindings" :key="finding.id" :class="finding.group"><header><span>{{ finding.group === 'red' ? 'R' : 'B' }}</span><div><small>{{ finding.role }}</small><b>{{ finding.name }}</b></div></header><p>{{ finding.result }}</p></article></div>
              <NEmpty v-else description="运行专项智能体后，这里展示带证据引用的结论" />
            </section>

            <section class="dark-panel report-actions-panel">
              <header class="panel-title"><div><small>RECOMMENDED ACTIONS</small><h2>后续处置建议</h2></div><span>按当前缺口生成</span></header>
              <div class="report-action-list"><article v-for="(item, index) in reportNextActions" :key="item.title" :class="item.tone"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><b>{{ item.title }}</b><p>{{ item.detail }}</p></div></article></div>
            </section>
          </div>

          <section class="dark-panel report-archive-panel">
            <header class="panel-title"><div><small>REPORT ARCHIVE</small><h2>历史报告归档</h2></div><NTag type="success" size="small">{{ archivedReports.length }} 份内容已脱敏</NTag></header>
            <div class="report-archive-list">
              <article v-for="report in archivedReports" :key="report.id" class="report-archive-content" :class="`tone-${report.tone}`">
                <div class="archive-cover"><small>{{ report.coverLabel }}</small><strong>{{ report.code }}</strong><h3>{{ report.coverTitle }}</h3><span>{{ report.coverMeta }}</span></div>
                <div class="archive-description"><small>ARCHIVE / {{ report.date }}</small><h3>{{ report.title }}</h3><p>{{ report.description }}</p><div class="archive-facts"><span v-for="fact in report.facts" :key="fact.label"><b>{{ fact.value }}</b><small>{{ fact.label }}</small></span></div></div>
                <div class="imported-report-actions"><NButton tag="a" :href="report.url" target="_blank" type="primary">打开完整报告</NButton><NButton tag="a" :href="report.url" :download="report.downloadName" secondary>下载归档</NButton></div>
              </article>
            </div>
          </section>
        </template>
      </NSpin>
    </section>
  </div>
</template>

<style scoped lang="scss" src="./CyberDefenseView.scss"></style>
