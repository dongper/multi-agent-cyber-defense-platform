const WECHAT_WEBHOOK_HOST = 'qyapi.weixin.qq.com'
const WECHAT_WEBHOOK_PATH = '/cgi-bin/webhook/send'
const MAX_REPORT_ITEMS = 5

export interface CyberDefenseBriefCase {
  case_id: string
  priority: string
  alert_type: string
  risk_score: number
  source_ip?: string
  asset_name?: string
}

export interface CyberDefenseBriefReport {
  batch_name: string
  generated_at: string
  source_count: number
  case_count: number
  reduction_rate: number
  confirmed_count: number
  suspicious_count: number
  noise_count: number
  high_risk_cases: CyberDefenseBriefCase[]
}

function text(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

function integer(value: unknown, max = 1_000_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(max, Math.max(0, Math.round(parsed)))
}

function decimal(value: unknown, max = 100): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(max, Math.max(0, Math.round(parsed * 10) / 10))
}

export function normalizeWechatWebhookUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('请填写企业微信机器人地址')
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== WECHAT_WEBHOOK_HOST || url.pathname !== WECHAT_WEBHOOK_PATH) {
    throw new Error('仅支持企业微信机器人推送地址')
  }
  const key = url.searchParams.get('key') || ''
  if (!/^[a-zA-Z0-9-]{20,100}$/.test(key)) throw new Error('企业微信机器人地址中的 key 无效')
  url.search = ''
  url.searchParams.set('key', key)
  url.hash = ''
  return url.toString()
}

function maskIp(value: string | undefined): string {
  const input = text(value, 100)
  const ipv4 = input.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.*.*`
  if (input.includes(':')) return `${input.split(':').slice(0, 2).join(':')}:****`
  return input || '未提供'
}

export function normalizeBriefReport(value: unknown): CyberDefenseBriefReport {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const rows = Array.isArray(body.high_risk_cases) ? body.high_risk_cases : []
  return {
    batch_name: text(body.batch_name, 120) || '未命名告警批次',
    generated_at: text(body.generated_at, 40) || new Date().toISOString(),
    source_count: integer(body.source_count),
    case_count: integer(body.case_count),
    reduction_rate: decimal(body.reduction_rate),
    confirmed_count: integer(body.confirmed_count),
    suspicious_count: integer(body.suspicious_count),
    noise_count: integer(body.noise_count),
    high_risk_cases: rows.slice(0, MAX_REPORT_ITEMS).map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        case_id: text(row.case_id, 80),
        priority: text(row.priority, 10),
        alert_type: text(row.alert_type, 100),
        risk_score: decimal(row.risk_score),
        source_ip: maskIp(text(row.source_ip, 100)),
        asset_name: text(row.asset_name, 100),
      }
    }),
  }
}

export function buildWechatMarkdown(report: CyberDefenseBriefReport): string {
  const time = Number.isNaN(Date.parse(report.generated_at))
    ? report.generated_at
    : new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  const caseLines = report.high_risk_cases.length
    ? report.high_risk_cases.map((item, index) => `${index + 1}. **[${item.priority || 'P3'}] ${item.alert_type || '未分类告警'}** · 风险 ${item.risk_score}\n   ${item.source_ip || '未提供'} → ${item.asset_name || '未提供资产名'}（${item.case_id || '无事件编号'}）`).join('\n')
    : '当前批次无确认事件。'
  return [
    '# 告警降噪研判简报',
    `> 批次：${report.batch_name}`,
    `> 完成时间：${time}`,
    '',
    `- 原始告警：**${report.source_count}** 条`,
    `- 聚合事件：**${report.case_count}** 个`,
    `- 降噪率：<font color="info">**${report.reduction_rate}%**</font>`,
    `- 确认事件：<font color="warning">**${report.confirmed_count}**</font> 个 · 待复核：**${report.suspicious_count}** 个`,
    '',
    '## 高风险关注',
    caseLines,
    '',
    '> 简报已隐藏完整地址、原始日志与命令行；详细证据请回到安全运营平台复核。',
  ].join('\n').slice(0, 4000)
}

export async function sendWechatBriefReport(webhookUrl: unknown, reportValue: unknown) {
  const url = normalizeWechatWebhookUrl(webhookUrl)
  const report = normalizeBriefReport(reportValue)
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { content: buildWechatMarkdown(report) } }),
    signal: AbortSignal.timeout(10_000),
  })
  const payload = await response.json().catch(() => ({})) as { errcode?: number; errmsg?: string }
  if (!response.ok || payload.errcode !== 0) {
    throw new Error(payload.errmsg || `企业微信返回 HTTP ${response.status}`)
  }
  return { ok: true, delivered_at: new Date().toISOString(), report }
}
