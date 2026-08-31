<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCheckbox,
  NEmpty,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui'
import { getActiveProfileName } from '@/api/client'
import { startRunViaSocket, type RunEvent } from '@/api/hermes/chat'
import {
  completeTasks,
  createBoard,
  createTask,
  getStats,
  getTask,
  listBoards,
  listTasks,
  type KanbanStats,
  type KanbanTask,
  type KanbanTaskDetail,
} from '@/api/hermes/kanban'
import {
  fetchConversationDetail,
  fetchConversationSummaries,
  type ConversationMessage,
  type ConversationSummary,
} from '@/api/hermes/conversations'
import { fetchSession } from '@/api/hermes/sessions'
import { listWorkflows, type WorkflowRecord } from '@/api/hermes/workflows'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import { useAppStore } from '@/stores/hermes/app'

const BOARD = 'cyber-defense'
const TASK_MODELS_KEY = 'redblue-task-model-selections-v1'
const props = defineProps<{ embedded?: boolean; createRequest?: number }>()
const emit = defineEmits<{
  (event: 'task-select', taskId: string): void
  (event: 'run-state', state: {
    running: boolean
    taskId: string | null
    taskTitle: string
    phase: string
    elapsed: number
  }): void
}>()
const { t, locale } = useI18n()
const toast = useMessage()
const appStore = useAppStore()

const loading = ref(true)
const taskLoading = ref(false)
const chatLoading = ref(false)
const createLoading = ref(false)
const createVisible = ref(false)
const taskList = ref<KanbanTask[]>([])
const taskDetail = ref<KanbanTaskDetail | null>(null)
const selectedTaskId = ref<string | null>(null)
const conversations = ref<ConversationSummary[]>([])
const chatMessages = ref<ConversationMessage[]>([])
const workflows = ref<WorkflowRecord[]>([])
const stats = ref<KanbanStats>({ total: 0, by_status: {}, by_assignee: {} })
const periodDays = ref(30)
const taskFilter = ref('all')
const railMode = ref<'tasks' | 'history'>('tasks')
const contentMode = ref<'task' | 'history'>('task')
const historyLoading = ref(false)
const historyListLoading = ref(false)
const selectedHistoryId = ref<string | null>(null)
const historyMessages = ref<ConversationMessage[]>([])
const mode = ref('joint')
const selectedModelKey = ref('')
const composer = ref('')
const chatScroller = ref<HTMLElement | null>(null)
const liveAnswer = ref('')
const liveReasoning = ref('')
const liveTools = ref<Array<{ name: string; status: 'running' | 'done' | 'failed' }>>([])
const runPhase = ref<'idle' | 'connecting' | 'thinking' | 'answering' | 'tool' | 'stopping'>('idle')
const runElapsed = ref(0)
const runningTaskId = ref<string | null>(null)
const runningTaskTitle = ref('')
let activeRun: { abort: () => void } | null = null
let runClock: ReturnType<typeof setInterval> | null = null
let runStartedAt = 0
let runTerminalStatus: 'pending' | 'completed' | 'failed' | 'stopped' = 'pending'
let scrollFrame = 0

const form = ref({
  title: '',
  body: '',
  scene: 'authorized-lab',
  priority: 2,
  modelKey: '',
  authorized: false,
})
const taskModelSelections = ref<Record<string, string>>({})

const periodOptions = [7, 30, 90]
const statusOrder = ['running', 'ready', 'todo', 'triage', 'scheduled', 'review', 'blocked', 'done', 'archived']
const activeStatuses = new Set(['triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review'])

const sceneOptions = computed(() => [
  { label: t('cyberDefense.scenes.authorizedLab'), value: 'authorized-lab' },
  { label: t('cyberDefense.scenes.ctf'), value: 'ctf' },
  { label: t('cyberDefense.scenes.offlineEvidence'), value: 'offline-evidence' },
  { label: t('cyberDefense.scenes.ownedAsset'), value: 'owned-asset' },
])
const priorityOptions = computed(() => [
  { label: 'P1', value: 1 },
  { label: 'P2', value: 2 },
  { label: 'P3', value: 3 },
])
const modeOptions = computed(() => [
  { label: t('cyberDefense.modes.joint'), value: 'joint' },
  { label: t('cyberDefense.modes.red'), value: 'red' },
  { label: t('cyberDefense.modes.blue'), value: 'blue' },
])
const modelSelectionOptions = computed(() => appStore.modelGroups.flatMap(group => group.models.map(model => {
  const alias = appStore.modelAliases[group.provider]?.[model]
  return {
    label: `${group.label || group.provider} · ${alias ? `${alias} (${model})` : model}`,
    value: JSON.stringify([group.provider, model]),
  }
})))
const activeModel = computed(() => parseModelKey(selectedModelKey.value))
const selectedTask = computed(() => taskDetail.value?.task || null)
const filteredTasks = computed(() => taskList.value
  .filter(task => taskFilter.value === 'all' || activeStatuses.has(taskDisplayStatus(task)))
  .sort((a, b) => {
    const statusDelta = statusOrder.indexOf(taskDisplayStatus(a)) - statusOrder.indexOf(taskDisplayStatus(b))
    return statusDelta || b.created_at - a.created_at
  }))
const periodConversations = computed(() => {
  const cutoff = Math.floor(Date.now() / 1000) - periodDays.value * 86_400
  return conversations.value.filter(item => item.last_active >= cutoff)
})
const conversationHistory = computed(() => [...conversations.value]
  .sort((a, b) => b.last_active - a.last_active)
  .slice(0, 100))
const selectedHistory = computed(() => conversations.value.find(item => item.id === selectedHistoryId.value) || null)
const qaSessionCount = computed(() => periodConversations.value.length)
const qaMessageCount = computed(() => periodConversations.value.reduce((sum, item) => sum + item.message_count, 0))
const toolCallCount = computed(() => periodConversations.value.reduce((sum, item) => sum + item.tool_call_count, 0))
const activeTaskCount = computed(() => Object.entries(stats.value.by_status)
  .filter(([status]) => activeStatuses.has(status))
  .reduce((sum, [, count]) => sum + count, 0))
const completedTaskCount = computed(() => (stats.value.by_status.done || 0) + (stats.value.by_status.archived || 0))
const workflowAgentCount = computed(() => {
  return workflows.value.reduce((total, workflow) => total + workflow.nodes.filter(raw => {
    const node = raw as Record<string, unknown>
    return node.type === 'agent'
  }).length, 0)
})
const canRun = computed(() => /AUTHORIZED_SECURITY_(?:TEST|VALIDATION)/.test(selectedTask.value?.body || ''))

