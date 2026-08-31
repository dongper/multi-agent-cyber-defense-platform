<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { NButton, NEmpty, NInput, NModal, NSelect, NSwitch, NTag, useMessage } from 'naive-ui'
import * as XLSX from 'xlsx'
import { getActiveProfileName } from '@/api/client'
import { runCyberDefenseChat, sendCyberDefenseWechatReport } from '@/api/hermes/cyber-defense'
import {
  COMMANDER,
  DEVICE_CATEGORY_LABEL,
  SAMPLE_ALERTS,
  SOAR_PLAYBOOKS,
  SUB_AGENT_DEFS,
  analyzeAlerts,
  decodeAlertFile,
  maskIp,
  parseAlertFile,
  parseAlertMatrix,
  type AlertVerdict,
  type InvestigationAgent,
  type SecurityAlert,
  type TriageCase,
  type TriageSummary,
} from './alert-triage'

type RunStage = 'idle' | 'device' | 'commander' | 'investigating' | 'soar' | 'completed'
type AgentModalData = { kind: 'commander' } | { kind: 'agent'; agent: InvestigationAgent }
/** 智能体协同研判阶段 */
type RealStage = 'idle' | 'commander' | 'subagents' | 'summarizing' | 'done' | 'error'

interface RealAgentRun {
  id: string
  name: string
  icon: string
  task: string
  status: 'running' | 'done' | 'error'
  output: string
  session_id: string
}

interface RealDisposition {
  action: string
  detail: string
  risk: string
  approval: boolean
}

interface AgentAnalysisSnapshot {
  case_id: string
  completed_at: string
  commander_output: string
  commander_session_id: string
  agents: RealAgentRun[]
  summary: string
  orchestration_output: string
  dispositions: RealDisposition[]
}

interface TriageHistoryRecord {
  id: string
  filename: string
  created_at: string
  summary: TriageSummary
  alerts: SecurityAlert[]
  agent_analyses?: Record<string, AgentAnalysisSnapshot>
}

const STORAGE_KEY = 'redblue-alert-triage-dataset-v4'
const HISTORY_STORAGE_KEY = 'redblue-alert-triage-history-v1'
const HISTORY_LIMIT = 8
const HISTORY_ALERT_LIMIT = 1000
/** 历史存储键（可能包含未脱敏数据），升级时统一清除 */
const LEGACY_STORAGE_KEYS = ['redblue-alert-triage-dataset-v2', 'redblue-alert-triage-dataset-v3']
const WEBHOOK_STORAGE_KEY = 'redblue-alert-triage-wechat-webhook-v2'
const LEGACY_WEBHOOK_SESSION_KEY = 'redblue-alert-triage-wechat-webhook'
const AUTO_PUSH_KEY = 'redblue-alert-triage-wechat-auto-push'
const toast = useMessage()
const fileInput = ref<HTMLInputElement | null>(null)
const webhookInput = ref<HTMLInputElement | null>(null)
const alerts = ref<SecurityAlert[]>([])
const cases = ref<TriageCase[]>([])
const summary = ref<TriageSummary>({ source_count: 0, case_count: 0, suppressed_count: 0, reduction_rate: 0, high_risk_count: 0, suspicious_count: 0, noise_count: 0, device_count: 0 })
const selectedCaseId = ref('')
const query = ref('')
const verdictFilter = ref<'all' | AlertVerdict>('all')
const runStage = ref<RunStage>('idle')
const completedAgentIds = ref<string[]>([])
const subAgentPool = ref<InvestigationAgent[]>([])
const importedFilename = ref('')
const importError = ref('')
const rawExpanded = ref(false)
const historyRecords = ref<TriageHistoryRecord[]>([])
const currentHistoryId = ref('')
const agentAnalysisSnapshots = ref<Record<string, AgentAnalysisSnapshot>>({})
const historyModalVisible = ref(false)
const agentModal = ref<AgentModalData | null>(null)
const agentModalVisible = computed({
  get: () => agentModal.value !== null,
  set: (visible: boolean) => { if (!visible) agentModal.value = null },
})
const webhookModalVisible = ref(false)
const webhookDraft = ref('')
const webhookUrl = ref('')
const autoPush = ref(true)
const pushStatus = ref<'idle' | 'sending' | 'success' | 'error'>('idle')
const pushError = ref('')
const lastPushedAt = ref('')
const webhookCheckStatus = ref<'idle' | 'saved' | 'checking' | 'success' | 'error'>('idle')

// ── 智能体协同研判状态 ──
const realStage = ref<RealStage>('idle')
const realCaseId = ref('')
const realCommander = ref('')
const realCommanderSession = ref('')
const realAgents = ref<RealAgentRun[]>([])
const realSummary = ref('')
const realSoar = ref('')
const realDispositions = ref<RealDisposition[]>([])
const realError = ref('')
const realRunning = computed(() => ['commander', 'subagents', 'summarizing'].includes(realStage.value))
const realStageLabel = computed(() => ({
  idle: '尚未启动',
  commander: '安全指挥官正在分析告警与拆解任务…',
  subagents: `子智能体并行研判中 · ${realAgents.value.filter(a => a.status !== 'running').length}/${realAgents.value.length}`,
  summarizing: '安全指挥官正在汇总证据、生成研判与处置建议…',
  done: '智能体研判完成',
  error: '研判失败',
}[realStage.value]))

const verdictOptions = [
  { label: '全部结论', value: 'all' },
  { label: '确认事件', value: 'confirmed' },
  { label: '待复核', value: 'suspicious' },
  { label: '已降噪', value: 'noise' },
]

const selectedCase = computed(() => cases.value.find(item => item.case_id === selectedCaseId.value) || cases.value[0] || null)
const selectedAnalysisSnapshot = computed(() => selectedCase.value ? agentAnalysisSnapshots.value[selectedCase.value.case_id] || null : null)
const filteredCases = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return cases.value.filter(item => {
    const matchesVerdict = verdictFilter.value === 'all' || item.verdict === verdictFilter.value
    const alert = item.representative
    const haystack = [item.case_id, alert.alert_id, alert.source_ip, alert.destination_ip, alert.asset_name, alert.alert_type, alert.rule_name, alert.username, item.device.name].join(' ').toLowerCase()
    return matchesVerdict && (!keyword || haystack.includes(keyword))
  })
})
const runProgress = computed(() => {
  if (runStage.value === 'device') return 14
  if (runStage.value === 'commander') return 30
  if (runStage.value === 'investigating') return 38 + completedAgentIds.value.length * (subAgentPool.value.length ? Math.floor(50 / subAgentPool.value.length) : 12)
  if (runStage.value === 'soar') return 94
  if (runStage.value === 'completed') return 100
  return 0
})
const webhookConfigured = computed(() => Boolean(webhookUrl.value))
const recentHistory = computed(() => historyRecords.value.slice(0, 4))
const webhookStatusLabel = computed(() => ({
  idle: webhookConfigured.value ? '已保存，尚未验证' : '尚未配置',
  saved: '已保存，尚未验证',
  checking: '正在发送验证消息…',
  success: '连接验证成功',
  error: '连接验证失败',
}[webhookCheckStatus.value]))
const stageLabel = computed(() => ({
  idle: '等待告警输入',
  device: '设备识别引擎正在解析 payload 与来源设备',
  commander: '安全指挥官正在接收告警、制定计划并分派任务',
  investigating: `子智能体并行研判 · ${completedAgentIds.value.length}/${subAgentPool.value.length}`,
  soar: 'SOAR 处置引擎正在匹配处置剧本',
  completed: '本批次研判与处置建议已完成',
}[runStage.value]))
const modalAgentTitle = computed(() => {
  if (!agentModal.value) return ''
  return agentModal.value.kind === 'commander' ? COMMANDER.name : agentModal.value.agent.name
})

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function verdictLabel(verdict: AlertVerdict) {
  return { confirmed: '确认事件', suspicious: '待复核', noise: '已降噪' }[verdict]
}

function verdictTag(verdict: AlertVerdict) {
  return verdict === 'confirmed' ? 'error' : verdict === 'suspicious' ? 'warning' : 'success'
}

function riskTag(risk: 'low' | 'medium' | 'high') {
  return risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success'
}

function riskLabel(risk: 'low' | 'medium' | 'high') {
  return { low: '低风险', medium: '中风险', high: '高风险' }[risk]
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatHistoryTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function cloneAgentAnalyses(value: Record<string, AgentAnalysisSnapshot> | undefined) {
  return JSON.parse(JSON.stringify(value || {})) as Record<string, AgentAnalysisSnapshot>
}

function resetDisplayedAgentAnalysis() {
  realStage.value = 'idle'
  realCaseId.value = ''
  realCommander.value = ''
  realCommanderSession.value = ''
  realAgents.value = []
  realSummary.value = ''
  realSoar.value = ''
  realDispositions.value = []
  realError.value = ''
}

function restoreAgentAnalysis(caseId: string) {
  const snapshot = agentAnalysisSnapshots.value[caseId]
  if (!snapshot) {
    resetDisplayedAgentAnalysis()
    return
  }
  realCaseId.value = snapshot.case_id || caseId
  realStage.value = 'done'
  realCommander.value = snapshot.commander_output || ''
  realCommanderSession.value = snapshot.commander_session_id || ''
  realAgents.value = Array.isArray(snapshot.agents) ? JSON.parse(JSON.stringify(snapshot.agents)) as RealAgentRun[] : []
  realSummary.value = snapshot.summary || ''
  realSoar.value = snapshot.orchestration_output || ''
  realDispositions.value = Array.isArray(snapshot.dispositions) ? JSON.parse(JSON.stringify(snapshot.dispositions)) as RealDisposition[] : []
  realError.value = ''
}

function completedAnalysisCount(record: TriageHistoryRecord) {
  return Object.keys(record.agent_analyses || {}).length
}

function collectSubAgentPool(result: { cases: TriageCase[] }) {
  const unique = new Map<string, InvestigationAgent>()
  for (const item of result.cases) {
    for (const agent of item.commander.dispatched) {
      if (!unique.has(agent.id)) unique.set(agent.id, agent)
    }
  }
  return Array.from(unique.values())
}

function persistDataset() {
  try {
    if (alerts.value.length <= 1000) localStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts: alerts.value, filename: importedFilename.value }))
  } catch {
    // A completed run remains usable even when browser storage is unavailable.
  }
}

function loadHistoryRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(saved)) return
    historyRecords.value = saved.filter((item): item is TriageHistoryRecord => {
      if (!item || typeof item !== 'object') return false
      const value = item as Partial<TriageHistoryRecord>
      return typeof value.id === 'string'
        && typeof value.filename === 'string'
        && typeof value.created_at === 'string'
        && Boolean(value.summary)
        && Array.isArray(value.alerts)
    }).map(item => ({
      ...item,
      filename: productionBatchLabel(item.filename, item.created_at),
      agent_analyses: item.agent_analyses && typeof item.agent_analyses === 'object' ? cloneAgentAnalyses(item.agent_analyses) : {},
    })).slice(0, HISTORY_LIMIT)
    persistHistoryRecords()
  } catch {
    localStorage.removeItem(HISTORY_STORAGE_KEY)
    historyRecords.value = []
  }
}

function persistHistoryRecords() {
  let records = historyRecords.value.slice(0, HISTORY_LIMIT)
  while (records.length) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records))
      historyRecords.value = records
      return
    } catch {
      records = records.slice(0, -1)
    }
  }
  localStorage.removeItem(HISTORY_STORAGE_KEY)
  historyRecords.value = []
}

function archiveCurrentRun() {
  if (!alerts.value.length || !cases.value.length) return
  const firstAlertId = alerts.value[0]?.alert_id
  const existingIndex = historyRecords.value.findIndex(record =>
    record.id === currentHistoryId.value
      || Boolean(firstAlertId && record.alerts[0]?.alert_id === firstAlertId),
  )
  if (existingIndex >= 0) {
    const existing = historyRecords.value[existingIndex]
    const updated: TriageHistoryRecord = {
      ...existing,
      filename: importedFilename.value || existing.filename,
      summary: { ...summary.value },
      alerts: alerts.value.length <= HISTORY_ALERT_LIMIT
        ? JSON.parse(JSON.stringify(alerts.value)) as SecurityAlert[]
        : [],
      agent_analyses: cloneAgentAnalyses(agentAnalysisSnapshots.value),
    }
    historyRecords.value = [updated, ...historyRecords.value.filter((_, index) => index !== existingIndex)].slice(0, HISTORY_LIMIT)
    currentHistoryId.value = updated.id
    persistHistoryRecords()
    return
  }
  const record: TriageHistoryRecord = {
    id: `triage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    filename: importedFilename.value || '未命名告警批次',
    created_at: new Date().toISOString(),
    summary: { ...summary.value },
    alerts: alerts.value.length <= HISTORY_ALERT_LIMIT
      ? JSON.parse(JSON.stringify(alerts.value)) as SecurityAlert[]
      : [],
    agent_analyses: cloneAgentAnalyses(agentAnalysisSnapshots.value),
  }
  historyRecords.value = [record, ...historyRecords.value].slice(0, HISTORY_LIMIT)
  currentHistoryId.value = record.id
  persistHistoryRecords()
}

async function restoreHistoryRecord(record: TriageHistoryRecord) {
  if (!record.alerts.length) {
    toast.info('该批次只保存了统计摘要，请重新导入原始文件查看完整研判。')
    return
  }
  alerts.value = JSON.parse(JSON.stringify(record.alerts)) as SecurityAlert[]
  importedFilename.value = record.filename
  currentHistoryId.value = record.id
  agentAnalysisSnapshots.value = cloneAgentAnalyses(record.agent_analyses)
  importError.value = ''
  historyModalVisible.value = false
  await runAnalysis({ notify: false, archive: false, preserveHistoryContext: true })
  restoreAgentAnalysis(selectedCaseId.value)
  toast.success(`已载入历史批次：${record.filename}`)
}

async function runAnalysis(options: { notify?: boolean; archive?: boolean; preserveHistoryContext?: boolean } = {}) {
  if (!alerts.value.length || ['device', 'commander', 'investigating', 'soar'].includes(runStage.value)) return
  if (!options.preserveHistoryContext) {
    currentHistoryId.value = ''
    agentAnalysisSnapshots.value = {}
    resetDisplayedAgentAnalysis()
  }
  runStage.value = 'device'
  completedAgentIds.value = []
  subAgentPool.value = []
  cases.value = []
  selectedCaseId.value = ''
  await delay(320)
  runStage.value = 'commander'
  await delay(380)
  const result = analyzeAlerts(alerts.value)
  cases.value = result.cases
  summary.value = result.summary
  subAgentPool.value = collectSubAgentPool(result)
  runStage.value = 'investigating'
  const staggered = subAgentPool.value.map(async (agent, index) => {
    await delay(140 + index * 110)
    completedAgentIds.value = [...completedAgentIds.value, agent.id]
  })
  await Promise.all(staggered)
  runStage.value = 'soar'
  await delay(320)
  selectedCaseId.value = result.cases[0]?.case_id || ''
  runStage.value = 'completed'
  persistDataset()
  if (options.archive !== false) archiveCurrentRun()
  await nextTick()
  toast.success(`完成 ${alerts.value.length} 条已降噪告警研判：${result.cases.length} 个事件 · ${result.summary.device_count} 类设备 · ${result.cases.reduce((sum, item) => sum + item.soar.length, 0)} 个处置建议`)
  if (options.notify !== false && autoPush.value && webhookConfigured.value) await sendToWechat(false)
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importError.value = ''
  try {
    let records: SecurityAlert[]
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      records = parseAlertMatrix(matrix)
    } else {
      records = parseAlertFile(decodeAlertFile(await file.arrayBuffer()), file.name)
    }
    alerts.value = records
    importedFilename.value = file.name
    toast.success(`已导入 ${records.length} 条已降噪告警`)
    await runAnalysis({ notify: true })
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
    toast.error(importError.value)
  }
}

function operationalBatchName(value = new Date()) {
  const date = value.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '')
  return `SOC-ALERT-${date}-01.csv`
}

function isBundledBaselineName(filename: string) {
  return filename === '通用安全告警示例.csv' || /^SOC-ALERT-DEMO-/i.test(filename)
}

function currentBaselineAlerts() {
  const records = JSON.parse(JSON.stringify(SAMPLE_ALERTS)) as SecurityAlert[]
  const latest = Math.max(...records.map(item => new Date(item.occurred_at).getTime()))
  const shift = Date.now() - 5 * 60_000 - latest
  const dateKey = new Date(Date.now()).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '')
  return records.map((item, index) => ({
    ...item,
    alert_id: `AL-${dateKey}-${String(index + 1).padStart(6, '0')}`,
    occurred_at: new Date(new Date(item.occurred_at).getTime() + shift).toISOString(),
  }))
}

function productionBatchLabel(filename: string, createdAt?: string) {
  return isBundledBaselineName(filename) ? operationalBatchName(createdAt ? new Date(createdAt) : new Date()) : filename
}

async function loadBaselineData(options: { archive?: boolean } = {}) {
  alerts.value = currentBaselineAlerts()
  importedFilename.value = operationalBatchName()
  importError.value = ''
  await runAnalysis({ notify: false, archive: options.archive !== false })
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** 告警交换文件 A-O 列（输入模板只保留这些列） */
const SANDBOX_TEMPLATE_HEADERS = ['序号', '告警ID', '告警等级', '告警名称', '来源IP', '来源端口', '目的IP', '目的端口', '攻击结果', '失陷状态', '攻击方向', '标签', '关联日志数', '关联设备ID', 'payload']

function downloadTemplate() {
  const quote = (value: string) => (/,|\n|"|，/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const exampleRow = ['1', 'ALERT-000001', '中危(medium)', '【外到内】Web_异常访问', '198.51.100.10', '50781', '10.20.1.10', '443', '未知', '未知', '外到内', '', '1', '9', 'HTTP请求URL：/api/login，HTTP请求体：，HTTP响应状态码：200，Payload：payload=sample']
  const csv = [SANDBOX_TEMPLATE_HEADERS.join(','), exampleRow.map(quote).join(',')].join('\n')
  download('告警降噪研判导入模板.csv', csv, 'text/csv;charset=utf-8')
}

function exportResults() {
  download(`告警研判结果-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
    generated_at: new Date().toISOString(),
    summary: summary.value,
    cases: cases.value,
    agent_analyses: agentAnalysisSnapshots.value,
  }, null, 2), 'application/json')
}

async function openWebhookSettings() {
  webhookDraft.value = webhookUrl.value
  pushError.value = ''
  webhookCheckStatus.value = webhookConfigured.value ? 'saved' : 'idle'
  webhookModalVisible.value = true
  await nextTick()
  window.requestAnimationFrame(() => webhookInput.value?.focus())
}

function normalizeWebhookDraft() {
  const raw = webhookDraft.value.trim()
  if (!raw) throw new Error('请粘贴企业微信机器人推送地址')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('地址格式不完整，请粘贴以 https://qyapi.weixin.qq.com 开头的完整机器人地址')
  }
  const key = url.searchParams.get('key') || ''
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'qyapi.weixin.qq.com' || url.pathname !== '/cgi-bin/webhook/send' || !/^[a-zA-Z0-9-]{20,100}$/.test(key)) {
    throw new Error('请输入有效的企业微信机器人推送地址')
  }
  url.search = ''
  url.searchParams.set('key', key)
  url.hash = ''
  return url.toString()
}

function persistWebhookSettings(url: string) {
  webhookUrl.value = url
  webhookDraft.value = url
  localStorage.setItem(WEBHOOK_STORAGE_KEY, url)
  localStorage.setItem(AUTO_PUSH_KEY, String(autoPush.value))
  sessionStorage.removeItem(LEGACY_WEBHOOK_SESSION_KEY)
}

function saveWebhookSettings(closeModal = true) {
  try {
    persistWebhookSettings(normalizeWebhookDraft())
    webhookCheckStatus.value = 'saved'
    pushError.value = ''
    if (closeModal) webhookModalVisible.value = false
    toast.success('企业微信机器人配置已保存')
    return true
  } catch (error) {
    webhookCheckStatus.value = 'error'
    pushError.value = error instanceof Error ? error.message : String(error)
    return false
  }
}

