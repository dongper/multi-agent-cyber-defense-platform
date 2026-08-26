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
