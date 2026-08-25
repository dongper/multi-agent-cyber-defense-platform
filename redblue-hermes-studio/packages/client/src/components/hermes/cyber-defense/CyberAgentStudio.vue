<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NInput, NModal, NSelect } from 'naive-ui'
import type { CyberStudioAgent, CyberStudioEdge } from './cyber-studio'

const props = defineProps<{
  agents: CyberStudioAgent[]
  edges: CyberStudioEdge[]
  selectedId: string
  statuses: Record<string, 'idle' | 'running' | 'completed' | 'failed'>
  results: Record<string, string>
}>()

const emit = defineEmits<{
  select: [id: string]
  run: [agent: CyberStudioAgent]
  save: [agent: CyberStudioAgent]
  create: [agent: CyberStudioAgent]
  positions: [agents: CyberStudioAgent[]]
  edges: [edges: CyberStudioEdge[]]
  sync: []
}>()

const canvas = ref<HTMLElement | null>(null)
const editVisible = ref(false)
const isCreating = ref(false)
const selectedEdge = ref<string | null>(null)
const dragging = ref<{ id: string; pointerId: number } | null>(null)
const connecting = ref<{ source: string; pointerId: number; target: { x: number; y: number } } | null>(null)
const draft = ref<CyberStudioAgent>({
  id: '', name: '', group: 'red', icon: 'A', role: '', description: '', systemPrompt: '', skills: [], steps: [], position: { x: 50, y: 22 },
})

const selected = computed(() => props.agents.find(agent => agent.id === props.selectedId) || props.agents[0])
function statusLabel(status: string) {
  return status === 'running' ? '运行中' : status === 'completed' ? '已完成' : status === 'failed' ? '失败' : '待运行'
}

function point(event: PointerEvent): { x: number; y: number } | null {
  if (!canvas.value) return null
  const rect = canvas.value.getBoundingClientRect()
  return {
    x: Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100)),
  }
}

function beginDrag(event: PointerEvent, id: string) {
  if ((event.target as HTMLElement).closest('button')) return
  const element = event.currentTarget as HTMLElement
  element.setPointerCapture(event.pointerId)
  dragging.value = { id, pointerId: event.pointerId }
  emit('select', id)
}

function moveDrag(event: PointerEvent) {
  if (!dragging.value) return
  const next = point(event)
  if (!next) return
  emit('positions', props.agents.map(agent => agent.id === dragging.value?.id ? { ...agent, position: next } : agent))
}

function endDrag(event: PointerEvent) {
  const element = event.currentTarget as HTMLElement
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
  dragging.value = null
}

function beginConnect(event: PointerEvent, source: string) {
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement
  element.setPointerCapture(event.pointerId)
  const agent = props.agents.find(item => item.id === source)
  connecting.value = { source, pointerId: event.pointerId, target: agent?.position || { x: 50, y: 50 } }
}

function moveConnect(event: PointerEvent) {
  if (!connecting.value) return
  const next = point(event)
  if (next) connecting.value = { ...connecting.value, target: next }
}

function finishConnect(event: PointerEvent) {
  const element = event.currentTarget as HTMLElement
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
  const source = connecting.value?.source
  const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-agent-input]')
  const target = targetElement?.dataset.agentInput
  connecting.value = null
  if (!source || !target || source === target) return
  if (props.edges.some(edge => edge.source === source && edge.target === target)) return
  emit('edges', [...props.edges, { id: `edge-${Date.now().toString(36)}`, source, target }])
}

function edgePath(edge: CyberStudioEdge) {
  const source = props.agents.find(agent => agent.id === edge.source)?.position
  const target = props.agents.find(agent => agent.id === edge.target)?.position
  if (!source || !target) return ''
  const bend = (source.x + target.x) / 2
  return `M ${source.x} ${source.y} C ${bend} ${source.y}, ${bend} ${target.y}, ${target.x} ${target.y}`
}

function previewPath() {
  if (!connecting.value) return ''
  const source = props.agents.find(agent => agent.id === connecting.value?.source)?.position
  if (!source) return ''
  const bend = (source.x + connecting.value.target.x) / 2
  return `M ${source.x} ${source.y} C ${bend} ${source.y}, ${bend} ${connecting.value.target.y}, ${connecting.value.target.x} ${connecting.value.target.y}`
}

