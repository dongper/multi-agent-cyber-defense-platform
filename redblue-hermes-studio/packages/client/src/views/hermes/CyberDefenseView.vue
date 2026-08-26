<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NEmpty, NSpin, NTag, useMessage } from 'naive-ui'
import { getActiveProfileName } from '@/api/client'
import { runCyberDefenseChat } from '@/api/hermes/cyber-defense'
import { fetchConversationSummaries, type ConversationSummary } from '@/api/hermes/conversations'
import { getTask, listBoards, listTasks, type KanbanTask, type KanbanTaskDetail } from '@/api/hermes/kanban'
import { fetchSession, type HermesMessage, type SessionDetail } from '@/api/hermes/sessions'
import { createWorkflow, listWorkflows, type WorkflowRecord } from '@/api/hermes/workflows'
import CyberTaskWorkspace from '@/components/hermes/cyber-defense/CyberTaskWorkspace.vue'
import CyberAgentStudio from '@/components/hermes/cyber-defense/CyberAgentStudio.vue'
import { useAppStore } from '@/stores/hermes/app'
import {
  cloneCyberAgents,
  cloneCyberEdges,
  type CyberStudioAgent,
  type CyberStudioEdge,
} from '@/components/hermes/cyber-defense/cyber-studio'

type ViewName = 'overview' | 'tasks' | 'agents' | 'chain' | 'report'
type AgentRunStatus = 'idle' | 'running' | 'completed' | 'failed'
type TraceEvent = { id: string; agent: string; action: string; detail: string; at: number; status: 'info' | 'success' | 'warning' }

const BOARD = 'cyber-defense'
const STUDIO_KEY = 'redblue-hermes-studio-v2'
const SANITIZED_WAF_REPORT_URL = `${import.meta.env.BASE_URL}reports/robot-waf-practice-sanitized.html`
const router = useRouter()
const toast = useMessage()
const appStore = useAppStore()

const activeView = ref<ViewName>('overview')
const taskCreateRequest = ref(0)
const loading = ref(true)
const conversations = ref<ConversationSummary[]>([])
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

const navItems: Array<{ id: ViewName; label: string; icon: string }> = [
  { id: 'overview', label: '态势总览', icon: '◫' },
  { id: 'tasks', label: '任务中心', icon: '▣' },
  { id: 'agents', label: '智能体编排', icon: '◆' },
  { id: 'chain', label: '攻击链分析', icon: '⌁' },
  { id: 'report', label: '事件报告', icon: '▤' },
]

const viewMeta: Record<ViewName, { eyebrow: string; title: string; subtitle: string }> = {
  overview: { eyebrow: 'SECURITY OPERATIONS', title: '红蓝队安全运营态势', subtitle: '实时问答、授权任务与智能体运行状态' },
  tasks: { eyebrow: 'SECURITY TASK WORKSPACE', title: '红蓝队任务与协作会话', subtitle: '在任务中心完成创建、研判、问答与结果沉淀' },
  agents: { eyebrow: 'AGENT WORKFLOW STUDIO', title: '红蓝队智能体编排', subtitle: '拖动节点、建立连接、编辑配置并调用真实安全分析会话' },
  chain: { eyebrow: 'EVIDENCE-BACKED PATH', title: '攻击链与证据分析', subtitle: '只根据当前任务的真实消息、工具调用和执行记录生成视图' },
  report: { eyebrow: 'INCIDENT REPORT', title: '红蓝队事件报告', subtitle: '汇总真实任务、会话、智能体结果与证据引用' },
}