function taskSessionId(taskId: string): string {
  return `cyber-defense-${taskId}`
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseModelKey(key: string): { provider: string; model: string } | null {
  try {
    const value = JSON.parse(key) as unknown
    if (!Array.isArray(value) || value.length !== 2 || value.some(item => typeof item !== 'string')) return null
    return { provider: value[0], model: value[1] }
  } catch {
    return null
  }
}

function modelKey(provider: string | null | undefined, model: string | null | undefined): string {
  return provider && model ? JSON.stringify([provider, model]) : ''
}

function findModelKey(provider: string | null | undefined, model: string | null | undefined): string {
  if (!model) return ''
  const exact = modelSelectionOptions.value.find(option => option.value === modelKey(provider, model))
  if (exact) return exact.value
  return modelSelectionOptions.value.find(option => parseModelKey(option.value)?.model === model)?.value || ''
}

function persistTaskModelSelections() {
  localStorage.setItem(TASK_MODELS_KEY, JSON.stringify(taskModelSelections.value))
}

function restoreTaskModelSelections() {
  try {
    const saved = JSON.parse(localStorage.getItem(TASK_MODELS_KEY) || '{}') as Record<string, unknown>
    taskModelSelections.value = Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    taskModelSelections.value = {}
  }
}

function ensureModelSelection() {
  if (modelSelectionOptions.value.some(option => option.value === selectedModelKey.value)) return
  selectedModelKey.value = findModelKey(appStore.selectedProvider, appStore.selectedModel) || modelSelectionOptions.value[0]?.value || ''
  if (!form.value.modelKey) form.value.modelKey = selectedModelKey.value
}

function statusLabel(status: string): string {
  return t(`cyberDefense.status.${status}`, status)
}

function statusType(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'done') return 'success'
  if (status === 'blocked') return 'error'
  if (status === 'running' || status === 'review') return 'info'
  if (status === 'ready' || status === 'scheduled') return 'warning'
  return 'default'
}

function taskDisplayStatus(task: KanbanTask): string {
  if (chatLoading.value && runningTaskId.value === task.id) return 'running'
  if (task.status !== 'blocked') return task.status
  const conversation = conversations.value.find(item => item.id === taskSessionId(task.id))
  return conversation && conversation.message_count >= 2 && !conversation.is_active ? 'done' : task.status
}