async function verifyWebhookSettings() {
  if (!saveWebhookSettings(false)) return
  webhookCheckStatus.value = 'checking'
  pushError.value = ''
  try {
    const response = await sendCyberDefenseWechatReport({
      webhook_url: webhookUrl.value,
      report: {
        batch_name: '联通安全运营平台连接验证',
        generated_at: new Date().toISOString(),
        source_count: 0,
        case_count: 0,
        reduction_rate: 0,
        confirmed_count: 0,
        suspicious_count: 0,
        noise_count: 0,
        high_risk_cases: [],
      },
    })
    webhookCheckStatus.value = 'success'
    lastPushedAt.value = response.delivered_at
    toast.success('企业微信连接验证成功')
  } catch (error) {
    webhookCheckStatus.value = 'error'
    pushError.value = error instanceof Error ? error.message : String(error)
    toast.error(`企业微信连接验证失败：${pushError.value}`)
  }
}

function clearWebhookSettings() {
  webhookUrl.value = ''
  webhookDraft.value = ''
  webhookCheckStatus.value = 'idle'
  pushError.value = ''
  localStorage.removeItem(WEBHOOK_STORAGE_KEY)
  sessionStorage.removeItem(LEGACY_WEBHOOK_SESSION_KEY)
  toast.success('企业微信机器人配置已清除')
}

function buildBriefReport() {
  return {
    batch_name: importedFilename.value || '告警研判批次',
    generated_at: new Date().toISOString(),
    source_count: summary.value.source_count,
    case_count: summary.value.case_count,
    reduction_rate: summary.value.reduction_rate,
    device_count: summary.value.device_count,
    confirmed_count: summary.value.high_risk_count,
    suspicious_count: summary.value.suspicious_count,
    noise_count: summary.value.noise_count,
    high_risk_cases: cases.value.filter(item => item.verdict === 'confirmed').slice(0, 5).map(item => ({
      case_id: item.case_id,
      priority: item.priority,
      alert_type: item.representative.alert_type,
      risk_score: item.risk_score,
      source_ip: item.representative.source_ip,
      asset_name: item.representative.asset_name || item.representative.asset_id,
      device: item.device.name,
      soar_playbooks: item.soar.map(exec => exec.playbook.playbook_id),
    })),
  }
}

async function sendToWechat(showMissingMessage = true) {
  if (!webhookConfigured.value) {
    openWebhookSettings()
    if (showMissingMessage) toast.info('请先配置企业微信机器人')
    return
  }
  if (!cases.value.length || pushStatus.value === 'sending') return
  pushStatus.value = 'sending'
  pushError.value = ''
  try {
    const response = await sendCyberDefenseWechatReport({ webhook_url: webhookUrl.value, report: buildBriefReport() })
    pushStatus.value = 'success'
    lastPushedAt.value = response.delivered_at
    toast.success('研判简报已推送到企业微信')
  } catch (error) {
    pushStatus.value = 'error'
    pushError.value = error instanceof Error ? error.message : String(error)
    toast.error(`企业微信推送失败：${pushError.value}`)
  }
}

function selectCase(item: TriageCase) {
  selectedCaseId.value = item.case_id
  rawExpanded.value = false
  if (!realRunning.value) restoreAgentAnalysis(item.case_id)
}

function openCommander() {
  agentModal.value = { kind: 'commander' }
}

function openAgent(agent: InvestigationAgent) {
  agentModal.value = { kind: 'agent', agent }
}

function payloadPreview(alert: SecurityAlert) {
  const text = alert.payload || alert.raw_event || ''
  const compact = maskIp(text).replace(/\s+/g, ' ')
  return compact.length > 260 ? `${compact.slice(0, 260)}…` : compact
}

/** 原始告警 JSON（展示层统一脱敏 IP） */
function rawAlertJson(alert: SecurityAlert) {
  return maskIp(JSON.stringify(alert, null, 2))
}

function agentByPool(agent: InvestigationAgent) {
  return subAgentPool.value.find(item => item.id === agent.id) || agent
}

/* ─────────────── 智能体协同研判（调用在线推理会话） ─────────────── */

/** 构造告警上下文（已脱敏数据） */
function alertContextFor(item: TriageCase): string {
  const a = item.representative
  return [
    `告警ID：${a.alert_id}`,
    `告警名称：${a.alert_type}`,
    `检测规则：${a.rule_name}`,
    `来源IP：${a.source_ip}（${a.source_country}）`,
    `目的IP：${a.destination_ip}${a.destination_port ? ':' + a.destination_port : ''}`,
    `目标资产：${a.asset_name || '未提供'}（重要度 ${a.asset_criticality}）`,
    `告警等级：${a.severity}`,
    `来源设备：${item.device.name}（${DEVICE_CATEGORY_LABEL[item.device.category]}）`,
    `关联告警数：${item.alerts.length} 条`,
    `攻击方向：${a.rule_name}`,
    `payload：${(a.payload || a.raw_event || '').slice(0, 1600) || '（空）'}`,
  ].join('\n')
}

/** 容错提取 JSON 对象 */
function extractJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text)
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  } catch {
    // fall through
  }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const value = JSON.parse(match[0])
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  return null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function historySafeText(value: string, limit = 16_000) {
  const sanitized = maskIp(value || '')
  return sanitized.length > limit ? `${sanitized.slice(0, limit)}…` : sanitized
}

function saveCompletedAgentAnalysis(item: TriageCase) {
  const snapshot: AgentAnalysisSnapshot = {
    case_id: item.case_id,
    completed_at: new Date().toISOString(),
    commander_output: historySafeText(realCommander.value),
    commander_session_id: realCommanderSession.value,
    agents: realAgents.value.map(agent => ({
      ...agent,
      task: historySafeText(agent.task, 4_000),
      output: historySafeText(agent.output),
    })),
    summary: historySafeText(realSummary.value),
    orchestration_output: historySafeText(realSoar.value),
    dispositions: realDispositions.value.map(item => ({
      ...item,
      action: historySafeText(item.action, 1_000),
      detail: historySafeText(item.detail, 4_000),
    })),
  }
  agentAnalysisSnapshots.value = {
    ...agentAnalysisSnapshots.value,
    [item.case_id]: snapshot,
  }
  archiveCurrentRun()
}

/** 启动智能体研判：指挥官 → 子智能体并行 → 汇总研判与处置建议 */
async function startRealAnalysis() {
  const item = selectedCase.value
  if (!item || realRunning.value) return
  realCaseId.value = item.case_id
  realStage.value = 'commander'
  realCommander.value = ''
  realAgents.value = []
  realSummary.value = ''
  realSoar.value = ''
  realDispositions.value = []
  realError.value = ''
  const profile = getActiveProfileName() || undefined
  const ctx = alertContextFor(item)

  try {
    /* 1. 安全指挥官：分析告警、制定计划、拆解子任务 */
    const commanderResp = await runCyberDefenseChat({
      session_id: `alert-real-${item.case_id}-${Date.now()}-cmd`,
      profile,
      timeout_ms: 600_000,
      input: [
        '你是安全运营平台的【安全指挥官】。接收平台规则降噪后的安全告警，负责识别关键特征、制定调查计划并拆解任务分派给子智能体。',
        '',
        '告警信息：',
        ctx,
        '',
        `规则引擎预判：来源设备=${item.device.name}，攻击画像=${item.commander.attack_profile}，风险分=${item.risk_score}，初步结论=${item.verdict}`,
        '',
        '可选子智能体：flow-analyst(流量分析) / iam-analyst(身份认证) / intel-analyst(威胁情报) / host-analyst(主机行为) / web-analyst(Web安全) / sample-analyst(恶意样本) / path-analyst(攻击路径)。',
        '',
        '请输出严格 JSON（不要包含 JSON 以外的文字）：',
        '{"plan":["调查步骤1","调查步骤2"],"sub_agents":[{"id":"flow-analyst","task":"对子智能体的具体任务描述"}],"preview":"初步研判倾向与原因"}',
      ].join('\n'),
    })
    realCommander.value = commanderResp.output
    realCommanderSession.value = commanderResp.session_id

    /* 解析指挥官分派；失败则回退到规则引擎分派 */
    const commanderJson = extractJson(commanderResp.output)
    const tasks = Array.isArray(commanderJson?.sub_agents)
      ? (commanderJson.sub_agents as Array<Record<string, unknown>>)
          .map(item => ({ id: asString(item.id), task: asString(item.task) }))
          .filter(item => item.id && SUB_AGENT_DEFS[item.id] && item.task)
      : []
    if (tasks.length) {
      realAgents.value = tasks.map((task) => {
        const def = SUB_AGENT_DEFS[task.id]
        return { id: task.id, name: def.name, icon: def.icon, task: task.task, status: 'running' as const, output: '', session_id: '' }
      })
    } else {
      realAgents.value = item.commander.dispatched.map((agent) => ({
        id: agent.id, name: agent.name, icon: agent.icon, task: agent.task, status: 'running' as const, output: '', session_id: '',
      }))
    }

    /* 2. 子智能体并行研判 */
    realStage.value = 'subagents'
    await Promise.allSettled(realAgents.value.map(async (agent, index) => {
      const def = SUB_AGENT_DEFS[agent.id]
      const logicText = def.logic.map((rule, j) => `${j + 1}. ${rule}`).join('\n')
      try {
        const response = await runCyberDefenseChat({
          session_id: `alert-real-${item.case_id}-${Date.now()}-${index}`,
          profile,
          timeout_ms: 600_000,
          input: [
            `你是安全运营平台的【${def.name}】。职责：${def.role}`,
            '',
            `你的分析规则：\n${logicText}`,
            '',
            `安全指挥官下发的任务：${agent.task}`,
            '',
            '告警信息：',
            ctx,
            '',
            '请基于以上信息完成研判，输出严格 JSON（不要包含 JSON 以外的文字）：',
            '{"conclusion":"研判结论","confidence":0到100的整数,"evidence":["证据1","证据2"],"disposition":"初步处置倾向"}',
          ].join('\n'),
        })
        agent.output = response.output
        agent.session_id = response.session_id
        agent.status = 'done'
      } catch (error) {
        agent.status = 'error'
        agent.output = error instanceof Error ? error.message : String(error)
      }
    }))

    /* 3. 安全指挥官汇总：生成研判建议与处置建议 */
    realStage.value = 'summarizing'
    const agentsText = realAgents.value.map(agent => `【${agent.name}】\n${agent.output || '（无输出）'}`).join('\n\n')
    const soarText = SOAR_PLAYBOOKS.map(playbook =>
      `${playbook.playbook_id} ${playbook.name}（脚本：${playbook.script}，风险：${playbook.risk}，${playbook.approval_required ? '需人工审批' : '可自动执行'}）：${playbook.actions.join('；')}`,
    ).join('\n')
    const summaryResp = await runCyberDefenseChat({
      session_id: `alert-real-${item.case_id}-${Date.now()}-sum`,
      profile,
      timeout_ms: 600_000,
      input: [
        '你是安全运营平台的【安全指挥官】。以下是多个子智能体对同一告警的研判结果，请汇总形成最终研判建议与处置建议。',
        '',
        '告警信息：',
        ctx,
        '',
        '子智能体研判结果：',
        agentsText,
        '',
        '平台 SOAR 剧本库（处置建议必须从中选择并说明理由）：',
        soarText,
        '',
        '请输出严格 JSON（不要包含 JSON 以外的文字）：',
        '{"verdict":"confirmed或suspicious或noise","confidence":0到100的整数,"summary":"综合研判建议（真实性判定、关键依据、风险说明）","disposition":[{"action":"处置动作名称","detail":"具体操作说明","risk":"low或medium或high","approval":true或false}]}',
      ].join('\n'),
    })
    const summaryJson = extractJson(summaryResp.output)
    if (summaryJson) {
      realSummary.value = asString(summaryJson.summary, summaryResp.output)
      if (Array.isArray(summaryJson.disposition)) {
        realDispositions.value = (summaryJson.disposition as Array<Record<string, unknown>>)
          .filter(item => asString(item.action))
          .map(item => ({
            action: asString(item.action),
            detail: asString(item.detail, ''),
            risk: asString(item.risk, 'medium'),
            approval: item.approval === true,
          }))
      }
    } else {
      realSummary.value = summaryResp.output
    }
    realSoar.value = summaryResp.output
    realStage.value = 'done'
    saveCompletedAgentAnalysis(item)
    toast.success('智能体研判完成，结果已保存至当前历史批次')
  } catch (error) {
    realStage.value = 'error'
    realError.value = error instanceof Error ? error.message : String(error)
    toast.error(`智能体研判失败：${realError.value}`)
  }
}

