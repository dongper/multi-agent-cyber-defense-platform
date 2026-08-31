import { request } from '../client'

export interface CyberDefenseChatRunRequest {
  input: string
  session_id: string
  profile?: string
  model?: string
  provider?: string
  timeout_ms?: number
}

export interface CyberDefenseChatRunResponse {
  ok: boolean
  status: string
  session_id: string
  run_id?: string
  output: string
  reasoning?: string
}

export async function runCyberDefenseChat(
  input: CyberDefenseChatRunRequest,
): Promise<CyberDefenseChatRunResponse> {
  return request<CyberDefenseChatRunResponse>('/api/chat-run/runs', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      source: 'api_server',
      include_events: false,
    }),
  })
}

export interface CyberDefenseWechatReport {
  batch_name: string
  generated_at: string
  source_count: number
  case_count: number
  reduction_rate: number
  confirmed_count: number
  suspicious_count: number
  noise_count: number
  high_risk_cases: Array<{
    case_id: string
    priority: string
    alert_type: string
    risk_score: number
    source_ip: string
    asset_name: string
  }>
}

export async function sendCyberDefenseWechatReport(input: {
  webhook_url: string
  report: CyberDefenseWechatReport
}): Promise<{ ok: boolean; delivered_at: string }> {
  return request('/api/cyber-defense/wechat/report', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