function autoLayout() {
  const next = props.agents.map(agent => {
    const lane = props.agents.filter(item => item.group === agent.group)
    const index = lane.findIndex(item => item.id === agent.id)
    const x = lane.length === 1 ? 50 : 9 + index * (82 / (lane.length - 1))
    return { ...agent, position: { x, y: agent.group === 'red' ? 22 : 72 } }
  })
  emit('positions', next)
}

function openCreate() {
  isCreating.value = true
  draft.value = {
    id: `agent-${Date.now().toString(36)}`, name: '', group: 'red', icon: 'A', role: '', description: '',
    systemPrompt: '你是安全任务智能体。只在明确授权范围内工作，输出可追溯结论。', skills: [], steps: [], position: { x: 50, y: 22 },
  }
  editVisible.value = true
}

function openEdit(agent: CyberStudioAgent) {
  isCreating.value = false
  draft.value = JSON.parse(JSON.stringify(agent)) as CyberStudioAgent
  editVisible.value = true
}

function saveDraft() {
  const normalized = { ...draft.value, steps: draft.value.steps.filter(Boolean) }
  if (isCreating.value) emit('create', normalized)
  else emit('save', normalized)
  editVisible.value = false
}
</script>

<template>
  <div class="agent-studio-layout">
    <section class="studio-panel canvas-panel">
      <header class="panel-heading">
        <div><small>AGENT WORKFLOW STUDIO</small><h2>红蓝队智能体编排</h2></div>
        <div class="canvas-actions">
          <span>{{ agents.length }} Nodes · {{ edges.length }} Connections</span>
          <NButton v-if="selectedEdge" size="tiny" type="error" secondary @click="emit('edges', edges.filter(edge => edge.id !== selectedEdge)); selectedEdge = null">删除连接</NButton>
          <NButton size="tiny" @click="autoLayout">自动布局</NButton>
          <NButton size="tiny" @click="emit('sync')">同步到工作流画布</NButton>
          <NButton size="tiny" type="primary" @click="openCreate">＋ 新建智能体</NButton>
        </div>
      </header>
      <div ref="canvas" class="agent-canvas" @click="selectedEdge = null">
        <div class="lane red"><span>RED TEAM · 授权验证</span></div>
        <div class="lane blue"><span>BLUE TEAM · 研判处置</span></div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="edge-layer">
          <defs><marker id="cyber-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          <g v-for="edge in edges" :key="edge.id" :class="{ selected: selectedEdge === edge.id }" @click.stop="selectedEdge = edge.id">
            <path :d="edgePath(edge)" class="edge-visible" marker-end="url(#cyber-arrow)" />
            <path :d="edgePath(edge)" class="edge-hit" />
          </g>
          <path v-if="connecting" :d="previewPath()" class="edge-preview" />
        </svg>
        <article
          v-for="agent in agents"
          :key="agent.id"
          class="agent-node"
          :class="[agent.group, { selected: selectedId === agent.id, dragging: dragging?.id === agent.id }]"
          :style="{ left: `${agent.position.x}%`, top: `${agent.position.y}%` }"
          @click.stop="emit('select', agent.id)"
          @pointerdown="beginDrag($event, agent.id)"
          @pointermove="moveDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
        >
          <button class="port input" type="button" :data-agent-input="agent.id" aria-label="输入端口" />
          <span class="drag-mark">⠿</span>
          <span class="agent-icon">{{ agent.icon }}</span>
          <span class="agent-copy"><b>{{ agent.name }}</b><small><i :class="statuses[agent.id] || 'idle'" />{{ statusLabel(statuses[agent.id] || 'idle') }}</small></span>
          <span class="node-actions"><button type="button" @click.stop="openEdit(agent)">✎</button><button type="button" @click.stop="emit('run', agent)">▶</button></span>
          <button class="port output" type="button" aria-label="输出端口" @pointerdown="beginConnect($event, agent.id)" @pointermove="moveConnect" @pointerup="finishConnect" @pointercancel="connecting = null" />
        </article>
      </div>
      <footer class="canvas-legend"><span><i class="red" />红队智能体</span><span><i class="blue" />蓝队智能体</span><span>拖动节点调整位置 · 从右侧端口拖到另一节点左侧端口建立连接</span></footer>
    </section>

    <aside v-if="selected" class="studio-panel agent-inspector">
      <header class="panel-heading"><div><small>SELECTED AGENT</small><h2>智能体详情</h2></div><NButton size="tiny" @click="openEdit(selected)">编辑</NButton></header>
      <div class="agent-profile"><span :class="selected.group">{{ selected.icon }}</span><div><h3>{{ selected.name }}</h3><p>{{ selected.role }}</p></div></div>
      <p class="agent-description">{{ selected.description }}</p>
      <section><small>SYSTEM PROMPT</small><p>{{ selected.systemPrompt }}</p></section>
      <section><small>WORKFLOW</small><ol><li v-for="(step, index) in selected.steps" :key="step"><span>{{ index + 1 }}</span>{{ step }}</li></ol></section>
      <NButton type="primary" block :loading="statuses[selected.id] === 'running'" @click="emit('run', selected)">▶ 运行此智能体</NButton>
      <div class="result-box"><small>最近真实结果</small><p>{{ results[selected.id] || '尚未运行。运行后会调用安全智能体并写入独立会话。' }}</p></div>
    </aside>

    <NModal v-model:show="editVisible" preset="card" class="agent-editor" :title="isCreating ? '新建智能体' : '编辑智能体'">
      <div class="editor-grid">
        <label><span>名称</span><NInput v-model:value="draft.name" /></label>
        <label><span>队伍</span><NSelect v-model:value="draft.group" :options="[{ label: '红队', value: 'red' }, { label: '蓝队', value: 'blue' }]" /></label>
        <label><span>图标</span><NInput v-model:value="draft.icon" maxlength="2" /></label>
        <label><span>职责</span><NInput v-model:value="draft.role" /></label>
        <label class="full"><span>说明</span><NInput v-model:value="draft.description" type="textarea" :rows="2" /></label>
        <label class="full"><span>System Prompt</span><NInput v-model:value="draft.systemPrompt" type="textarea" :rows="4" /></label>
        <label class="full"><span>执行步骤（每行一项）</span><NInput :value="draft.steps.join('\n')" type="textarea" :rows="5" @update:value="draft.steps = $event.split('\n')" /></label>
      </div>
      <template #footer><div class="editor-actions"><NButton @click="editVisible = false">取消</NButton><NButton type="primary" :disabled="!draft.name.trim()" @click="saveDraft">保存</NButton></div></template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agent-studio-layout { display: grid; grid-template-columns: minmax(680px, 1fr) 330px; gap: 14px; height: 100%; min-height: 660px; }
