import type { Context } from 'koa'
import { sendWechatBriefReport } from '../services/cyber-defense/wechat-report'

export async function sendWechatReport(ctx: Context) {
  try {
    const body = (ctx.request.body || {}) as Record<string, unknown>
    const result = await sendWechatBriefReport(body.webhook_url, body.report)
    ctx.body = result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.status = /请填写|仅支持|无效/.test(message) ? 400 : 502
    ctx.body = { error: message }
  }
}