onMounted(async () => {
  // 清理历史存储（可能含未脱敏 IP 的旧数据）
  for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
  loadHistoryRecords()
  const legacyWebhook = sessionStorage.getItem(LEGACY_WEBHOOK_SESSION_KEY) || ''
  webhookUrl.value = localStorage.getItem(WEBHOOK_STORAGE_KEY) || legacyWebhook
  if (legacyWebhook && !localStorage.getItem(WEBHOOK_STORAGE_KEY)) localStorage.setItem(WEBHOOK_STORAGE_KEY, legacyWebhook)
  sessionStorage.removeItem(LEGACY_WEBHOOK_SESSION_KEY)
  webhookDraft.value = webhookUrl.value
  webhookCheckStatus.value = webhookConfigured.value ? 'saved' : 'idle'
  autoPush.value = localStorage.getItem(AUTO_PUSH_KEY) !== 'false'
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { alerts?: SecurityAlert[]; filename?: string }
    if (Array.isArray(saved.alerts) && saved.alerts.length) {
      const legacyBaseline = isBundledBaselineName(saved.filename || '')
      alerts.value = legacyBaseline ? currentBaselineAlerts() : saved.alerts
      importedFilename.value = legacyBaseline ? operationalBatchName() : saved.filename || '上次导入数据'
      const result = analyzeAlerts(alerts.value)
      cases.value = result.cases
      summary.value = result.summary
      selectedCaseId.value = result.cases[0]?.case_id || ''
      subAgentPool.value = collectSubAgentPool(result)
      completedAgentIds.value = subAgentPool.value.map(agent => agent.id)
      runStage.value = 'completed'
      if (legacyBaseline) persistDataset()
      const matchingHistory = historyRecords.value.find(record => record.alerts[0]?.alert_id === alerts.value[0]?.alert_id)
      if (matchingHistory) {
        currentHistoryId.value = matchingHistory.id
        agentAnalysisSnapshots.value = cloneAgentAnalyses(matchingHistory.agent_analyses)
        restoreAgentAnalysis(selectedCaseId.value)
      } else {
        archiveCurrentRun()
      }
      return
    }
  } catch (error) {
    console.error('[告警研判] 本地数据恢复失败，已切换至内置基线：', error)
    localStorage.removeItem(STORAGE_KEY)
  }
  await loadBaselineData({ archive: false })
})
</script>