const activeMeta = computed(() => viewMeta[activeView.value])
const currentTask = computed(() => taskDetail.value?.task || tasks.value.find(task => task.id === selectedTaskId.value) || null)
const cutoff = computed(() => Math.floor(Date.now() / 1000) - periodDays.value * 86_400)
const periodConversations = computed(() => conversations.value.filter(item => item.last_active >= cutoff.value))
const qaMessages = computed(() => periodConversations.value.reduce((sum, item) => sum + item.message_count, 0))
const toolCalls = computed(() => periodConversations.value.reduce((sum, item) => sum + item.tool_call_count, 0))
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
  .slice(-14)
  .map((message, index) => ({
    id: String(message.id), index: index + 1, role: message.role,
    title: displaySafeText(message.tool_name || (message.role === 'user' ? '操作员输入' : message.role === 'assistant' ? '智能体分析' : '工具结果')),
    content: displaySafeText(message.content || message.tool_calls?.map(call => call?.function?.name || call?.name).filter(Boolean).join(', ') || '已记录工具调用'),
    at: message.timestamp,
  })))
const sessionToolNames = computed(() => Array.from(new Set(evidenceMessages.value.flatMap(message => {
  const names = [message.tool_name, ...(message.tool_calls || []).map(call => call?.function?.name || call?.name)]
  return names.filter((name): name is string => typeof name === 'string' && Boolean(name))
}))))

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
    const [summaryRows, workflowRows, boards] = await Promise.all([
      fetchConversationSummaries({ humanOnly: true, limit: 1000 }),
      listWorkflows(getActiveProfileName()),
      listBoards({ includeArchived: false }),
    ])
    conversations.value = summaryRows
    workflows.value = workflowRows
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

async function switchView(view: ViewName) {
  activeView.value = view
  if (view !== 'tasks') await loadData(false)
}

function openTaskCreator() {
  taskCreateRequest.value += 1
  activeView.value = 'tasks'
}

async function selectTask(id: string) {
  selectedTaskId.value = id
  await loadTaskDetail()
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
  void loadData()
})
</script>