function formatTime(value: number | null | undefined): string {
  if (!value) return '—'
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value
  return new Intl.DateTimeFormat(locale.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function brandSafeText(value: string | null | undefined, hideCapabilityDetails = true): string {
  let text = String(value || '')
    .replace(/Hermes Studio/gi, '红蓝队协同安全运营平台')
    .replace(/Hermes/gi, '联通安全智能体')
    .replace(/AUTHORIZED_SECURITY_TEST/g, 'AUTHORIZED_SECURITY_VALIDATION')
    .replace(/测试/g, '验证')
  if (hideCapabilityDetails) {
    text = text.split('\n').map(line => (
      /CTF\s*技能|ctf-[a-z0-9_-]+/i.test(line)
        ? '内部安全能力已按需加载（实现名称不在前端展示）。'
        : line
    )).filter((line, index, rows) => line !== rows[index - 1]).join('\n')
  }
  return text
}

function runFailureText(value: string | null | undefined): string {
  const error = String(value || '').trim()
  if (/HTTP\s*402\b|Insufficient Balance/i.test(error)) return '模型服务余额不足，请检查当前模型账户额度后重试。'
  if (/HTTP\s*401\b|^Unauthorized\.?$/i.test(error)) return '模型服务认证失败，请检查当前模型配置后重试。'
  if (/timeout|timed out/i.test(error)) return '本次请求等待超时，你可以重试或切换模型。'
  return brandSafeText(error || t('cyberDefense.runFailed'))
}

function displayMessageContent(message: ConversationMessage): string {
  const content = String(message.content || '')
  if (message.role === 'user') {
    const marker = '【操作员本轮请求】'
    const markerIndex = content.lastIndexOf(marker)
    if (markerIndex >= 0) return brandSafeText(content.slice(markerIndex + marker.length).trim(), false)
    return brandSafeText(content, false)
  }
  return brandSafeText(content)
}

function resetForm() {
  form.value = {
    title: '',
    body: '',
    scene: 'authorized-lab',
    priority: 2,
    modelKey: selectedModelKey.value,
    authorized: false,
  }
}

async function ensureBoard(): Promise<void> {
  const boards = await listBoards({ includeArchived: false })
  if (boards.some(board => board.slug === BOARD)) return
  await createBoard({
    slug: BOARD,
    name: t('cyberDefense.boardName'),
    description: t('cyberDefense.boardDescription'),
    icon: '🛡️',
    color: '#4a5568',
    switchCurrent: false,
  })
}

async function loadTaskList(): Promise<void> {
  const boards = await listBoards({ includeArchived: false })
  if (!boards.some(board => board.slug === BOARD)) {
    taskList.value = []
    stats.value = { total: 0, by_status: {}, by_assignee: {} }
    selectedTaskId.value = null
    taskDetail.value = null
    chatMessages.value = []
    return
  }
  const [tasks, nextStats] = await Promise.all([
    listTasks({ board: BOARD, includeArchived: true }),
    getStats({ board: BOARD }),
  ])
  taskList.value = tasks
  stats.value = nextStats
  if (!selectedTaskId.value || !tasks.some(task => task.id === selectedTaskId.value)) {
    selectedTaskId.value = tasks.find(task => activeStatuses.has(task.status))?.id || tasks[0]?.id || null
  }
}

async function loadTask(id: string | null): Promise<void> {
  if (!id) {
    taskDetail.value = null
    chatMessages.value = []
    return
  }
  taskLoading.value = true
  try {
    const savedModel = taskModelSelections.value[id]
    if (savedModel && modelSelectionOptions.value.some(option => option.value === savedModel)) selectedModelKey.value = savedModel
    const detail = await getTask(id, { board: BOARD })
    if (selectedTaskId.value !== id) return
    taskDetail.value = detail
    emit('task-select', id)
    await loadConversation(id)
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    taskLoading.value = false
  }
}

async function loadConversation(taskId: string): Promise<void> {
  const sessionId = taskSessionId(taskId)
  const session = await fetchSession(sessionId, getActiveProfileName() || undefined)
  let nextMessages: ConversationMessage[] = []
  if (session?.messages?.length) {
    nextMessages = session.messages
      .filter(message => (message.role === 'user' || message.role === 'assistant') && (message.content || message.reasoning))
      .map(message => ({
        id: message.id,
        session_id: sessionId,
        role: message.role as 'user' | 'assistant',
        content: message.content || '',
        reasoning: message.reasoning || undefined,
        timestamp: message.timestamp,
      }))
  } else {
    try {
      const detail = await fetchConversationDetail(sessionId)
      nextMessages = detail.messages
    } catch {
      nextMessages = []
    }
  }
  if (selectedTaskId.value !== taskId) return
  if (!taskModelSelections.value[taskId] && session?.model) {
    const sessionModel = findModelKey(session.provider, session.model)
    if (sessionModel) selectedModelKey.value = sessionModel
  }
  chatMessages.value = nextMessages
  await nextTick()
  scrollToLatest(false)
}

function scrollToLatest(smooth = true) {
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    chatScroller.value?.scrollTo({
      top: chatScroller.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  })
}

function resetLiveRun() {
  liveAnswer.value = ''
  liveReasoning.value = ''
  liveTools.value = []
  runPhase.value = 'idle'
  runElapsed.value = 0
  if (runClock) clearInterval(runClock)
  runClock = null
  runStartedAt = 0
  runningTaskId.value = null
  runningTaskTitle.value = ''
  runTerminalStatus = 'pending'
  activeRun = null
}

function beginRunClock() {
  runStartedAt = Date.now()
  runElapsed.value = 0
  if (runClock) clearInterval(runClock)
  runClock = setInterval(() => {
    runElapsed.value = Math.floor((Date.now() - runStartedAt) / 1000)
  }, 1000)
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes ? `${minutes}m ` : ''}${String(seconds % 60).padStart(2, '0')}s`
}

function handleRunEvent(event: RunEvent) {
  if (event.event === 'run.started') runPhase.value = 'thinking'
  if (event.event === 'reasoning.delta' || event.event === 'thinking.delta') {
    liveReasoning.value += event.text || event.delta || ''
    runPhase.value = 'thinking'
  } else if (event.event === 'message.delta') {
    liveAnswer.value += event.delta || ''
    runPhase.value = 'answering'
  } else if (event.event === 'message.interim' && event.text) {
    liveAnswer.value = event.text
    runPhase.value = 'answering'
  } else if (event.event === 'tool.started') {
    const name = event.tool || event.name || t('cyberDefense.unknownTool')
    liveTools.value.push({ name, status: 'running' })
    runPhase.value = 'tool'
  } else if (event.event === 'tool.completed' || event.event === 'tool.failed') {
    const name = event.tool || event.name || t('cyberDefense.unknownTool')
    const item = [...liveTools.value].reverse().find(tool => tool.name === name && tool.status === 'running')
    if (item) item.status = event.event === 'tool.failed' ? 'failed' : 'done'
  } else if (event.event === 'run.completed') {
    runTerminalStatus = 'completed'
    if (!liveAnswer.value.trim() && typeof event.output === 'string') liveAnswer.value = event.output
  } else if (event.event === 'run.failed') {
    runTerminalStatus = 'failed'
    liveAnswer.value ||= runFailureText(event.error)
  }
  scrollToLatest()
}

async function settleRun(taskId: string) {
  const savedAnswer = liveAnswer.value
  const completed = runTerminalStatus === 'completed'
  chatLoading.value = false
  if (runClock) clearInterval(runClock)
  runClock = null
  activeRun = null
  try {
    if (completed) {
      await completeTasks([taskId], '智能体问答已完成，结果已写入任务会话。', { board: BOARD })
      await loadTaskList()
    }
    if (selectedTaskId.value === taskId) {
      if (completed) await loadTask(taskId)
      else await loadConversation(taskId)
    }
    if (selectedTaskId.value === taskId && savedAnswer.trim() && !chatMessages.value.some(message => message.role === 'assistant' && message.content.trim() === savedAnswer.trim())) {
      chatMessages.value.push({
        id: `local-answer-${Date.now()}`,
        session_id: taskSessionId(taskId),
        role: 'assistant',
        content: savedAnswer,
        reasoning: liveReasoning.value || undefined,
        timestamp: Date.now(),
      })
    }
    conversations.value = await fetchConversationSummaries({ humanOnly: true, limit: 1000 })
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    runPhase.value = 'idle'
    runningTaskId.value = null
    runningTaskTitle.value = ''
    runTerminalStatus = 'pending'
    await nextTick()
    scrollToLatest()
  }
}

async function loadOverview(): Promise<void> {
  loading.value = true
  try {
    const [summaryRows, workflowRows] = await Promise.all([
      fetchConversationSummaries({ humanOnly: true, limit: 1000 }),
      listWorkflows(getActiveProfileName()),
    ])
    conversations.value = summaryRows
    workflows.value = workflowRows
    await loadTaskList()
    await loadTask(selectedTaskId.value)
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    loading.value = false
  }
}

function changePeriod(days: number) {
  periodDays.value = days
}

async function selectTask(id: string) {
  railMode.value = 'tasks'
  contentMode.value = 'task'
  if (selectedTaskId.value === id) return
  selectedTaskId.value = id
  await loadTask(id)
}

async function openConversationHistory(summary: ConversationSummary) {
  railMode.value = 'history'
  contentMode.value = 'history'
  selectedHistoryId.value = summary.id
  historyMessages.value = []
  historyLoading.value = true
  try {
    const detail = await fetchConversationDetail(summary.id)
    historyMessages.value = detail.messages
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    historyLoading.value = false
    await nextTick()
    scrollToLatest(false)
  }
}

async function showConversationHistory() {
  railMode.value = 'history'
  historyListLoading.value = true
  try {
    conversations.value = await fetchConversationSummaries({ humanOnly: true, limit: 1000 })
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    historyListLoading.value = false
  }
}

function returnToTask() {
  railMode.value = 'tasks'
  contentMode.value = 'task'
  selectedHistoryId.value = null
  historyMessages.value = []
  void nextTick().then(() => scrollToLatest(false))
}

async function handleCreateTask() {
  const title = form.value.title.trim()
  const body = form.value.body.trim()
  if (!title || !body || !form.value.authorized) return
  createLoading.value = true
  try {
    await ensureBoard()
    const createdModelKey = form.value.modelKey || selectedModelKey.value
    const scene = sceneOptions.value.find(item => item.value === form.value.scene)?.label || form.value.scene
    const task = await createTask({
      title,
      body: [
        body,
        '',
        `## ${t('cyberDefense.executionBoundary')}`,
        `- ${t('cyberDefense.sceneLabel')}: ${scene}`,
        `- ${t('cyberDefense.authorizationLabel')}: AUTHORIZED_SECURITY_VALIDATION`,
        `- ${t('cyberDefense.boundaryRule')}`,
      ].join('\n'),
      priority: form.value.priority,
      triage: false,
      skills: [],
      goalMode: true,
    }, { board: BOARD })
    if (createdModelKey) {
      taskModelSelections.value = { ...taskModelSelections.value, [task.id]: createdModelKey }
      persistTaskModelSelections()
      selectedModelKey.value = createdModelKey
    }
    createVisible.value = false
    resetForm()
    await loadTaskList()
    selectedTaskId.value = task.id
    contentMode.value = 'task'
    await loadTask(task.id)
    toast.success(t('cyberDefense.taskCreated'))
  } catch (error) {
    toast.error(errorText(error))
  } finally {
    createLoading.value = false
  }
}

