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
    expect(source).toContain('startRunViaSocket')
    expect(source).toContain('function stopRun()')
    expect(source).toContain('reasoning-panel')
    expect(source).not.toContain('await runCyberDefenseChat')
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
})
