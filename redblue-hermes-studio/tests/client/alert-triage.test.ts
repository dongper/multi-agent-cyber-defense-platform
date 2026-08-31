import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ALERT_TEMPLATE_FIELDS,
  SAMPLE_ALERTS,
  alertsToCsv,
  analyzeAlerts,
  parseAlertFile,
} from '../../packages/client/src/components/hermes/cyber-defense/alert-triage'

describe('alert noise triage workbench', () => {
  it('round-trips the documented CSV template', () => {
    const csv = alertsToCsv(SAMPLE_ALERTS.slice(0, 2))
    const parsed = parseAlertFile(csv, 'alerts.csv')

    expect(csv.split('\n')[0]).toBe(ALERT_TEMPLATE_FIELDS.join(','))
    expect(parsed).toHaveLength(2)
    expect(parsed[0].alert_id).toBe(SAMPLE_ALERTS[0].alert_id)
    expect(parsed[0].internet_exposed).toBe(true)
  })

  it('accepts common aliases and rejects incomplete records', () => {
    const parsed = parseAlertFile(JSON.stringify([{
      event_id: 'EVENT-1', event_time: '2026-08-26T08:00:00Z', src_ip: '192.0.2.1',
      dst_ip: '10.0.0.1', event_type: '异常访问', level: '高', rule: '访问控制告警',
    }]), 'alerts.json')

    expect(parsed[0].severity).toBe('high')
    expect(parsed[0].source_ip).toBe('192.0.*.*')
    expect(() => parseAlertFile('[{"alert_id":"missing"}]', 'alerts.json')).toThrow('缺少必填字段')
  })

  it('aggregates repeat alerts and produces evidence-backed cases', () => {
    const result = analyzeAlerts(SAMPLE_ALERTS)

    expect(result.summary.source_count).toBe(SAMPLE_ALERTS.length)
    expect(result.summary.case_count).toBeLessThan(result.summary.source_count)
    expect(result.summary.suppressed_count).toBeGreaterThan(0)
    expect(result.summary.reduction_rate).toBeGreaterThan(0)
    expect(result.cases.some(item => item.verdict === 'confirmed')).toBe(true)
    expect(result.cases.some(item => item.verdict === 'noise')).toBe(true)
    expect(result.cases.every(item => item.findings.length === 7)).toBe(true)
    expect(result.cases.every(item => item.plan.length === 5)).toBe(true)
  })

  it('is exposed as a dedicated task-center capability without placeholder outcomes', () => {
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')
    const workbench = readFileSync('packages/client/src/components/hermes/cyber-defense/AlertNoiseWorkbench.vue', 'utf8')
    const template = workbench.slice(workbench.indexOf('<template>'), workbench.lastIndexOf('</template>'))

    expect(view).toContain("{ id: 'alerts', label: '告警降噪研判'")
    expect(view).toContain('<AlertNoiseWorkbench v-if="cachedViews.has(\'alerts\')" v-show="activeView === \'alerts\'" />')
    expect(template).toContain('导入告警')
    expect(template).toContain('历史研判记录')
    expect(template).toContain('安全指挥官 → 专项智能体')
    expect(template).toContain('启动智能体研判')
    expect(template).toContain('批次已归档')
    expect(template).toContain('completedAnalysisCount(record)')
    expect(template).toContain('验证连接')
    expect(template).not.toContain('测试')
    expect(template).not.toContain('载入示例')
    expect(template).not.toContain('真实智能体')
    expect(workbench).toContain('saveCompletedAgentAnalysis(item)')
    expect(workbench).toContain('agent_analyses: cloneAgentAnalyses(agentAnalysisSnapshots.value)')
    expect(workbench).toContain('restoreAgentAnalysis(selectedCaseId.value)')
  })
})