function buildRunInput(userInput: string): string {
  const task = selectedTask.value
  return [
    t('cyberDefense.runInstruction'),
    '',
    `【${t('cyberDefense.taskContext')}】`,
    `${t('cyberDefense.taskTitle')}: ${task?.title || ''}`,
    `${t('cyberDefense.modeLabel')}: ${modeOptions.value.find(item => item.value === mode.value)?.label || mode.value}`,
    task?.body || '',
    '',
    `【${t('cyberDefense.currentRequest')}】`,
    userInput,
  ].join('\n')
}

function sendMessage() {
  const input = composer.value.trim()
  const task = selectedTask.value
  if (!input || !task || !canRun.value || chatLoading.value) return
  const optimistic: ConversationMessage = {
    id: `local-${Date.now()}`,
    session_id: taskSessionId(task.id),
    role: 'user',
    content: input,
    timestamp: Date.now(),
  }
  chatMessages.value.push(optimistic)
  composer.value = ''
  chatLoading.value = true
  runningTaskId.value = task.id
  runningTaskTitle.value = brandSafeText(task.title, false)
  runTerminalStatus = 'pending'
  liveAnswer.value = ''
  liveReasoning.value = ''
  liveTools.value = []
  runPhase.value = 'connecting'
  beginRunClock()
  void nextTick().then(() => scrollToLatest())
  try {
    activeRun = startRunViaSocket({
      input: buildRunInput(input),
      display_input: input,
      session_id: taskSessionId(task.id),
      profile: getActiveProfileName() || undefined,
      model: activeModel.value?.model || undefined,
      provider: activeModel.value?.provider || undefined,
      source: 'api_server',
    }, handleRunEvent, () => void settleRun(task.id), (error) => {
      chatLoading.value = false
      runTerminalStatus = 'failed'
      liveAnswer.value ||= errorText(error)
      runPhase.value = 'idle'
      if (runClock) clearInterval(runClock)
      runClock = null
      runningTaskId.value = null
      runningTaskTitle.value = ''
      activeRun = null
      toast.error(errorText(error))
    })
  } catch (error) {
    chatMessages.value = chatMessages.value.filter(message => message.id !== optimistic.id)
    resetLiveRun()
    chatLoading.value = false
    toast.error(errorText(error))
  }
}

function stopRun() {
  if (!activeRun || !chatLoading.value) return
  runTerminalStatus = 'stopped'
  runPhase.value = 'stopping'
  activeRun.abort()
}

function returnToRunningTask() {
  if (!runningTaskId.value) return
  void selectTask(runningTaskId.value)
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return
  event.preventDefault()
  sendMessage()
}

async function markDone() {
  if (!selectedTask.value) return
  try {
    await completeTasks([selectedTask.value.id], t('cyberDefense.completedFromWorkspace'), { board: BOARD })
    await loadTaskList()
    await loadTask(selectedTaskId.value)
    toast.success(t('cyberDefense.taskCompleted'))
  } catch (error) {
    toast.error(errorText(error))
  }
}

onMounted(() => {
  restoreTaskModelSelections()
  if ((props.createRequest || 0) > 0) createVisible.value = true
  void (async () => {
    await appStore.loadModels()
    ensureModelSelection()
    await loadOverview()
  })()
})
watch(() => props.createRequest, (next, previous) => {
  if (next && next !== previous) {
    form.value.modelKey = selectedModelKey.value
    createVisible.value = true
  }
})
watch(modelSelectionOptions, () => ensureModelSelection())
watch(selectedModelKey, key => {
  const selection = parseModelKey(key)
  if (!selection) return
  appStore.selectedProvider = selection.provider
  appStore.selectedModel = selection.model
  if (!selectedTaskId.value) return
  taskModelSelections.value = { ...taskModelSelections.value, [selectedTaskId.value]: key }
  persistTaskModelSelections()
})
watch(
  [chatLoading, runPhase, runElapsed, runningTaskId, runningTaskTitle],
  () => emit('run-state', {
    running: chatLoading.value,
    taskId: runningTaskId.value,
    taskTitle: runningTaskTitle.value,
    phase: runPhase.value,
    elapsed: runElapsed.value,
  }),
  { immediate: true },
)
onBeforeUnmount(() => {
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  if (runClock) clearInterval(runClock)
  activeRun?.abort()
})
</script>

