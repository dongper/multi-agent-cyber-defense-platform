import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildWechatMarkdown,
  normalizeBriefReport,
  normalizeWechatWebhookUrl,
  sendWechatBriefReport,
} from '../../packages/server/src/services/cyber-defense/wechat-report'

const webhook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=11111111-2222-3333-4444-555555555555'

describe('cyber defense WeChat Work report', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('only accepts the official robot endpoint', () => {
    expect(normalizeWechatWebhookUrl(webhook)).toContain('qyapi.weixin.qq.com/cgi-bin/webhook/send')
    expect(() => normalizeWechatWebhookUrl('https://example.com/cgi-bin/webhook/send?key=11111111-2222-3333-4444-555555555555')).toThrow('仅支持')
    expect(() => normalizeWechatWebhookUrl('http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=11111111-2222-3333-4444-555555555555')).toThrow('仅支持')
  })

  it('builds a short report and masks complete source addresses', () => {
    const report = normalizeBriefReport({
      batch_name: 'SIEM 批次', generated_at: '2026-08-26T08:00:00Z', source_count: 100,
      case_count: 20, reduction_rate: 80, confirmed_count: 2, suspicious_count: 3, noise_count: 15,
      high_risk_cases: [{ case_id: 'INC-1', priority: 'P1', alert_type: '异常登录', risk_score: 91, source_ip: '198.51.100.22', asset_name: '统一门户' }],
    })
    const markdown = buildWechatMarkdown(report)

    expect(markdown).toContain('告警降噪研判简报')
    expect(markdown).toContain('198.51.*.*')
    expect(markdown).not.toContain('198.51.100.22')
    expect(markdown.length).toBeLessThanOrEqual(4000)
  })

  it('sends the enterprise robot markdown payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errcode: 0, errmsg: 'ok' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendWechatBriefReport(webhook, { source_count: 3, case_count: 2, high_risk_cases: [] })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, request] = fetchMock.mock.calls[0]
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body).msgtype).toBe('markdown')
  })
})
