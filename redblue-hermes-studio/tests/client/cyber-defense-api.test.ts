import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequest = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  request: mockRequest,
}))

import { runCyberDefenseChat } from '@/api/hermes/cyber-defense'

describe('cyber defense chat api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs a real Hermes chat session with a stable task session id', async () => {
    mockRequest.mockResolvedValue({
      ok: true,
      status: 'completed',
      session_id: 'cyber-defense-task-7',
      output: 'done',
    })

    await expect(runCyberDefenseChat({
      input: 'review authorized evidence',
      session_id: 'cyber-defense-task-7',
      profile: 'default',
      timeout_ms: 900_000,
    })).resolves.toMatchObject({ ok: true, output: 'done' })

    expect(mockRequest).toHaveBeenCalledWith('/api/chat-run/runs', {
      method: 'POST',
      body: JSON.stringify({
        input: 'review authorized evidence',
        session_id: 'cyber-defense-task-7',
        profile: 'default',
        timeout_ms: 900_000,
        source: 'api_server',
        include_events: false,
      }),
    })
  })
})
