import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_CYBER_AGENTS,
  DEFAULT_CYBER_EDGES,
} from '../../packages/client/src/components/hermes/cyber-defense/cyber-studio'

describe('merged RedBlue Hermes studio', () => {
  it('ships a complete red and blue agent fleet with valid connections', () => {
    expect(DEFAULT_CYBER_AGENTS.length).toBeGreaterThanOrEqual(10)
    expect(DEFAULT_CYBER_AGENTS.some(agent => agent.group === 'red')).toBe(true)
    expect(DEFAULT_CYBER_AGENTS.some(agent => agent.group === 'blue')).toBe(true)

    const ids = new Set(DEFAULT_CYBER_AGENTS.map(agent => agent.id))
    expect(ids.size).toBe(DEFAULT_CYBER_AGENTS.length)
    for (const edge of DEFAULT_CYBER_EDGES) {
      expect(ids.has(edge.source), `${edge.id} source`).toBe(true)
      expect(ids.has(edge.target), `${edge.id} target`).toBe(true)
      expect(edge.source).not.toBe(edge.target)
    }
  })

  it('does not ship preset incident outcomes as agent results', () => {
    const serialized = JSON.stringify(DEFAULT_CYBER_AGENTS)
    expect(serialized).not.toMatch(/CASE-001|0\.96|模拟执行完成|瑞数/)
    for (const agent of DEFAULT_CYBER_AGENTS) {
      expect(agent.systemPrompt.length).toBeGreaterThan(20)
      expect(agent.steps.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('uses a cancellable live stream for task conversations', () => {
    const source = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberTaskWorkspace.vue', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')
    expect(source).toContain('startRunViaSocket')
    expect(source).toContain('model: activeModel.value?.model')
    expect(source).toContain('provider: activeModel.value?.provider')
    expect(source).toContain('function stopRun()')
    expect(source).toContain('reasoning-panel')
    expect(source).not.toContain('await runCyberDefenseChat')
    expect(view).toContain("v-if=\"cachedViews.has('tasks')\"")
    expect(view).toContain('<CyberTaskWorkspace v-if="cachedViews.has(\'tasks\')" v-show="activeView === \'tasks\'"')
    expect(view).not.toContain('<CyberTaskWorkspace v-else-if=')
    expect(view).not.toContain("if (view !== 'tasks') await loadData(false)")
    expect(view).toContain('history.replaceState')
  })

  it('only translates authentication failures from terminal run errors', () => {
    const source = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberTaskWorkspace.vue', 'utf8')

    expect(source).toContain('function runFailureText(')
    expect(source).toContain("liveAnswer.value ||= runFailureText(event.error)")
    expect(source).not.toContain('/HTTP\\s*401|Unauthorized/i.test(text)')
  })

  it('publishes the product route without exposing the runtime name', () => {
    const router = readFileSync('packages/client/src/router/index.ts', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')
    const template = view.slice(view.indexOf('<template>'), view.lastIndexOf('</template>'))
    expect(router).toContain("path: '/security-operations'")
    expect(template).not.toContain('Hermes')
  })

  it('keeps capability internals off the UI and creates tasks inside the task center', () => {
    const workspace = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberTaskWorkspace.vue', 'utf8')
    const agentStudio = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberAgentStudio.vue', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')

    expect(workspace).not.toContain('ctfSkills')
    expect(workspace).not.toContain('bindSkills')
    expect(workspace).not.toContain("name: 'hermes.kanban'")
    expect(agentStudio).not.toContain('skillOptions')
    expect(view).toContain('function openTaskCreator()')
    expect(view).toContain(':create-request="taskCreateRequest"')
  })

  it('uses the live skill inventory on overview and exposes real conversation history in the task center', () => {
    const workspace = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberTaskWorkspace.vue', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')
    const viewTemplate = view.slice(view.indexOf('<template>'), view.lastIndexOf('</template>'))

    expect(view).toContain('fetchSkills(getActiveProfileName() || undefined)')
    expect(viewTemplate).toContain('Skill 数量')
    expect(viewTemplate).not.toContain('<small>工具调用</small>')
    expect(viewTemplate).not.toContain('<small>智能体执行</small>')
    expect(viewTemplate).not.toContain('真实运行时间线')
    expect(workspace).toContain('fetchConversationDetail(summary.id)')
    expect(workspace).toContain('历史问答')
    expect(workspace).toContain('openConversationHistory(conversation)')
  })

  it('ships a sanitized historical validation report in the incident report view', () => {
    const report = readFileSync('packages/client/public/reports/robot-waf-practice-sanitized.html', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')

    expect(report).toContain('2026-08-25')
    expect(report).toContain('security-lab.example.internal')
    expect(report).toContain('原始截图已脱敏移除')
    expect(report).not.toMatch(/unicomsign|bjunicom|13800138000|AQqfncs|data:image/i)
    expect(report).not.toContain('测试')
    expect(view).toContain('robot-waf-practice-sanitized.html')
    expect(view).toContain('历史报告归档')
    expect(view).toContain('事件证据时间线')
    expect(view).toContain('报告完整度')
    expect(view).toContain('智能体关键发现')
    expect(view).not.toContain('<iframe')
  })

  it('normalizes legacy test wording before rendering it in the product UI', () => {
    const workspace = readFileSync('packages/client/src/components/hermes/cyber-defense/CyberTaskWorkspace.vue', 'utf8')
    const view = readFileSync('packages/client/src/views/hermes/CyberDefenseView.vue', 'utf8')
    const workspaceTemplate = workspace.slice(workspace.indexOf('<template>'), workspace.lastIndexOf('</template>'))
    const viewTemplate = view.slice(view.indexOf('<template>'), view.lastIndexOf('</template>'))

    expect(workspace).toContain(".replace(/测试/g, '验证')")
    expect(view).toContain(".replace(/测试/g, '验证')")
    expect(workspaceTemplate).not.toContain('测试')
    expect(viewTemplate).not.toContain('测试')
  })
})