<template>
  <div class="redblue-shell">
    <aside class="module-sidebar">
      <div class="module-brand"><span>RB</span><div><b>红蓝协同</b><small>智能安全运营平台</small></div></div>
      <nav>
        <button v-for="item in navItems" :key="item.id" :class="{ active: activeView === item.id }" @click="switchView(item.id)"><span>{{ item.icon }}</span>{{ item.label }}</button>
      </nav>
      <div class="runtime-card"><span class="live-dot" /><b>智能体运行服务</b><p>实时会话与工具统计</p><small>{{ authorizedTask ? '当前任务授权边界已记录' : '运行前需要确认任务边界' }}</small><button type="button" @click="router.push({ name: 'hermes.chat' })">进入通用问答</button></div>
    </aside>

    <section class="module-content">
      <header class="module-topbar">
        <div><small>{{ activeMeta.eyebrow }}</small><h1>{{ activeMeta.title }}</h1><p>{{ activeMeta.subtitle }}</p></div>
        <div class="top-actions"><NButton size="small" secondary @click="loadData()">刷新真实数据</NButton><NButton v-if="activeView !== 'tasks'" size="small" type="primary" @click="openTaskCreator">＋ 新建任务</NButton></div>
      </header>

      <NSpin :show="loading" class="module-body">
        <template v-if="activeView === 'overview'">
          <div class="metric-grid">
            <article><small>近 {{ periodDays }} 天问答会话</small><b>{{ periodConversations.length }}</b><p>最多读取 1,000 个真人会话</p></article>
            <article><small>问答消息</small><b>{{ qaMessages }}</b><p>任务会话真实消息数</p></article>
            <article><small>工具调用</small><b>{{ toolCalls }}</b><p>会话汇总口径</p></article>
            <article><small>智能体执行</small><b>{{ completedAgents }}</b><p>本次任务已完成运行</p></article>
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

            <section class="dark-panel trace-panel">
              <header class="panel-title"><div><small>EXECUTION TRACE</small><h2>真实运行时间线</h2></div><span>{{ trace.length }} 条</span></header>
              <div v-if="trace.length" class="trace-list"><article v-for="event in trace" :key="event.id" :class="event.status"><i /><div><small>{{ formatTime(event.at) }} · {{ displaySafeText(event.agent) }}</small><b>{{ displaySafeText(event.action) }}</b><p>{{ displaySafeText(event.detail) }}</p></div></article></div>
              <NEmpty v-else size="small" description="运行智能体后，这里显示真实执行记录" />
            </section>
          </div>
        </template>

        <CyberTaskWorkspace v-else-if="activeView === 'tasks'" embedded :create-request="taskCreateRequest" />

        <CyberAgentStudio
          v-else-if="activeView === 'agents'" :agents="agents" :edges="edges"
          :selected-id="selectedAgentId" :statuses="agentStatuses" :results="agentResults"
          @select="selectedAgentId = $event" @run="runAgent" @save="saveAgent" @create="createAgent"
          @positions="setAgentPositions" @edges="setEdges" @sync="syncWorkflow"
        />

        <template v-else-if="activeView === 'chain'">
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

        <template v-else-if="activeView === 'report'">
          <section class="dark-panel report-cover"><div><small>INCIDENT REPORT · {{ currentTask?.id || 'NO TASK' }}</small><h2>{{ currentTask ? displaySafeText(currentTask.title) : '尚未选择任务' }}</h2><p>报告仅汇总平台中实际存在的任务、会话、工具和智能体输出。</p></div><div class="report-cover-actions"><NButton tag="a" :href="SANITIZED_WAF_REPORT_URL" target="_blank" secondary>查看历史报告</NButton><NButton type="primary" :disabled="!currentTask" @click="exportReport">↓ 导出 JSON 报告</NButton></div></section>
          <section class="dark-panel imported-report-panel">
            <header class="panel-title"><div><small>AUTHORIZED VALIDATION ARCHIVE</small><h2>历史授权验证报告</h2></div><NTag type="success" size="small">已脱敏</NTag></header>
            <div class="imported-report-summary">
              <div><small>2026-08-25 · 内部脱敏</small><h3>机器人 WAF 加密机制验证方案与实践</h3><p>作为后续红队任务报告的版式参考，保留技术过程、验证方法和复核说明；真实目标、凭据、令牌、签名特征及原始截图均已替换或移除。</p></div>
              <div class="imported-report-actions"><NButton tag="a" :href="SANITIZED_WAF_REPORT_URL" target="_blank" type="primary">打开完整报告</NButton><NButton tag="a" :href="SANITIZED_WAF_REPORT_URL" download="机器人WAF验证报告-脱敏版-20260825.html" secondary>下载 HTML</NButton></div>
            </div>
            <iframe :src="SANITIZED_WAF_REPORT_URL" title="机器人 WAF 验证报告脱敏预览" loading="lazy" sandbox="" />
          </section>
          <div class="report-metrics"><article><span>01</span><h3>红队验证</h3><b>{{ redAgents.filter(agent => agentStatuses[agent.id] === 'completed').length }}/{{ redAgents.length }}</b><p>已完成真实运行的红队智能体</p></article><article><span>02</span><h3>蓝队研判</h3><b>{{ blueAgents.filter(agent => agentStatuses[agent.id] === 'completed').length }}/{{ blueAgents.length }}</b><p>已完成真实运行的蓝队智能体</p></article><article><span>03</span><h3>会话证据</h3><b>{{ evidenceRows.length }}</b><p>{{ sessionToolNames.length }} 个实际工具名称</p></article></div>
          <section class="dark-panel validation-panel">
            <header class="panel-title"><div><small>RED TEAM VALIDATION</small><h2>红队验证明细</h2></div><span>不展示固定置信度或预设结论</span></header>
            <div class="validation-list"><article v-for="agent in redAgents" :key="agent.id"><header><div><small>{{ displaySafeText(agent.role) }}</small><h3>{{ displaySafeText(agent.name) }}</h3></div><NTag :type="agentStatuses[agent.id] === 'completed' ? 'success' : agentStatuses[agent.id] === 'failed' ? 'error' : 'default'" size="small">{{ agentStatuses[agent.id] || 'idle' }}</NTag></header><p>{{ agentResults[agent.id] ? displaySafeText(agentResults[agent.id]) : '尚未产生真实运行结果。' }}</p></article></div>
          </section>
        </template>
      </NSpin>
    </section>
  </div>
</template>

<style scoped lang="scss" src="./CyberDefenseView.scss"></style>