<template>
  <div class="cyber-view" :class="{ embedded }">
    <header v-if="!embedded" class="page-header cyber-header">
      <div>
        <h2 class="header-title">{{ t('cyberDefense.title') }}</h2>
        <p>{{ t('cyberDefense.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <NButton quaternary size="small" :loading="loading" @click="loadOverview">{{ t('cyberDefense.refresh') }}</NButton>
        <NButton type="primary" size="small" @click="createVisible = true">{{ t('cyberDefense.newTask') }}</NButton>
      </div>
    </header>

    <NSpin :show="loading" class="cyber-body">
      <section v-if="!embedded" class="overview-panel">
        <div class="overview-heading">
          <div>
            <h3>{{ t('cyberDefense.qaOverview') }}</h3>
            <span>{{ t('cyberDefense.metricScope', { days: periodDays }) }}</span>
          </div>
          <div class="period-switch">
            <NButton
              v-for="days in periodOptions"
              :key="days"
              size="tiny"
              :type="periodDays === days ? 'primary' : 'default'"
              :quaternary="periodDays !== days"
              @click="changePeriod(days)"
            >{{ days }}d</NButton>
          </div>
        </div>
        <div class="metric-grid">
          <div class="metric-card">
            <strong>{{ qaSessionCount }}</strong>
            <span>{{ t('cyberDefense.metrics.sessions') }}</span>
          </div>
          <div class="metric-card">
            <strong>{{ qaMessageCount }}</strong>
            <span>{{ t('cyberDefense.metrics.messages') }}</span>
          </div>
          <div class="metric-card">
            <strong>{{ toolCallCount }}</strong>
            <span>{{ t('cyberDefense.metrics.toolCalls') }}</span>
          </div>
          <div class="metric-card">
            <strong>{{ completedTaskCount }}</strong>
            <span>{{ t('cyberDefense.metrics.completedTasks') }}</span>
          </div>
          <div class="metric-card">
            <strong>{{ activeTaskCount }}<small>/{{ stats.total }}</small></strong>
            <span>{{ t('cyberDefense.metrics.tasks') }}</span>
          </div>
          <div class="metric-card">
            <strong>{{ workflowAgentCount }}</strong>
            <span>{{ t('cyberDefense.metrics.workflowAgents') }}</span>
          </div>
        </div>
      </section>

      <section class="workspace-grid">
        <aside class="task-rail">
          <div class="section-toolbar">
            <div>
              <h3>{{ railMode === 'tasks' ? t('cyberDefense.taskModule') : '历史问答' }}</h3>
              <span>{{ railMode === 'tasks' ? `${filteredTasks.length} ${t('cyberDefense.items')}` : `${conversations.length} 个真实会话` }}</span>
            </div>
            <div class="rail-tabs">
              <button :class="{ active: railMode === 'tasks' }" @click="railMode = 'tasks'">安全任务</button>
              <button :class="{ active: railMode === 'history' }" @click="showConversationHistory">历史问答</button>
            </div>
            <div v-if="railMode === 'tasks'" class="task-rail-actions">
              <NButton size="tiny" type="primary" @click="createVisible = true">＋ {{ t('cyberDefense.newTask') }}</NButton>
              <NSelect v-model:value="taskFilter" size="tiny" :options="[
                { label: t('cyberDefense.activeOnly'), value: 'active' },
                { label: t('cyberDefense.allTasks'), value: 'all' },
              ]" />
            </div>
          </div>
          <div v-if="railMode === 'tasks' && filteredTasks.length" class="task-list">
            <button
              v-for="task in filteredTasks"
              :key="task.id"
              class="task-row"
              :class="{ active: selectedTaskId === task.id }"
              @click="selectTask(task.id)"
            >
              <div class="task-row-top">
                <NTag size="tiny" :type="statusType(taskDisplayStatus(task))" :bordered="false">{{ statusLabel(taskDisplayStatus(task)) }}</NTag>
                <span>P{{ task.priority }}</span>
              </div>
              <strong>{{ brandSafeText(task.title, false) }}</strong>
              <p>{{ task.body ? brandSafeText(task.body, false) : t('cyberDefense.noDescription') }}</p>
              <time>{{ formatTime(task.created_at) }}</time>
            </button>
          </div>
          <NEmpty v-else-if="railMode === 'tasks'" size="small" :description="t('cyberDefense.noTasks')">
            <template #extra>
              <NButton size="small" @click="createVisible = true">{{ t('cyberDefense.createFirstTask') }}</NButton>
            </template>
          </NEmpty>
          <div v-if="railMode === 'history'" class="history-refresh-row">
            <span>已合并通用问答与任务会话</span>
            <NButton size="tiny" secondary :loading="historyListLoading" @click="showConversationHistory">刷新记录</NButton>
          </div>
          <div v-if="railMode === 'history' && conversationHistory.length" class="history-list rail-history-list">
            <button
              v-for="conversation in conversationHistory"
              :key="conversation.id"
              class="history-row"
              :class="{ active: contentMode === 'history' && selectedHistoryId === conversation.id }"
              @click="openConversationHistory(conversation)"
            >
              <div class="history-row-top">
                <span>{{ formatTime(conversation.last_active) }}</span>
                <small>{{ conversation.message_count }} 条</small>
              </div>
              <strong>{{ brandSafeText(conversation.title || conversation.preview || '未命名会话', false) }}</strong>
              <p>{{ brandSafeText(conversation.preview || '点击查看完整问答记录', false) }}</p>
            </button>
          </div>
          <NEmpty v-else-if="railMode === 'history'" size="small" description="暂无历史问答" />
        </aside>

        <main class="task-main">
          <NSpin :show="taskLoading || historyLoading">
            <template v-if="contentMode === 'history'">
              <div class="task-heading history-heading">
                <div>
                  <div class="eyebrow">CONVERSATION ARCHIVE</div>
                  <h3>{{ brandSafeText(selectedHistory?.title || selectedHistory?.preview || '历史问答', false) }}</h3>
                  <div class="tag-row">
                    <NTag size="small" type="info">历史问答</NTag>
                    <NTag v-if="selectedHistory?.model" size="small" :bordered="false">{{ selectedHistory.model }}</NTag>
                    <span class="history-time">{{ formatTime(selectedHistory?.last_active) }}</span>
                  </div>
                </div>
                <div class="task-actions">
                  <NButton size="small" secondary @click="returnToTask">返回当前任务</NButton>
                </div>
              </div>

              <div v-if="chatLoading" class="history-run-banner">
                <div><i class="pulse-dot" /><span><b>{{ runningTaskTitle || '当前任务' }}</b> 正在后台研判 · {{ formatElapsed(runElapsed) }}</span></div>
                <NButton size="small" type="info" secondary @click="returnToRunningTask">返回实时问答</NButton>
              </div>

              <div class="history-summary">
                <span><b>{{ selectedHistory?.message_count || historyMessages.length }}</b> 条消息</span>
                <span><b>{{ selectedHistory?.thread_session_count || 1 }}</b> 个会话分支</span>
                <span>记录已从平台问答历史载入</span>
              </div>

              <div ref="chatScroller" class="chat-messages history-messages">
                <div v-if="!historyMessages.length && !historyLoading" class="chat-empty">
                  <strong>该会话暂无可预览消息</strong>
                  <span>会话摘要仍保留在历史记录中</span>
                </div>
                <div v-for="entry in historyMessages" :key="entry.id" class="message-row" :class="entry.role">
                  <div class="message-meta">
                    <span>{{ entry.role === 'user' ? t('cyberDefense.operator') : t('cyberDefense.securityAgent') }}</span>
                    <time>{{ formatTime(entry.timestamp) }}</time>
                  </div>
                  <details v-if="entry.reasoning" class="reasoning-panel">
                    <summary>{{ t('cyberDefense.reasoningProcess') }}</summary>
                    <div>{{ brandSafeText(entry.reasoning) }}</div>
                  </details>
                  <div class="message-bubble">
                    <MarkdownRenderer v-if="entry.role === 'assistant'" :content="displayMessageContent(entry)" />
                    <template v-else>{{ displayMessageContent(entry) }}</template>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="selectedTask">
              <div class="task-heading">
                <div>
                  <div class="eyebrow">{{ selectedTask.id }}</div>
                  <h3>{{ brandSafeText(selectedTask.title, false) }}</h3>
                  <div class="tag-row">
                    <NTag size="small" :type="statusType(taskDisplayStatus(selectedTask))">{{ statusLabel(taskDisplayStatus(selectedTask)) }}</NTag>
                  </div>
                </div>
                <div class="task-actions">
                  <NButton v-if="taskDisplayStatus(selectedTask) !== 'done'" size="small" @click="markDone">{{ t('cyberDefense.markDone') }}</NButton>
                </div>
              </div>

              <div class="task-context">{{ brandSafeText(selectedTask.body, false) }}</div>

              <div v-if="chatLoading && runningTaskId !== selectedTaskId" class="history-run-banner task-run-banner">
                <div><i class="pulse-dot" /><span><b>{{ runningTaskTitle || '其他任务' }}</b> 正在后台研判，当前展示的是 {{ brandSafeText(selectedTask.title, false) }}</span></div>
                <NButton size="small" type="info" secondary @click="returnToRunningTask">返回运行任务</NButton>
              </div>

              <div class="chat-toolbar">
                <div>
                  <h3>{{ t('cyberDefense.realQa') }}</h3>
                  <span>{{ t('cyberDefense.sessionPersisted') }}</span>
                </div>
                <div class="chat-controls">
                  <NSelect v-model:value="mode" size="small" :options="modeOptions" />
                  <NSelect
                    v-model:value="selectedModelKey"
                    size="small"
                    filterable
                    :options="modelSelectionOptions"
                    :loading="appStore.modelGroups.length === 0"
                    :disabled="modelSelectionOptions.length === 0"
                    :placeholder="t('cyberDefense.modelPlaceholder')"
                  />
                </div>
              </div>

              <div ref="chatScroller" class="chat-messages">
                <div v-if="!chatMessages.length" class="chat-empty">
                  <strong>{{ t('cyberDefense.noConversation') }}</strong>
                  <span>{{ t('cyberDefense.noConversationHint') }}</span>
                </div>
                <div v-for="entry in chatMessages" :key="entry.id" class="message-row" :class="entry.role">
                  <div class="message-meta">
                    <span>{{ entry.role === 'user' ? t('cyberDefense.operator') : t('cyberDefense.securityAgent') }}</span>
                    <time>{{ formatTime(entry.timestamp) }}</time>
                  </div>
                  <details v-if="entry.reasoning" class="reasoning-panel">
                    <summary>{{ t('cyberDefense.reasoningProcess') }}</summary>
                    <div>{{ brandSafeText(entry.reasoning) }}</div>
                  </details>
                  <div class="message-bubble">
                    <MarkdownRenderer v-if="entry.role === 'assistant'" :content="displayMessageContent(entry)" />
                    <template v-else>{{ displayMessageContent(entry) }}</template>
                  </div>
                </div>
                <div v-if="chatLoading && runningTaskId === selectedTaskId" class="message-row assistant live-message">
                  <div class="message-meta live-meta">
                    <span><i class="pulse-dot" />{{ t(`cyberDefense.runPhase.${runPhase}`) }}</span>
                    <time>{{ formatElapsed(runElapsed) }}</time>
                  </div>
                  <details v-if="liveReasoning" class="reasoning-panel live-reasoning" open>
                    <summary>{{ t('cyberDefense.reasoningProcess') }}</summary>
                    <div>{{ brandSafeText(liveReasoning) }}<span class="stream-caret" /></div>
                  </details>
                  <div v-if="liveTools.length" class="live-tools">
                    <span v-for="(tool, index) in liveTools" :key="`${tool.name}-${index}`" :class="tool.status">
                      {{ tool.status === 'running' ? '◌' : tool.status === 'done' ? '✓' : '!' }} {{ tool.name }}
                    </span>
                  </div>
                  <div v-if="liveAnswer" class="message-bubble live-answer">{{ brandSafeText(liveAnswer) }}<span class="stream-caret" /></div>
                  <div v-else class="running-note"><span /><span /><span />{{ t('cyberDefense.processingHint') }}</div>
                </div>
              </div>

              <div v-if="!canRun" class="boundary-warning">{{ t('cyberDefense.authorizationRequired') }}</div>
              <div class="composer">
                <NInput
                  v-model:value="composer"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 6 }"
                  :placeholder="t('cyberDefense.composerPlaceholder')"
                  :disabled="!canRun || (chatLoading && runningTaskId !== selectedTaskId)"
                  @keydown="handleComposerKeydown"
                />
                <div class="composer-footer">
                  <span>{{ t('cyberDefense.sendHint') }}</span>
                  <NButton v-if="chatLoading && runningTaskId === selectedTaskId" type="error" secondary @click="stopRun">{{ t('cyberDefense.stopRun') }}</NButton>
                  <NButton v-else-if="chatLoading" disabled>已有任务研判中</NButton>
                  <NButton v-else type="primary" :disabled="!composer.trim() || !canRun" @click="sendMessage">
                    {{ t('cyberDefense.send') }}
                  </NButton>
                </div>
              </div>
            </template>
            <NEmpty v-else :description="t('cyberDefense.selectTaskHint')" />
          </NSpin>
        </main>

      </section>
    </NSpin>

    <NModal v-model:show="createVisible" preset="card" class="create-modal" :title="t('cyberDefense.newTaskTitle')">
      <div class="form-grid">
        <label>
          <span>{{ t('cyberDefense.taskTitle') }}</span>
          <NInput v-model:value="form.title" :placeholder="t('cyberDefense.taskTitlePlaceholder')" />
        </label>
        <label>
          <span>{{ t('cyberDefense.sceneLabel') }}</span>
          <NSelect v-model:value="form.scene" :options="sceneOptions" />
        </label>
        <label>
          <span>{{ t('cyberDefense.priority') }}</span>
          <NSelect v-model:value="form.priority" :options="priorityOptions" />
        </label>
        <label>
          <span>{{ t('cyberDefense.modelSelector') }}</span>
          <NSelect
            v-model:value="form.modelKey"
            filterable
            :options="modelSelectionOptions"
            :loading="appStore.modelGroups.length === 0"
            :disabled="modelSelectionOptions.length === 0"
            :placeholder="t('cyberDefense.modelPlaceholder')"
          />
        </label>
        <label class="full">
          <span>{{ t('cyberDefense.taskGoal') }}</span>
          <NInput v-model:value="form.body" type="textarea" :rows="6" :placeholder="t('cyberDefense.taskGoalPlaceholder')" />
        </label>
        <NCheckbox v-model:checked="form.authorized" class="full authorization-check">
          {{ t('cyberDefense.authorizationConfirm') }}
        </NCheckbox>
      </div>
      <template #footer>
        <div class="modal-actions">
          <NButton @click="createVisible = false">{{ t('common.cancel') }}</NButton>
          <NButton
            type="primary"
            :loading="createLoading"
            :disabled="!form.title.trim() || !form.body.trim() || !form.authorized"
            @click="handleCreateTask"
          >{{ t('cyberDefense.createAndOpen') }}</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.cyber-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.cyber-view.embedded {
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  background: transparent;

  .cyber-body,
  .workspace-grid {
    height: 100%;
  }

  .workspace-grid {
    min-height: 0;
  }

  .cyber-body { overflow: hidden; }
  .cyber-body > :deep(.n-spin-content) { height: 100%; min-height: 0; overflow: hidden; }

  .task-rail { background: #091827; }

  .task-main { background: #0b1b2a; }

  .task-row,
  .history-row { border-color: #203b51; background: #0d2233; }

  .task-row:hover,
  .history-row:hover { border-color: #345c76; background: #112b40; }

  .task-row.active { border-color: #2e91ff; box-shadow: inset 3px 0 0 #2e91ff, 0 0 0 1px rgba(46, 145, 255, .12); }
  .history-row.active { border-color: #2e91ff; background: #102b40; box-shadow: inset 3px 0 0 #2e91ff; }

  .task-context { border-left-color: #e85163; background: #0a1724; color: #9db0c1; }

  .message-bubble { border-color: #234158; background: #10273a; color: #dce8f1; }
  .message-row.user .message-bubble { border-color: #355376; background: linear-gradient(135deg, #173554, #132b43); }

  :deep(.n-input),
  :deep(.n-base-selection) {
    --n-color: #0b1d2c !important;
    --n-color-focus: #0d2233 !important;
    --n-text-color: #dce8f1 !important;
    --n-placeholder-color: #668096 !important;
    --n-border: 1px solid #294a61 !important;
    --n-border-hover: 1px solid #3c7397 !important;
    --n-border-focus: 1px solid #2f91ff !important;
    --n-box-shadow-focus: 0 0 0 2px rgba(47, 145, 255, .15) !important;
    --n-arrow-color: #8ba4b7 !important;
    font-size: 14px;
  }

  :deep(.n-base-selection-label) { background: #0b1d2c !important; }
}

.cyber-header {
  flex: 0 0 auto;
  min-height: 66px;
  height: auto;
  padding-block: 12px;

  h2 { margin: 0; }
  p { margin: 3px 0 0; color: $text-secondary; font-size: 12px; }
}

.header-actions,
.task-actions,
.modal-actions,
.period-switch,
.tag-row,
.composer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cyber-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.overview-panel {
  padding: 16px 20px;
  border-bottom: 1px solid $border-light;
  background: $bg-card;
}

.overview-heading,
.section-toolbar,
.task-heading,
.chat-toolbar,
.task-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.overview-heading h3,
.section-toolbar h3,
.chat-toolbar h3,
.task-heading h3 {
  margin: 0;
  font-size: 14px;
}

.overview-heading span,
.section-toolbar span,
.chat-toolbar span {
  color: $text-muted;
  font-size: 11px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(110px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.metric-card {
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-primary;

  strong { display: block; font-size: 24px; font-weight: 650; line-height: 1; }
  small { margin-left: 3px; color: $text-muted; font-size: 12px; font-weight: 500; }
  span { display: block; margin-top: 7px; color: $text-secondary; font-size: 11px; }
}

.workspace-grid {
  min-height: 0;
  height: calc(100% - 155px);
  display: grid;
  grid-template-columns: 290px minmax(420px, 1fr);
}

.task-rail {
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background: $bg-sidebar;
}

.task-rail { border-right: 1px solid $border-light; }
.section-toolbar :deep(.n-select) { width: 105px; }
.task-rail .section-toolbar { align-items: flex-start; flex-direction: column; gap: 10px; }
.rail-tabs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-primary;
}
.rail-tabs button {
  padding: 7px 8px;
  border: 0;
  border-radius: $radius-sm;
  color: $text-muted;
  background: transparent;
  font-size: 10px;
  cursor: pointer;
}
.rail-tabs button:hover { color: $text-primary; }
.rail-tabs button.active { color: #dcecff; background: rgba(47, 145, 255, .18); box-shadow: inset 0 0 0 1px rgba(47, 145, 255, .32); }
.task-rail-actions { width: 100%; display: flex; align-items: center; gap: 7px; }
.task-rail-actions :deep(.n-select) { width: auto; flex: 1; }
.chat-toolbar { flex-wrap: wrap; }
.chat-controls { margin-left: auto; display: flex; align-items: center; gap: 7px; }
.chat-controls :deep(.n-select) { width: 142px; }
.chat-controls :deep(.n-select:last-child) { width: 250px; }

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.task-row {
  width: 100%;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 11px;
  text-align: left;
  color: $text-primary;
  background: $bg-card;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast;

  &:hover { border-color: $border-color; background: $bg-card-hover; }
}

.task-row.active {
  border-color: $accent-primary;
  box-shadow: inset 3px 0 0 $accent-primary;
}

.task-row-top {
  span { color: $text-muted; font-size: 10px; }
}

.task-row > strong {
  display: block;
  margin-top: 8px;
  font-size: 13px;
}

.task-row p {
  margin: 5px 0;
  color: $text-secondary;
  font-size: 11px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-row time,
.message-meta time {
  color: $text-muted;
  font-size: 10px;
}

.history-time {
  align-self: center;
  color: $text-muted;
  font-size: 10px;
}

.history-run-banner {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(47, 145, 255, .42);
  border-radius: 9px;
  color: $text-secondary;
  background: rgba(47, 145, 255, .08);
  font-size: 11px;
}

.history-run-banner > div {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.history-run-banner b { color: $text-primary; font-weight: 600; }

.history-summary {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 4px;
}

.history-summary span {
  padding: 7px 10px;
  border: 1px solid $border-light;
  border-radius: 999px;
  color: $text-muted;
  background: $bg-secondary;
  font-size: 10px;
}

.history-summary b { color: $text-primary; }
.history-messages { padding-top: 14px; }

.task-main {
  min-width: 0;
  min-height: 0;
  padding: 14px 18px;
  overflow: hidden;
  background: $bg-card;
}

.task-main > :deep(.n-spin-container),
.task-main > :deep(.n-spin-container > .n-spin-content) {
  height: 100%;
}

.task-main :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.eyebrow { color: $text-muted; font-family: $font-code; font-size: 10px; }
.task-heading h3 { margin-top: 4px; font-size: 18px; }
.tag-row { margin-top: 8px; flex-wrap: wrap; }

.task-context {
  flex: 0 0 auto;
  max-height: 64px;
  margin-top: 10px;
  padding: 8px 11px;
  overflow: auto;
  border-left: 3px solid $border-color;
  background: $bg-secondary;
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.chat-toolbar { margin: 10px 0 6px; }

.chat-messages {
  flex: 1;
  min-height: 120px;
  padding: 6px 4px 14px;
  overflow: auto;
}

.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: $text-secondary;

  span { color: $text-muted; font-size: 12px; }
}

.message-row { max-width: 90%; margin-bottom: 18px; }
.message-row.user { margin-left: auto; }
.message-meta { display: flex; gap: 8px; margin-bottom: 4px; color: $text-secondary; font-size: 10px; }
.message-row.user .message-meta { justify-content: flex-end; }
.message-bubble {
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-secondary;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-row.user .message-bubble { background: $msg-user-bg; }
.running-note { display: flex; align-items: center; gap: 5px; min-height: 32px; color: #7f96a8; font-size: 12px; }
.running-note > span { width: 5px; height: 5px; border-radius: 50%; background: #63b7ff; animation: thinking-dot 1.2s infinite ease-in-out; }
.running-note > span:nth-child(2) { animation-delay: .15s; }
.running-note > span:nth-child(3) { animation-delay: .3s; margin-right: 4px; }

.live-message { width: 90%; }
.live-meta { justify-content: space-between; color: #83c8ff; }
.live-meta > span { display: inline-flex; align-items: center; gap: 7px; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #43e29b; box-shadow: 0 0 0 0 rgba(67, 226, 155, .55); animation: live-pulse 1.6s infinite; }
.reasoning-panel { margin-bottom: 8px; overflow: hidden; border: 1px solid #29465c; border-radius: 8px; background: rgba(6, 18, 29, .72); }
.reasoning-panel summary { padding: 9px 12px; color: #8bb2ca; font-size: 12px; cursor: pointer; user-select: none; }
.reasoning-panel > div { max-height: 240px; padding: 0 12px 11px; overflow: auto; color: #91a9ba; font: 12px/1.75 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.live-reasoning { border-color: rgba(59, 145, 206, .48); }
.live-tools { display: flex; flex-wrap: wrap; gap: 6px; margin: 7px 0; }
.live-tools span { padding: 5px 8px; border: 1px solid #31536b; border-radius: 999px; color: #90aec1; background: #0b1d2c; font: 11px/1.2 "SFMono-Regular", Consolas, monospace; }
.live-tools span.running { color: #70c7ff; border-color: #2f79a6; }
.live-tools span.done { color: #63d9a0; border-color: #287554; }
.live-tools span.failed { color: #ff8391; border-color: #8c3d4b; }
.live-answer { min-height: 42px; }
.stream-caret { display: inline-block; width: 2px; height: 1em; margin-left: 3px; vertical-align: -.12em; background: #62baff; animation: caret-blink .8s step-end infinite; }

@keyframes live-pulse { 70% { box-shadow: 0 0 0 8px rgba(67, 226, 155, 0); } 100% { box-shadow: 0 0 0 0 rgba(67, 226, 155, 0); } }
@keyframes thinking-dot { 0%, 70%, 100% { transform: translateY(0); opacity: .35; } 35% { transform: translateY(-4px); opacity: 1; } }
@keyframes caret-blink { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } }

.boundary-warning {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(var(--warning-rgb), .35);
  border-radius: $radius-sm;
  color: $warning;
  font-size: 11px;
}

.composer {
  flex: 0 0 auto;
  border-top: 1px solid $border-light;
  padding-top: 9px;
}

.composer-footer { justify-content: space-between; margin-top: 8px; }
.composer-footer span { color: $text-muted; font-size: 10px; }

.history-section { min-height: 0; }
.history-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 48vh;
  margin-top: 12px;
  padding-right: 3px;
  overflow: auto;
}
.rail-history-list { max-height: none; }
.history-refresh-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}
.history-refresh-row > span { color: $text-muted; font-size: 9px; line-height: 1.4; }

.history-row {
  width: 100%;
  padding: 10px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  color: $text-primary;
  background: $bg-card;
  text-align: left;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast;
}

.history-row:hover { border-color: $border-color; background: $bg-card-hover; }
.history-row:disabled { cursor: not-allowed; opacity: .55; }
.history-row.active { border-color: $accent-primary; box-shadow: inset 3px 0 0 $accent-primary; }
.history-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.history-row-top span,
.history-row-top small { color: $text-muted; font-size: 9px; }
.history-row strong {
  display: block;
  margin-top: 7px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-row p {
  display: -webkit-box;
  margin: 5px 0 0;
  overflow: hidden;
  color: $text-secondary;
  font-size: 9px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

:deep(.create-modal) { width: min(680px, calc(100vw - 32px)); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid label > span { display: block; margin-bottom: 6px; color: $text-secondary; font-size: 12px; }
.form-grid .full { grid-column: 1 / -1; }
.authorization-check { line-height: 1.5; }
.modal-actions { justify-content: flex-end; }

@media (max-width: 1260px) {
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
  .workspace-grid { grid-template-columns: 270px minmax(400px, 1fr); }
}

@media (max-width: $breakpoint-mobile) {
  .cyber-header { align-items: flex-start; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .workspace-grid { display: block; height: auto; }
  .task-rail { max-height: 330px; border-right: 0; border-bottom: 1px solid $border-light; }
  .task-main { min-height: 650px; }
  .task-heading { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .full { grid-column: auto; }
}
</style>