<template>
  <div class="triage-workbench">
    <!-- 顶栏：标题 + 导入操作 -->
    <section class="triage-head">
      <div class="head-copy">
        <div class="head-badge"><span>AI</span> ALERT ORCHESTRATION · TRIAGE → INVESTIGATION → RESPONSE</div>
        <h2>告警降噪研判</h2>
        <p>接收平台规则聚合后的告警（<b>payload · 来源 IP · 目的 IP</b>），由安全指挥官识别设备类型并调度专项智能体并行分析，形成<b>研判结论</b>与<b>处置建议</b>。所有决策保留证据依据和执行记录。</p>
      </div>
      <div class="head-actions">
        <input ref="fileInput" class="file-input" type="file" accept=".csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="handleFile">
        <NButton type="primary" @click="fileInput?.click()">＋ 导入告警</NButton>
        <NButton tertiary size="small" @click="downloadTemplate">模板</NButton>
        <NButton tertiary size="small" :disabled="!cases.length" @click="exportResults">导出</NButton>
        <NButton tertiary size="small" @click="historyModalVisible = true">历史 {{ historyRecords.length || '' }}</NButton>
        <NButton tertiary size="small" :type="webhookConfigured ? 'success' : 'default'" @click="openWebhookSettings">{{ webhookConfigured ? '企微已配置' : '企微配置' }}</NButton>
      </div>
      <small class="dataset-label">当前批次：{{ importedFilename || '等待告警数据' }} · CSV / JSON / Excel · 单批上限 5,000 条</small>
      <small v-if="importError" class="import-error">{{ importError }}</small>
    </section>

    <!-- 最近研判批次预览 -->
    <section class="history-preview-strip">
      <header>
        <div><small>TRIAGE HISTORY</small><h3>历史研判记录</h3></div>
        <button type="button" @click="historyModalVisible = true">查看全部 {{ historyRecords.length }} 条 →</button>
      </header>
      <div v-if="recentHistory.length" class="history-preview-list">
        <button v-for="record in recentHistory" :key="record.id" type="button" @click="restoreHistoryRecord(record)">
          <span>{{ formatHistoryTime(record.created_at) }}</span>
          <b>{{ record.filename }}</b>
          <small>{{ record.summary.source_count }} 条告警 · {{ record.summary.case_count }} 个事件</small>
          <em>确认 {{ record.summary.high_risk_count }} · 待复核 {{ record.summary.suspicious_count }} · 智能体研判 {{ completedAnalysisCount(record) }}</em>
          <i>{{ record.alerts.length ? '恢复批次' : '仅保留摘要' }}</i>
        </button>
      </div>
      <div v-else class="history-preview-empty">完成一次告警导入后，这里会保留最近批次的统计摘要和脱敏预览。</div>
    </section>

    <!-- 智能体流转条 -->
    <section class="flow-strip">
      <div class="flow-node input-node" :class="{ lit: runStage !== 'idle' }"><span>输入</span><b>已降噪告警</b><small>payload · 来源IP · 目的IP</small><i>{{ alerts.length }}</i></div>
      <div class="flow-arrow" />
      <div class="flow-node" :class="{ lit: ['commander', 'investigating', 'soar', 'completed'].includes(runStage) }" role="button" tabindex="0" @click="selectedCase && openCommander()" @keydown.enter="selectedCase && openCommander()">
        <span>调度中枢</span><b>{{ COMMANDER.icon }} {{ COMMANDER.name }}</b><small>设备识别 · 任务拆解 · 分派</small><i class="clickable">查看调度</i>
      </div>
      <div class="flow-arrow" />
      <div class="flow-agents">
        <button v-for="agent in subAgentPool" :key="agent.id" :class="{ done: completedAgentIds.includes(agent.id) }" @click="openAgent(agent)">
          <span>{{ agent.icon }}</span><b>{{ agent.name }}</b><small>{{ completedAgentIds.includes(agent.id) ? '分析完成' : '研判中…' }}</small>
        </button>
        <em v-if="!subAgentPool.length">导入告警后自动分派子智能体</em>
      </div>
      <div class="flow-arrow" />
      <div class="flow-node output-node" :class="{ lit: ['soar', 'completed'].includes(runStage) }"><span>输出</span><b>研判 + 处置建议</b><small>SOAR 剧本匹配 · 风险分级</small><i>{{ runStage === 'completed' ? '就绪' : '—' }}</i></div>
    </section>

    <section v-if="runStage !== 'completed'" class="run-progress-card">
      <span class="pulse-dot" /><b>{{ stageLabel }}</b><small>{{ runProgress }}%</small>
    </section>

    <div class="triage-metrics">
      <article><small>告警输入</small><b>{{ summary.source_count }}</b><p>规则聚合后进入研判</p></article>
      <article><small>关联事件</small><b>{{ summary.case_count }}</b><p>同指纹 10 分钟窗口</p></article>
      <article class="metric-accent"><small>涉及设备</small><b>{{ summary.device_count }}<i>类</i></b><p>payload 识别来源</p></article>
      <article><small>确认事件</small><b>{{ summary.high_risk_count }}</b><p>进入 SOAR 处置建议</p></article>
    </div>

    <section class="case-workspace">
      <aside class="case-list-panel">
        <header><div><small>TRIAGE QUEUE</small><h3>研判事件</h3></div><NTag size="small" :type="'info'" v-if="pushStatus === 'success'">简报已推送</NTag></header>
        <div class="case-filters"><NInput v-model:value="query" size="small" clearable placeholder="搜索 IP / 资产 / 设备" /><NSelect v-model:value="verdictFilter" size="small" :options="verdictOptions" /></div>
        <div class="case-list">
          <button v-for="item in filteredCases" :key="item.case_id" :class="{ active: selectedCase?.case_id === item.case_id }" @click="selectCase(item)">
            <div class="case-row-top"><NTag size="tiny" :type="verdictTag(item.verdict)">{{ verdictLabel(item.verdict) }}</NTag><b>{{ item.priority }}</b><span>{{ formatTime(item.last_seen) }}</span></div>
            <h4>{{ item.representative.alert_type }}</h4>
            <p>{{ maskIp(item.representative.source_ip) }} <i>→</i> {{ maskIp(item.representative.destination_ip) }}</p>
            <footer><span>{{ item.device.name }}</span><span>{{ item.alerts.length }} 条</span><strong>{{ item.risk_score }}</strong></footer>
          </button>
          <NEmpty v-if="!filteredCases.length" size="small" description="没有符合条件的事件" />
        </div>
      </aside>

      <main v-if="selectedCase" class="case-detail-panel">
        <!-- 输入区 -->
        <section class="io-block input-block">
          <header><small>INPUT · 已降噪告警</small><h4>输入</h4><NTag size="tiny" :type="verdictTag(selectedCase.verdict)">{{ verdictLabel(selectedCase.verdict) }}</NTag></header>
          <div class="io-grid">
            <article><small>来源 IP</small><b>{{ maskIp(selectedCase.representative.source_ip) }}</b><p>{{ selectedCase.representative.source_country }}</p></article>
            <article class="io-arrow">→</article>
            <article><small>目的 IP</small><b>{{ maskIp(selectedCase.representative.destination_ip) }}<template v-if="selectedCase.representative.destination_port">:{{ selectedCase.representative.destination_port }}</template></b><p>{{ selectedCase.representative.asset_name || '未提供资产名' }}</p></article>
            <article><small>来源设备</small><b>{{ selectedCase.device.name }}</b><p>{{ DEVICE_CATEGORY_LABEL[selectedCase.device.category] }} · ID {{ selectedCase.device.device_id }}</p></article>
          </div>
          <details class="payload-box" :open="rawExpanded" @toggle="rawExpanded = ($event.target as HTMLDetailsElement).open">
            <summary>payload 原始内容<template v-if="!rawExpanded">（{{ selectedCase.representative.payload.length }} 字符）</template></summary>
            <pre>{{ payloadPreview(selectedCase.representative) }}</pre>
          </details>
        </section>

        <!-- 智能体流转区 -->
        <section class="agent-flow-block">
          <header><small>AGENT FLOW · 智能体流转</small><h4>安全指挥官 → 专项智能体</h4><span>点击节点查看执行详情</span></header>
          <div class="agent-chain">
            <button class="chain-commander" @click="openCommander()">
              <span class="chain-icon">{{ COMMANDER.icon }}</span>
              <div><b>{{ COMMANDER.name }}</b><small>{{ selectedCase.commander.attack_profile }} · {{ selectedCase.commander.dispatched.length }} 个子任务</small></div>
              <i>查看调度 →</i>
            </button>
            <div class="chain-connector" />
            <div class="chain-subagents">
              <button v-for="agent in selectedCase.commander.dispatched" :key="agent.id" class="chain-agent" @click="openAgent(agentByPool(agent))">
                <span class="chain-icon" :class="agent.level">{{ agent.icon }}</span>
                <div><b>{{ agent.name }}</b><small>{{ maskIp(agent.conclusion).slice(0, 46) }}{{ maskIp(agent.conclusion).length > 46 ? '…' : '' }}</small></div>
                <em :class="agent.level">置信度 {{ agent.confidence }}%</em>
                <i>执行详情 →</i>
              </button>
            </div>
          </div>
          <p class="commander-decision">{{ selectedCase.commander.decision }}</p>
        </section>

        <!-- 输出区 -->
        <section class="io-block output-block">
          <header><small>OUTPUT · 研判与处置</small><h4>输出</h4><span>风险分 {{ selectedCase.risk_score }} · 置信度 {{ selectedCase.confidence }}% · {{ selectedCase.priority }}</span></header>
          <div class="verdict-box">
            <div class="verdict-mark" :class="selectedCase.verdict">{{ { confirmed: '确认', suspicious: '复核', noise: '降噪' }[selectedCase.verdict] }}</div>
            <div class="verdict-copy"><small>研判建议</small><b>{{ verdictLabel(selectedCase.verdict) }} · {{ selectedCase.summary }}</b><p>{{ selectedCase.reason }}</p></div>
          </div>
          <div class="soar-list">
            <small class="soar-title">处置建议（SOAR 剧本）</small>
            <article v-for="exec in selectedCase.soar" :key="exec.playbook.playbook_id">
              <header><b>{{ exec.playbook.playbook_id }}</b><h5>{{ exec.playbook.name }}</h5><span><NTag size="tiny" :type="riskTag(exec.playbook.risk)">{{ riskLabel(exec.playbook.risk) }}</NTag><NTag size="tiny" :type="exec.playbook.approval_required ? 'warning' : 'success'">{{ exec.playbook.approval_required ? '需人工审批' : '自动执行' }}</NTag></span></header>
              <code>{{ exec.playbook.script }}</code>
              <ul><li v-for="(action, index) in exec.playbook.actions" :key="action"><span>{{ index + 1 }}</span>{{ action }}</li></ul>
              <footer>{{ exec.note }}</footer>
            </article>
            <NEmpty v-if="!selectedCase.soar.length" size="small" description="无处置建议，保留记录即可" />
          </div>
        </section>

        <!-- 智能体协同研判区 -->
        <section class="real-analysis-block">
          <header>
            <div class="real-title"><small>AGENT ORCHESTRATION · 智能体协同研判</small><h4>安全指挥官 + 专项分析智能体</h4></div>
            <div class="real-actions">
              <NTag v-if="realCaseId === selectedCase.case_id" size="tiny" :type="realStage === 'done' ? 'success' : realStage === 'error' ? 'error' : 'info'">{{ realStageLabel }}</NTag>
              <NTag v-if="selectedAnalysisSnapshot && realStage === 'done'" size="tiny" type="success">批次已归档 · {{ formatHistoryTime(selectedAnalysisSnapshot.completed_at) }}</NTag>
              <NButton size="small" type="primary" :loading="realRunning" :disabled="realRunning" @click="startRealAnalysis">{{ realCaseId === selectedCase.case_id && realStage === 'done' ? '重新研判' : '启动智能体研判' }}</NButton>
            </div>
          </header>

          <div v-if="realRunning" class="real-progress">
            <span class="pulse-dot" />{{ realStageLabel }}
          </div>
          <div v-if="realCaseId === selectedCase.case_id && realStage === 'error'" class="real-error">{{ realError }}</div>

          <template v-if="realCaseId === selectedCase.case_id && (realStage === 'done' || realStage === 'subagents' || realStage === 'summarizing')">
            <div class="real-agents">
              <article v-for="agent in realAgents" :key="agent.id">
                <header><span class="chain-icon">{{ agent.icon }}</span><b>{{ agent.name }}</b><em :class="{ err: agent.status === 'error' }">{{ agent.status === 'done' ? '完成' : agent.status === 'error' ? '失败' : '研判中…' }}</em></header>
                <p class="real-agent-task"><i>任务</i>{{ maskIp(agent.task) }}</p>
                <div v-if="agent.output" class="real-agent-output"><pre>{{ maskIp(agent.output) }}</pre></div>
              </article>
            </div>

            <div v-if="realSummary" class="real-verdict">
              <small>智能体综合研判结论</small>
              <p>{{ maskIp(realSummary) }}</p>
            </div>

            <div v-if="realDispositions.length" class="real-dispositions">
              <small>智能体处置建议</small>
              <article v-for="(d, index) in realDispositions" :key="index">
                <header><span>{{ index + 1 }}</span><b>{{ d.action }}</b><NTag size="tiny" :type="d.risk === 'high' ? 'error' : d.risk === 'medium' ? 'warning' : 'success'">{{ d.risk === 'high' ? '高风险' : d.risk === 'medium' ? '中风险' : '低风险' }}</NTag><NTag size="tiny" :type="d.approval ? 'warning' : 'success'">{{ d.approval ? '需人工审批' : '可自动执行' }}</NTag></header>
                <p>{{ d.detail }}</p>
              </article>
            </div>
          </template>
        </section>

        <section class="raw-evidence">
          <button @click="rawExpanded = !rawExpanded"><span>原始告警与审计依据（{{ selectedCase.alerts.length }} 条）</span><b>{{ rawExpanded ? '收起' : '展开' }}</b></button>
          <div v-if="rawExpanded"><article v-for="alert in selectedCase.alerts" :key="alert.alert_id"><header><b>{{ alert.alert_id }}</b><span>{{ formatTime(alert.occurred_at) }}</span></header><pre>{{ rawAlertJson(alert) }}</pre></article></div>
        </section>
      </main>
      <main v-else class="case-detail-empty"><NEmpty description="导入告警后开始研判" /></main>
    </section>

    <!-- 智能体执行详情 -->
    <NModal v-model:show="agentModalVisible" transform-origin="center">
      <section class="agent-modal">
        <header>
          <div class="modal-icon" v-if="agentModal?.kind === 'commander'">{{ COMMANDER.icon }}</div>
          <div class="modal-icon" v-else-if="agentModal?.kind === 'agent'">{{ agentModal.agent.icon }}</div>
          <div class="modal-title">
            <small>{{ agentModal?.kind === 'commander' ? 'COMMANDER · 调度中枢' : 'SUB-AGENT · 研判单元' }}</small>
            <h3>{{ modalAgentTitle }}</h3>
            <p v-if="agentModal?.kind === 'commander'">{{ COMMANDER.role }}</p>
            <p v-else-if="agentModal?.kind === 'agent'">{{ agentModal.agent.role }}</p>
          </div>
          <NTag v-if="agentModal?.kind === 'agent'" size="small" :type="agentModal.agent.level === 'high' ? 'error' : agentModal.agent.level === 'medium' ? 'warning' : 'success'">置信度 {{ agentModal.agent.confidence }}%</NTag>
          <button class="modal-close" type="button" aria-label="关闭" @click="agentModal = null">×</button>
        </header>

        <div class="modal-body">
          <template v-if="agentModal?.kind === 'commander'">
            <section><small>本次调度决策</small><p class="decision-text">{{ selectedCase?.commander.decision }}</p></section>
            <section><small>研判流程</small>
              <ol class="logic-list">
                <li v-for="(step, index) in COMMANDER.logic" :key="step"><span>{{ index + 1 }}</span><div><b>{{ step }}</b><em>执行完成</em></div></li>
              </ol>
            </section>
            <section><small>当前批次调度</small>
              <div class="dispatch-summary">
                <span v-for="agent in selectedCase?.commander.dispatched" :key="agent.id" @click="openAgent(agentByPool(agent))"><b>{{ agent.icon }}</b>{{ agent.name }}<i>{{ agent.confidence }}%</i></span>
              </div>
            </section>
          </template>

          <template v-else-if="agentModal?.kind === 'agent'">
            <section><small>接收任务</small><p class="task-text">{{ maskIp(agentModal.agent.task) }}</p></section>
            <section><small>输入上下文</small><p class="input-text">{{ maskIp(agentModal.agent.input) }}</p></section>
            <section><small>策略规则与命中情况</small>
              <ol class="logic-list">
                <li v-for="(step, index) in agentModal.agent.analysis" :key="index" :class="{ hit: step.hit }"><span>{{ step.hit ? '✓' : '○' }}</span><div><b>{{ step.rule }}</b><em>{{ step.detail }}</em></div></li>
              </ol>
            </section>
            <section><small>研判结论</small><div class="agent-conclusion" :class="agentModal.agent.level"><b>{{ agentModal.agent.conclusion }}</b><span>置信度 {{ agentModal.agent.confidence }}% · {{ { high: '高', medium: '中', low: '低' }[agentModal.agent.level] }}风险</span></div></section>
            <section><small>证据</small><div class="evidence-chips"><em v-for="evidence in agentModal.agent.evidence" :key="evidence">{{ evidence }}</em></div></section>
          </template>
        </div>
      </section>
    </NModal>

    <!-- 历史研判记录 -->
    <NModal v-model:show="historyModalVisible" transform-origin="center">
      <section class="history-modal">
        <header><div><small>TRIAGE HISTORY</small><h3>历史研判记录</h3></div><button type="button" aria-label="关闭" @click="historyModalVisible = false">×</button></header>
        <div v-if="historyRecords.length" class="history-modal-list">
          <article v-for="record in historyRecords" :key="record.id">
            <header><div><b>{{ record.filename }}</b><small>{{ formatHistoryTime(record.created_at) }}</small></div><NButton size="tiny" secondary :disabled="!record.alerts.length" @click="restoreHistoryRecord(record)">{{ record.alerts.length ? '载入批次' : '仅保留摘要' }}</NButton></header>
            <div>
              <span><small>告警输入</small><b>{{ record.summary.source_count }}</b></span>
              <span><small>关联事件</small><b>{{ record.summary.case_count }}</b></span>
              <span><small>确认事件</small><b>{{ record.summary.high_risk_count }}</b></span>
              <span><small>待复核</small><b>{{ record.summary.suspicious_count }}</b></span>
              <span><small>已降噪</small><b>{{ record.summary.noise_count }}</b></span>
              <span><small>智能体研判</small><b>{{ completedAnalysisCount(record) }}</b></span>
            </div>
          </article>
        </div>
        <NEmpty v-else description="还没有历史研判记录" />
        <footer><span>最多保留最近 {{ HISTORY_LIMIT }} 个批次；智能体结果按事件归档并脱敏，超过 1,000 条的批次只保留统计摘要。</span><NButton secondary @click="historyModalVisible = false">关闭</NButton></footer>
      </section>
    </NModal>

    <!-- 企业微信配置 -->
    <NModal v-model:show="webhookModalVisible" :auto-focus="false" :trap-focus="false" transform-origin="center">
      <section class="webhook-modal">
        <header><div><small>DELIVERY SETTINGS</small><h3>企业微信机器人推送</h3></div><button type="button" aria-label="关闭" @click="webhookModalVisible = false">×</button></header>
        <div class="webhook-form">
          <label><span>机器人推送地址</span><input ref="webhookInput" v-model="webhookDraft" class="webhook-url-input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." @input="pushError = ''; webhookCheckStatus = webhookConfigured ? 'saved' : 'idle'"></label>
          <p>地址只保存在当前浏览器本地，不会写入项目代码。推送简报会隐藏完整 IP、原始日志和命令行。“验证连接”会向群内发送一条连接验证消息。</p>
          <label class="auto-push-row"><div><b>研判完成后自动推送</b><small>仅对之后手动导入的告警批次生效</small></div><NSwitch v-model:value="autoPush" /></label>
          <div class="webhook-status" :class="webhookCheckStatus"><span />{{ webhookStatusLabel }}<small v-if="lastPushedAt">最近送达 {{ formatHistoryTime(lastPushedAt) }}</small></div>
          <small v-if="pushError" class="push-error">{{ pushError }}</small>
        </div>
        <footer><NButton v-if="webhookConfigured" quaternary type="error" @click="clearWebhookSettings">清除配置</NButton><span class="footer-spacer" /><NButton secondary @click="webhookModalVisible = false">取消</NButton><NButton secondary :loading="webhookCheckStatus === 'checking'" @click="verifyWebhookSettings">验证连接</NButton><NButton type="primary" @click="saveWebhookSettings()">保存配置</NButton></footer>
      </section>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.triage-workbench { display: grid; gap: 11px; color: #d9e5ee; }
.triage-head { display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; align-items: center; padding: 18px 22px; border: 1px solid #1e4058; border-radius: 12px; background: radial-gradient(circle at 85% 20%, rgba(47,145,255,.16), transparent 32%), linear-gradient(135deg, #0c2131, #091723); }
.head-copy { grid-column: 1 / -1; }
.head-badge { display: flex; align-items: center; gap: 8px; color: #58a9d6; font: 8px ui-monospace, monospace; letter-spacing: .12em; }
.head-badge span { width: 24px; height: 20px; display: grid; place-items: center; border: 1px solid #2f91ff; border-radius: 5px; color: #a9d5ff; background: rgba(47,145,255,.16); font-weight: 700; }
.head-copy h2 { margin: 10px 0 6px; color: #edf5fa; font-size: 22px; letter-spacing: -.02em; }
.head-copy p { max-width: 780px; margin: 0; color: #8da3b4; font-size: 11px; line-height: 1.7; }
.head-copy p b { color: #a9c8dc; }
.head-actions { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.file-input { display: none; }
.dataset-label, .import-error { grid-column: 1 / -1; color: #5f7d91; font-size: 8.5px; }
.import-error { color: #f07b88; }

.history-preview-strip { display: grid; gap: 9px; padding: 12px 14px; border: 1px solid #1d3a4d; border-radius: 10px; background: linear-gradient(135deg, rgba(13,35,51,.96), rgba(8,24,36,.96)); }
.history-preview-strip > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.history-preview-strip > header small { color: #4488a5; font-size: 7px; letter-spacing: .12em; }
.history-preview-strip > header h3 { margin: 3px 0 0; color: #d4e3ec; font-size: 12px; }
.history-preview-strip > header button { border: 0; color: #68a9cd; background: transparent; font-size: 8px; cursor: pointer; }
.history-preview-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.history-preview-list > button { min-width: 0; display: grid; gap: 4px; padding: 9px 10px; border: 1px solid #1e3d51; border-radius: 8px; color: #7893a5; background: #091925; text-align: left; cursor: pointer; transition: .18s ease; }
.history-preview-list > button:hover { border-color: #327ba8; transform: translateY(-1px); }
.history-preview-list span { color: #54778d; font-size: 7px; }
.history-preview-list b { overflow: hidden; color: #c9dce7; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.history-preview-list small { color: #7391a4; font-size: 7.5px; }
.history-preview-list em { color: #4d788f; font-size: 7px; font-style: normal; }
.history-preview-list i { justify-self: end; color: #63b7df; font-size: 7px; font-style: normal; }
.history-preview-empty { padding: 10px; border: 1px dashed #244254; border-radius: 7px; color: #5b788a; font-size: 8px; text-align: center; }

.flow-strip { display: grid; grid-template-columns: auto auto minmax(150px, auto) auto minmax(280px, 1fr) auto auto; align-items: stretch; gap: 8px; padding: 10px 12px; border: 1px solid #1c3548; border-radius: 10px; background: #0a1926; }
.flow-node { min-width: 150px; position: relative; display: grid; gap: 3px; padding: 10px 12px; border: 1px solid #23435a; border-radius: 8px; background: #091722; text-align: center; transition: .25s ease; }
.flow-node span { color: #5f95ad; font-size: 7px; letter-spacing: .1em; }
.flow-node b { color: #c9dbe6; font-size: 11px; }
.flow-node small { color: #5d7a8d; font-size: 7.5px; line-height: 1.4; }
.flow-node > i { position: absolute; top: 8px; right: 8px; padding: 1px 5px; border-radius: 4px; color: #7cc4ec; background: #10293b; font-size: 6.5px; font-style: normal; }
.flow-node.clickable > i { color: #2f91ff; }
.flow-node.lit { border-color: #2f91ff; background: rgba(17,52,76,.95); box-shadow: 0 0 16px rgba(47,145,255,.18); }
.flow-node.lit b { color: #7cc4ec; }
.flow-node[role='button'] { cursor: pointer; }
.flow-node[role='button']:hover { border-color: #2f91ff; }
.flow-arrow { align-self: center; width: 14px; height: 1px; background: linear-gradient(90deg, #2f6f96, #2f91ff); }
.flow-agents { display: flex; flex-wrap: wrap; gap: 6px; align-content: center; }
.flow-agents button { min-width: 118px; display: grid; grid-template-columns: 26px 1fr; align-items: center; gap: 3px 7px; padding: 7px 9px; border: 1px solid #1e3a4e; border-radius: 7px; color: #7e96a8; background: #091722; text-align: left; cursor: pointer; transition: .2s ease; }
.flow-agents button span { width: 25px; height: 25px; grid-row: 1 / 3; display: grid; place-items: center; border-radius: 6px; color: #4a7187; background: #102637; font-size: 10px; }
.flow-agents button b { font-size: 8px; }
.flow-agents button small { font-size: 7px; color: #536c7e; }
.flow-agents button.done { border-color: #205044; background: #0a211d; }
.flow-agents button.done span { color: #b7f4e1; background: #16473e; }
.flow-agents button.done small { color: #4bcd8b; }
.flow-agents button:hover { border-color: #2f91ff; }
.flow-agents em { align-self: center; color: #4f6879; font-size: 8px; font-style: normal; }

.run-progress-card { display: grid; grid-template-columns: 9px 1fr auto; align-items: center; gap: 9px; padding: 9px 14px; border: 1px solid #21445a; border-radius: 8px; background: #0a1c2a; }
.run-progress-card b { font-size: 10px; }
.run-progress-card small { color: #617c8e; font-size: 8px; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #50d3de; box-shadow: 0 0 0 5px rgba(80,211,222,.09); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .45; } }

.triage-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
.triage-metrics article { padding: 11px 13px; border: 1px solid #1c3548; border-radius: 9px; background: #0a1926; }
.triage-metrics article.metric-accent { border-color: #235976; background: linear-gradient(145deg, #0d2637, #0a1b28); }
.triage-metrics small { color: #7690a2; font-size: 8.5px; }
.triage-metrics b { display: block; margin-top: 6px; color: #e3edf3; font-size: 20px; }
.triage-metrics b i { margin-left: 2px; color: #50c9d4; font-size: 9px; font-style: normal; }
.triage-metrics p { margin: 4px 0 0; color: #597286; font-size: 7.5px; }

.case-workspace { min-height: 600px; display: grid; grid-template-columns: 300px minmax(0, 1fr); border: 1px solid #1c3548; border-radius: 10px; background: #0a1926; overflow: hidden; }
.case-list-panel { min-width: 0; border-right: 1px solid #1c3548; background: #081722; }
.case-list-panel > header { min-height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #1c3548; }
.case-list-panel header small { color: #3f899d; font-size: 7px; letter-spacing: .12em; }
.case-list-panel h3 { margin: 3px 0 0; font-size: 12px; }
.case-filters { display: grid; gap: 7px; padding: 9px; border-bottom: 1px solid #182f41; }
.case-list { max-height: 720px; overflow: auto; padding: 7px; }
.case-list > button { width: 100%; display: block; padding: 10px; border: 1px solid transparent; border-radius: 8px; color: #c1d0da; background: transparent; text-align: left; cursor: pointer; }
.case-list > button + button { margin-top: 5px; }
.case-list > button:hover, .case-list > button.active { border-color: #29536b; background: #10283a; }
.case-list > button.active { box-shadow: inset 2px 0 #2f91ff; }
.case-row-top { display: flex; align-items: center; gap: 7px; }
.case-row-top > b { color: #e5b868; font: 8px ui-monospace, monospace; }
.case-row-top > span { margin-left: auto; color: #526c7e; font-size: 7px; }
.case-list h4 { margin: 7px 0 5px; font-size: 10px; }
.case-list p { margin: 0; color: #7690a2; font: 8px ui-monospace, monospace; }
.case-list p i { color: #3e7891; font-style: normal; }
.case-list footer { display: grid; grid-template-columns: 1fr auto 25px; align-items: center; gap: 6px; margin-top: 7px; color: #526c7e; font-size: 7px; }
.case-list footer span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.case-list footer strong { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: #8fcbe3; background: #102e42; font-size: 8px; }

.case-detail-panel { min-width: 0; padding: 13px 14px 16px; }
.io-block, .agent-flow-block { margin-bottom: 11px; padding: 11px; border: 1px solid #1c374a; border-radius: 9px; background: #081722; }
.io-block > header, .agent-flow-block > header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 9px; }
.io-block > header small, .agent-flow-block > header small { color: #3f899d; font-size: 7px; letter-spacing: .12em; }
.io-block h4, .agent-flow-block h4 { margin: 3px 0 0; font-size: 11px; }
.io-block > header > span, .agent-flow-block > header > span { margin-left: auto; color: #5d7a8d; font-size: 7.5px; }
.input-block { border-color: #1d4a5c; background: linear-gradient(145deg, #0a202e, #081722); }
.io-grid { display: grid; grid-template-columns: 1fr 28px 1fr 1fr; gap: 8px; }
.io-grid article { min-width: 0; padding: 9px 10px; border: 1px solid #1b3a4d; border-radius: 7px; background: #0a1c29; }
.io-grid article.io-arrow { display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #2f91ff; font-size: 16px; }
.io-grid small, .io-grid b { display: block; }
.io-grid small { color: #4f7890; font-size: 7px; }
.io-grid b { margin-top: 4px; overflow: hidden; color: #cfe0e9; font: 9.5px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.io-grid p { margin: 4px 0 0; color: #596f81; font-size: 7px; }
.payload-box { margin-top: 8px; border: 1px solid #1a3849; border-radius: 6px; background: #061320; }
.payload-box summary { padding: 7px 9px; color: #5f8ba0; font-size: 8px; cursor: pointer; }
.payload-box pre { margin: 0; padding: 0 9px 8px; color: #6f93a8; font: 7px/1.55 ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; }

.agent-chain { display: grid; grid-template-columns: minmax(200px, .8fr) 16px 1fr; align-items: stretch; gap: 0; }
.chain-commander, .chain-agent { display: grid; grid-template-columns: 32px 1fr; align-items: center; gap: 4px 9px; padding: 9px 11px; border: 1px solid #1c394b; border-radius: 8px; color: #b9cdd9; background: #091a26; text-align: left; cursor: pointer; transition: .2s ease; }
.chain-commander { border-color: #23536b; background: linear-gradient(145deg, #0d2838, #091a26); }
.chain-commander:hover, .chain-agent:hover { border-color: #2f91ff; box-shadow: 0 0 14px rgba(47,145,255,.14); }
.chain-icon { width: 30px; height: 30px; grid-row: 1 / 3; display: grid; place-items: center; border: 1px solid #24536b; border-radius: 7px; color: #6fd3e0; background: #0f2c3d; font-size: 12px; }
.chain-icon.high { color: #e58a9a; border-color: #5a3344; background: #2a1520; }
.chain-icon.medium { color: #e5c07b; border-color: #54471f; background: #251f12; }
.chain-commander b, .chain-agent b, .chain-commander small, .chain-agent small, .chain-commander i, .chain-agent i, .chain-agent em { display: block; }
.chain-commander b, .chain-agent b { font-size: 9.5px; }
.chain-commander small, .chain-agent small { margin-top: 2px; color: #54707f; font-size: 7px; line-height: 1.4; }
.chain-commander i, .chain-agent i { margin-top: 3px; color: #2f91ff; font-size: 7px; font-style: normal; }
.chain-agent em { margin-top: 3px; color: #5b859a; font-size: 7px; font-style: normal; }
.chain-agent em.high { color: #e58a9a; }
.chain-connector { position: relative; }
.chain-connector::after { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #2f6f96; }
.chain-connector::before { content: '→'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #2f91ff; font-size: 9px; }
.chain-subagents { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 6px; }
.commander-decision { margin: 9px 0 0; padding: 8px 10px; border-left: 2px solid #2f91ff; color: #8fb3c6; background: #0d2130; font-size: 8px; line-height: 1.55; }

.output-block { border-color: #234a4d; background: linear-gradient(145deg, #0b2426, #081722); }
.verdict-box { display: grid; grid-template-columns: 46px 1fr; gap: 11px; align-items: center; padding: 11px; border: 1px solid #1c3d40; border-radius: 8px; background: #0a1c1f; }
.verdict-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; color: #e5b868; background: #1e1c10; font-size: 11px; font-weight: 700; }
.verdict-mark.confirmed { color: #f08b97; background: #2b151d; }
.verdict-mark.noise { color: #6fd3a8; background: #0f2720; }
.verdict-copy small { color: #4f9185; font-size: 7px; letter-spacing: .12em; }
.verdict-copy b { display: block; margin-top: 4px; color: #d5e4ea; font-size: 10.5px; line-height: 1.55; }
.verdict-copy p { margin: 6px 0 0; color: #658194; font-size: 8px; line-height: 1.55; }
.soar-list { display: grid; gap: 7px; margin-top: 9px; }
.soar-title { color: #4f9185; font-size: 7px; letter-spacing: .12em; }
.soar-list article { padding: 9px 10px; border: 1px solid #1b3d3f; border-radius: 7px; background: #081b1f; }
.soar-list article > header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; }
.soar-list article > header > b { color: #6fc7b8; font: 8px ui-monospace, monospace; }
.soar-list h5 { margin: 0; font-size: 10px; }
.soar-list code { display: block; overflow: hidden; margin-top: 5px; color: #5f9a8e; font: 7px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.soar-list ul { display: grid; gap: 3px; margin: 7px 0 0; padding: 0; list-style: none; }
.soar-list li { display: grid; grid-template-columns: 15px 1fr; gap: 6px; color: #7f9a94; font-size: 7.5px; line-height: 1.45; }
.soar-list li span { width: 14px; height: 14px; display: grid; place-items: center; border-radius: 3px; color: #59b8a6; background: #0f2c2a; font-size: 6px; }
.soar-list article > footer { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #1b3d3f; color: #54766e; font-size: 6.5px; }

.real-analysis-block { margin: 0 0 11px; padding: 11px; border: 1px solid #2a4a68; border-radius: 9px; background: linear-gradient(145deg, #0c2035, #091a27); }
.real-analysis-block > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.real-title small { color: #4f9ed0; font-size: 7px; letter-spacing: .12em; }
.real-title h4 { margin: 3px 0 0; font-size: 11px; }
.real-actions { display: flex; align-items: center; gap: 8px; }
.real-progress { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #21445a; border-radius: 7px; color: #7cc4ec; background: #0a1c2a; font-size: 8px; }
.real-progress .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #50d3de; box-shadow: 0 0 0 5px rgba(80,211,222,.09); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .45; } }
.real-error { margin-top: 8px; padding: 8px 10px; border: 1px solid #5a3540; border-radius: 7px; color: #ed7581; background: #2a151c; font-size: 8px; }
.real-agents { display: grid; gap: 7px; margin-top: 9px; }
.real-agents article { padding: 9px 10px; border: 1px solid #1c394b; border-radius: 7px; background: #081722; }
.real-agents article > header { display: flex; align-items: center; gap: 8px; }
.real-agents article > header b { font-size: 9px; }
.real-agents article > header em { margin-left: auto; color: #4bcd8b; font-size: 7px; font-style: normal; }
.real-agents article > header em.err { color: #ed7581; }
.real-agents .chain-icon { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #24536b; border-radius: 6px; color: #6fd3e0; background: #0f2c3d; font-size: 10px; }
.real-agent-task { margin: 7px 0 0; color: #6f93a8; font-size: 7.5px; line-height: 1.5; }
.real-agent-task i { margin-right: 5px; padding: 1px 4px; border-radius: 3px; color: #9fd0e6; background: #123041; font-size: 6px; font-style: normal; }
.real-agent-output { margin-top: 6px; padding: 8px 9px; border: 1px solid #1a3849; border-radius: 6px; background: #061320; }
.real-agent-output pre { margin: 0; color: #7f9db2; font: 7px/1.6 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
.real-verdict { margin-top: 9px; padding: 10px 11px; border: 1px solid #23536b; border-radius: 8px; background: linear-gradient(145deg, #0d2838, #0a1c29); }
.real-verdict small, .real-dispositions small { display: block; color: #4f9eb2; font-size: 7px; letter-spacing: .12em; }
.real-verdict p { margin: 6px 0 0; color: #b9cdd9; font-size: 9px; line-height: 1.65; }
.real-dispositions { display: grid; gap: 6px; margin-top: 9px; }
.real-dispositions > small { margin-bottom: 2px; }
.real-dispositions article { padding: 9px 10px; border: 1px solid #1b3d3f; border-radius: 7px; background: #081b1f; }
.real-dispositions article > header { display: grid; grid-template-columns: 18px 1fr auto auto; align-items: center; gap: 7px; }
.real-dispositions article > header > span { width: 17px; height: 17px; display: grid; place-items: center; border-radius: 4px; color: #59b8a6; background: #0f2c2a; font-size: 7px; }
.real-dispositions article > header > b { color: #c9e4df; font-size: 9px; }
.real-dispositions article > p { margin: 7px 0 0; color: #7f9a94; font-size: 8px; line-height: 1.55; }

.raw-evidence { border: 1px solid #1b3547; border-radius: 7px; overflow: hidden; }
.raw-evidence > button { width: 100%; display: flex; justify-content: space-between; padding: 9px 11px; border: 0; color: #7890a1; background: #081722; font-size: 8px; cursor: pointer; }
.raw-evidence > button b { color: #4fa8bd; }
.raw-evidence > div { max-height: 300px; overflow: auto; padding: 8px; background: #06131e; }
.raw-evidence article { padding: 8px; border: 1px solid #193244; border-radius: 6px; }
.raw-evidence article + article { margin-top: 6px; }
.raw-evidence article header { display: flex; justify-content: space-between; color: #6d8799; font-size: 7px; }
.raw-evidence pre { overflow: auto; margin: 7px 0 0; color: #7091a5; font: 7px/1.5 ui-monospace, monospace; white-space: pre-wrap; }
.case-detail-empty { display: grid; place-items: center; }

.agent-modal { width: min(620px, calc(100vw - 32px)); max-height: 86vh; display: flex; flex-direction: column; border: 1px solid #28516a; border-radius: 12px; color: #d9e5ee; background: #0a1926; box-shadow: 0 24px 80px rgba(0,0,0,.5); overflow: hidden; }
.agent-modal > header { display: grid; grid-template-columns: 42px 1fr auto auto; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #1d384b; background: linear-gradient(135deg, #0d2637, #0a1926); }
.modal-icon { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #2f6f96; border-radius: 10px; color: #7cc4ec; background: #10293b; font-size: 17px; }
.modal-title small { color: #4691a8; font-size: 7px; letter-spacing: .12em; }
.modal-title h3 { margin: 4px 0 3px; font-size: 15px; }
.modal-title p { margin: 0; color: #5f7d91; font-size: 8px; }
.modal-close { border: 0; color: #6b8496; background: transparent; font-size: 20px; cursor: pointer; }
.modal-body { display: grid; gap: 13px; padding: 15px 16px; overflow: auto; }
.modal-body > section > small { color: #3f899d; font-size: 7px; letter-spacing: .12em; }
.decision-text, .task-text, .input-text { margin: 7px 0 0; padding: 9px 10px; border: 1px solid #1b394b; border-radius: 7px; color: #8fb3c6; background: #081722; font-size: 8.5px; line-height: 1.6; }
.task-text { color: #9db4c2; }
.input-text { color: #6f93a8; font: 8px/1.6 ui-monospace, monospace; }
.logic-list { display: grid; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.logic-list li { display: grid; grid-template-columns: 26px 1fr; gap: 9px; align-items: center; padding: 8px 10px; border: 1px solid #1c374a; border-radius: 7px; background: #091722; }
.logic-list li span { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: #526f83; background: #10293b; font-size: 9px; }
.logic-list li.hit { border-color: #1e4a3c; }
.logic-list li.hit span { color: #4bcd8b; background: #123328; }
.logic-list li b { display: block; color: #b9cdd9; font-size: 9px; line-height: 1.45; }
.logic-list li em { display: block; margin-top: 3px; color: #54707f; font-size: 7.5px; font-style: normal; line-height: 1.45; }
.dispatch-summary { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.dispatch-summary span { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid #1c374a; border-radius: 6px; background: #091722; font-size: 8px; cursor: pointer; }
.dispatch-summary span:hover { border-color: #2f91ff; }
.dispatch-summary b { width: 19px; height: 19px; display: grid; place-items: center; border-radius: 5px; color: #6fd3e0; background: #0f2c3d; font-size: 9px; }
.dispatch-summary i { color: #5b859a; font-size: 7px; font-style: normal; }
.agent-conclusion { padding: 10px 11px; border: 1px solid #1c374a; border-radius: 7px; background: #091722; }
.agent-conclusion b { display: block; color: #c9dbe6; font-size: 9.5px; line-height: 1.55; }
.agent-conclusion span { display: block; margin-top: 5px; color: #5b859a; font-size: 7.5px; }
.agent-conclusion.high { border-color: #593344; }
.agent-conclusion.high span { color: #e58a9a; }
.evidence-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.evidence-chips em { padding: 4px 7px; border-radius: 5px; color: #6f93a8; background: #0d2231; font-size: 7.5px; font-style: normal; }

.history-modal { width: min(760px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 48px)); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; border: 1px solid #28516a; border-radius: 11px; color: #d9e5ee; background: #0a1926; box-shadow: 0 24px 80px rgba(0,0,0,.45); overflow: hidden; }
.history-modal > header { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid #1d384b; }
.history-modal > header small { color: #4691a8; font-size: 7px; letter-spacing: .12em; }
.history-modal > header h3 { margin: 4px 0 0; font-size: 13px; }
.history-modal > header button { border: 0; color: #6b8496; background: transparent; font-size: 20px; cursor: pointer; }
.history-modal-list { display: grid; gap: 8px; padding: 14px; overflow-y: auto; }
.history-modal-list > article { padding: 12px; border: 1px solid #1d3c50; border-radius: 9px; background: #081722; }
.history-modal-list > article > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.history-modal-list > article > header div { min-width: 0; display: grid; gap: 3px; }
.history-modal-list > article > header b { overflow: hidden; color: #d5e4ed; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.history-modal-list > article > header small { color: #5e7c8f; font-size: 7.5px; }
.history-modal-list > article > div { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; }
.history-modal-list > article > div span { display: grid; gap: 3px; padding: 7px 8px; border-radius: 6px; background: #0d2331; }
.history-modal-list > article > div small { color: #5d7c90; font-size: 7px; }
.history-modal-list > article > div b { color: #9fc4d8; font-size: 12px; }
.history-modal > footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 15px; border-top: 1px solid #1d384b; }
.history-modal > footer span { color: #5c788a; font-size: 7.5px; }

.webhook-modal { width: min(500px, calc(100vw - 32px)); border: 1px solid #28516a; border-radius: 11px; color: #d9e5ee; background: #0a1926; box-shadow: 0 24px 80px rgba(0,0,0,.45); overflow: hidden; }
.webhook-modal > header { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid #1d384b; }
.webhook-modal header small { color: #4691a8; font-size: 7px; letter-spacing: .12em; }
.webhook-modal header h3 { margin: 4px 0 0; font-size: 13px; }
.webhook-modal header button { border: 0; color: #6b8496; background: transparent; font-size: 20px; cursor: pointer; }
.webhook-form { display: grid; gap: 13px; padding: 15px; }
.webhook-form label > span, .webhook-url-input { display: block; }
.webhook-form label > span { margin-bottom: 6px; color: #8298a8; font-size: 8.5px; }
.webhook-url-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #31566c; border-radius: 7px; outline: none; color: #d7e5ed; background: #071722; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; transition: border-color .16s ease, box-shadow .16s ease; }
.webhook-url-input::placeholder { color: #506b7c; }
.webhook-url-input:focus { border-color: #50a8d4; box-shadow: 0 0 0 3px rgba(80,168,212,.12); }
.webhook-form > p { margin: 0; padding: 8px 10px; border: 1px solid #1b394b; border-radius: 7px; color: #617d90; background: #081722; font-size: 8px; line-height: 1.55; }
.auto-push-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.auto-push-row b, .auto-push-row small { display: block; }
.auto-push-row b { font-size: 9px; }
.auto-push-row small { margin-top: 4px; color: #5b7385; font-size: 7px; }
.webhook-status { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid #203b4d; border-radius: 7px; color: #7390a3; background: #081722; font-size: 8px; }
.webhook-status > span { width: 7px; height: 7px; border-radius: 50%; background: #597181; }
.webhook-status > small { margin-left: auto; color: #547286; font-size: 7px; }
.webhook-status.checking > span { background: #4da8e8; box-shadow: 0 0 8px rgba(77,168,232,.65); animation: webhook-pulse 1s infinite; }
.webhook-status.success { border-color: #205143; color: #73d8b1; }
.webhook-status.success > span { background: #4bd49d; }
.webhook-status.error { border-color: #5d3037; color: #ef8792; }
.webhook-status.error > span { background: #ef6978; }
.webhook-modal > footer { display: flex; justify-content: flex-end; gap: 7px; padding: 10px 15px; border-top: 1px solid #1d384b; }
.webhook-modal .footer-spacer { flex: 1; }
.push-error { color: #ed7581 !important; }

@keyframes webhook-pulse { 50% { opacity: .35; transform: scale(.75); } }

@media (max-width: 1280px) {
  .flow-strip { grid-template-columns: 1fr 1fr; }
  .flow-arrow { display: none; }
  .flow-agents { grid-column: 1 / -1; }
}
@media (max-width: 1000px) {
  .history-preview-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .history-modal-list > article > div { grid-template-columns: repeat(3, 1fr); }
  .case-workspace { grid-template-columns: 1fr; }
  .case-list-panel { border-right: 0; border-bottom: 1px solid #1c3548; }
  .case-list { max-height: 300px; }
  .agent-chain { grid-template-columns: 1fr; }
  .chain-connector { display: none; }
  .io-grid { grid-template-columns: 1fr 1fr; }
  .io-grid article.io-arrow { display: none; }
}
@media (max-width: 620px) {
  .triage-head { padding: 15px; }
  .history-preview-list { grid-template-columns: 1fr; }
  .history-modal-list > article > div { grid-template-columns: repeat(2, 1fr); }
  .webhook-modal > footer { flex-wrap: wrap; }
  .triage-metrics { grid-template-columns: repeat(2, 1fr); }
  .io-grid { grid-template-columns: 1fr; }
}
</style>