.studio-panel { border: 1px solid #20364a; border-radius: 10px; background: #091522; color: #d6e4ef; overflow: hidden; }
.panel-heading { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #20364a; }
.panel-heading small, .agent-inspector section > small { color: #4f91a5; font-size: 9px; letter-spacing: .12em; }
.panel-heading h2 { margin: 3px 0 0; font-size: 15px; }
.canvas-actions { display: flex; align-items: center; gap: 7px; }
.canvas-actions > span { color: #6f879a; font-size: 9px; }
.agent-canvas { position: relative; height: calc(100% - 100px); min-height: 560px; overflow: hidden; background-color: #07121d; background-image: linear-gradient(rgba(43,78,104,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(43,78,104,.12) 1px, transparent 1px); background-size: 24px 24px; }
.lane { position: absolute; left: 2%; right: 2%; height: 39%; border: 1px dashed rgba(255,255,255,.08); border-radius: 12px; pointer-events: none; }
.lane.red { top: 4%; background: rgba(225,73,91,.025); }
.lane.blue { bottom: 4%; background: rgba(40,180,221,.025); }
.lane span { position: absolute; left: 12px; top: 9px; color: #4f6476; font-size: 8px; letter-spacing: .12em; }
.edge-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.edge-layer g { pointer-events: stroke; cursor: pointer; }
.edge-visible { fill: none; stroke: #31506a; stroke-width: .32; vector-effect: non-scaling-stroke; }
.edge-hit { fill: none; stroke: transparent; stroke-width: 8; vector-effect: non-scaling-stroke; }
.edge-layer g.selected .edge-visible { stroke: #ef6071; stroke-width: .55; }
.edge-preview { fill: none; stroke: #3bd3e5; stroke-width: .4; stroke-dasharray: 2 1; vector-effect: non-scaling-stroke; }
.agent-node { position: absolute; z-index: 2; width: 142px; min-height: 54px; display: grid; grid-template-columns: 14px 30px 1fr auto; align-items: center; gap: 6px; transform: translate(-50%, -50%); padding: 7px 8px; border: 1px solid #294259; border-radius: 8px; background: #0d2030; box-shadow: 0 8px 18px rgba(0,0,0,.24); user-select: none; touch-action: none; cursor: grab; }
.agent-node.blue { border-color: #23516a; }
.agent-node.selected { border-color: #52c9dc; box-shadow: 0 0 0 2px rgba(82,201,220,.12), 0 8px 18px rgba(0,0,0,.3); }
.agent-node.dragging { cursor: grabbing; }
.drag-mark { color: #486075; font-size: 13px; }
.agent-icon { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; color: #f37b89; background: rgba(225,73,91,.1); font: 10px $font-code; }
.agent-node.blue .agent-icon { color: #4ecfe2; background: rgba(40,180,221,.1); }
.agent-copy { min-width: 0; }
.agent-copy b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }
.agent-copy small { display: flex; align-items: center; gap: 4px; margin-top: 4px; color: #70879b; font-size: 7px; }
.agent-copy i { width: 5px; height: 5px; border-radius: 50%; background: #52697a; }
.agent-copy i.running { background: #f2bb55; box-shadow: 0 0 6px #f2bb55; }
.agent-copy i.completed { background: #4bcd8b; }
.agent-copy i.failed { background: #ef6071; }
.node-actions { display: flex; gap: 2px; }
.node-actions button { width: 20px; height: 20px; border: 0; border-radius: 4px; color: #7290a7; background: transparent; cursor: pointer; }
.node-actions button:hover { color: #fff; background: #1a3549; }
.port { position: absolute; z-index: 3; width: 10px; height: 10px; border: 2px solid #07121d; border-radius: 50%; background: #4a778f; cursor: crosshair; }
.port.input { left: -6px; top: 50%; transform: translateY(-50%); }
.port.output { right: -6px; top: 50%; transform: translateY(-50%); background: #43c8dc; }
.canvas-legend { height: 36px; display: flex; align-items: center; gap: 14px; padding: 0 14px; color: #60778a; font-size: 8px; border-top: 1px solid #20364a; }
.canvas-legend i { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: #ef6071; }
.canvas-legend i.blue { background: #43c8dc; }
.agent-inspector { padding-bottom: 14px; overflow: auto; }
.agent-profile { display: flex; align-items: center; gap: 12px; padding: 16px; }
.agent-profile > span { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 10px; color: #ef7180; background: rgba(225,73,91,.12); font: 14px $font-code; }
.agent-profile > span.blue { color: #4ecfe2; background: rgba(40,180,221,.12); }
.agent-profile h3 { margin: 0; font-size: 15px; }
.agent-profile p, .agent-description { margin: 4px 0 0; color: #748b9e; font-size: 10px; line-height: 1.5; }
.agent-description { padding: 0 16px 12px; }
.agent-inspector section { margin: 0 14px 12px; padding: 11px; border: 1px solid #1d3346; border-radius: 7px; background: #0a1926; }
.agent-inspector section p { margin: 7px 0 0; color: #9db0bf; font-size: 10px; line-height: 1.55; white-space: pre-wrap; }
.agent-inspector ol { display: grid; gap: 7px; padding: 0; margin: 8px 0 0; list-style: none; }
.agent-inspector li { display: flex; align-items: flex-start; gap: 7px; color: #9db0bf; font-size: 9px; line-height: 1.4; }
.agent-inspector li span { flex: 0 0 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; color: #4ecfe2; background: #112b3d; font-size: 7px; }
.agent-inspector > :deep(.n-button), .result-box { margin: 0 14px 12px; width: calc(100% - 28px); }
.result-box { padding: 10px; border: 1px solid #1d3346; border-radius: 7px; background: #07131e; }
.result-box small { color: #4bcd8b; font-size: 8px; }
.result-box p { max-height: 120px; margin: 6px 0 0; overflow: auto; color: #9db0bf; font-size: 9px; line-height: 1.5; white-space: pre-wrap; }
:deep(.agent-editor) { width: min(720px, calc(100vw - 32px)); }
.editor-grid { display: grid; grid-template-columns: 110px 1fr; gap: 14px; }
.editor-grid label > span { display: block; margin-bottom: 6px; color: $text-secondary; font-size: 11px; }
.editor-grid .full { grid-column: 1 / -1; }
.editor-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 1150px) { .agent-studio-layout { grid-template-columns: 1fr; height: auto; } .agent-inspector { min-height: 540px; } }
</style>
