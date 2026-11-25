import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force'
import {
  Check,
  Crosshair,
  Maximize,
  PanelRight,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  X
} from 'lucide-react'
import type { SakerBrainState } from '../../../../shared/saker-brain'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import {
  getSakerGraphLabel,
  getSakerGraphNodeRadius,
  hitTestSakerGraphNode
} from './saker-graph-hit-test'
import { SakerGraphInspector } from './SakerGraphInspector'
import type {
  SakerGraphKind as Kind,
  SakerGraphNode as GraphNode,
  SakerGraphEdge as GraphEdge
} from './saker-graph-types'
import { buildSakerFileGraph } from './saker-file-graph'
type Point = { x: number; y: number }
type SimNode = GraphNode & SimulationNodeDatum & { degree: number; pinned: boolean }
type SimEdge = SimulationLinkDatum<SimNode> & { kind?: GraphEdge['kind'] }
type Settings = {
  sections: boolean
  references: boolean
  showOrphans: boolean
  center: number
  repel: number
  link: number
  distance: number
  nodeSize: number
  thickness: number
  labelThreshold: number
  arrows: boolean
}
type Gesture = { kind: 'node' | 'pan'; node?: SimNode; start: Point; origin: Point; moved: boolean }
type Menu = { x: number; y: number; id: string }
const SETTINGS_KEY = 'saker.graph.force.settings.v1'
const POSITIONS_KEY = 'saker.graph.force.positions.v2'
const markdown = unified().use(remarkParse)
const DEFAULTS: Settings = {
  sections: true,
  references: true,
  showOrphans: true,
  center: 0.055,
  repel: 280,
  link: 0.42,
  distance: 125,
  nodeSize: 1,
  thickness: 0.85,
  labelThreshold: 0.82,
  arrows: false
}
const COLORS: Record<Kind, string> = {
  global: '--saker-graph-global',
  project: '--saker-graph-project',
  section: '--saker-graph-section',
  topic: '--saker-graph-topic',
  file: '--saker-graph-file',
  directory: '--saker-graph-directory'
}
function safeRead<T>(key: string, fallback: T): T {
  try {
    const val = window.localStorage.getItem(key)
    return val ? (JSON.parse(val) as T) : fallback
  } catch {
    return fallback
  }
}
function safeWrite(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode */
  }
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function labelKey(text: string): string {
  return text.trim().replace(/\.md$/i, '').toLocaleLowerCase()
}
/**
 * Saker's graph adapts Obsidian's note/link semantics to our Brain geral and
 * one Markdown brain per project. Project sections are optional extra nodes.
 * No source code or assets from Obsidian are used.
 */
export function buildSakerGraph(brain: SakerBrainState): {
  nodes: GraphNode[]
  edges: GraphEdge[]
} {
  const nodes: GraphNode[] = [{ id: 'global', label: 'Brain geral', kind: 'global' }]
  const edges: GraphEdge[] = []
  const projects = brain.projects.filter((p) => p.enabled && p.initialized !== false)
  for (const p of projects) {
    nodes.push({ id: p.id, label: p.name, kind: 'project', projectId: p.id, details: p.summary })
  }
  const known = new Map<string, string | null>()
  const sections = new Map<string, string>()
  const extra = new Map<string, string>()
  const links = new Map<string, Set<string>>()
  const notes = [
    { id: 'global', content: brain.global, projectId: undefined },
    ...projects.map((p) => ({ id: p.id, content: p.content, projectId: p.id }))
  ].map((note) => ({ ...note, tree: markdown.parse(note.content) }))
  function register(label: string, id: string): void {
    const key = labelKey(label)
    if (!known.has(key)) {
      known.set(key, id)
    } else if (known.get(key) !== id) {
      known.set(key, null)
    }
  }
  function link(a: string, b: string): void {
    if (a === b || links.get(a)?.has(b)) {
      return
    }
    const targets = links.get(a) ?? new Set<string>()
    targets.add(b)
    links.set(a, targets)
    edges.push({ a, b })
  }
  for (const node of nodes) {
    register(node.label, node.id)
  }
  for (const note of notes) {
    if (note.projectId) {
      link('global', note.id)
    }
    for (const heading of note.tree.children
      .filter((node) => node.type === 'heading' && [2, 3].includes(node.depth))
      .slice(0, 12)) {
      const fragments: string[] = []
      visit(heading, (node) => {
        if (node.type === 'text' || node.type === 'inlineCode') {
          fragments.push(node.value)
        }
      })
      const label = fragments.join('').trim().slice(0, 64)
      if (!label) {
        continue
      }
      const id = `section:${note.id}:${labelKey(label)}`
      if (sections.has(id)) {
        continue
      }
      sections.set(id, id)
      nodes.push({ id, label, kind: 'section', projectId: note.projectId })
      register(label, id)
      link(note.id, id)
    }
  }
  for (const note of notes) {
    visit(note.tree, 'text', ({ value }) => {
      const references = [
        ...Array.from(value.matchAll(/\[\[([^\]\n|]+)(?:\|[^\]]+)?\]\]/g), (match) => match[1]),
        ...Array.from(value.matchAll(/(?:^|[\s(])#([a-zA-Z][\w/-]+)/g), (match) => `#${match[1]}`)
      ]
      for (const raw of references) {
        const label = raw.trim().slice(0, 64)
        if (!label) {
          continue
        }
        const key = labelKey(label)
        const [owner, anchor] = key.split('#', 2)
        const ownerId = owner ? known.get(labelKey(owner)) : note.id
        let id =
          (anchor && ownerId
            ? sections.get(`section:${ownerId}:${labelKey(anchor)}`)
            : undefined) ??
          sections.get(`section:${note.id}:${key}`) ??
          known.get(key) ??
          extra.get(key)
        if (!id && extra.size < 160) {
          id = `topic:${key}`
          nodes.push({ id, label, kind: 'topic', details: 'Unresolved reference' })
          extra.set(key, id)
        }
        if (id) {
          link(note.id, id)
        }
      }
    })
  }
  for (const project of projects) {
    const files = buildSakerFileGraph(project)
    nodes.push(...files.nodes)
    edges.push(...files.edges)
  }
  return { nodes, edges }
}
export function buildLocalGraph(
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  focus: string,
  depth: number
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const connected = new Set<string>([focus])
  for (let step = 0; step < depth; step++) {
    const next = new Set(connected)
    for (const e of graph.edges) {
      if (connected.has(e.a)) {
        next.add(e.b)
      }
      if (connected.has(e.b)) {
        next.add(e.a)
      }
    }
    for (const n of next) {
      connected.add(n)
    }
  }
  return {
    nodes: graph.nodes.filter((n) => connected.has(n.id)),
    edges: graph.edges.filter((e) => connected.has(e.a) && connected.has(e.b))
  }
}
function randomSeed(index: number): Point {
  const angle = index * 2.399963229728653
  const radius = 32 * Math.sqrt(index + 1)
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}
function colorAlpha(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${(clamp(opacity, 0, 1) * 100).toFixed(2)}%, transparent)`
}
export function SakerBrainGraph({
  brain,
  onOpenNote,
  onRefreshFiles,
  busy = false
}: {
  brain: SakerBrainState
  onOpenNote: (id: string) => void
  onRefreshFiles?: (id: string) => void
  busy?: boolean
}): React.JSX.Element {
  const [projectScope, setProjectScope] = useState('')
  const [contentMode, setContentMode] = useState<'files' | 'notes' | 'all'>('files')
  const allGraph = useMemo(() => {
    const graph = buildSakerGraph(brain)
    if (!projectScope) {
      return graph
    }
    const owned = new Set(
      graph.nodes.filter((node) => node.projectId === projectScope).map((node) => node.id)
    )
    const topics = new Set(
      graph.nodes.filter((node) => node.kind === 'topic').map((node) => node.id)
    )
    const included = new Set(owned)
    for (const edge of graph.edges) {
      if (owned.has(edge.a) && topics.has(edge.b)) {
        included.add(edge.b)
      }
      if (owned.has(edge.b) && topics.has(edge.a)) {
        included.add(edge.a)
      }
    }
    return {
      nodes: graph.nodes.filter((node) => included.has(node.id)),
      edges: graph.edges.filter((edge) => included.has(edge.a) && included.has(edge.b))
    }
  }, [brain, projectScope])
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...safeRead<Partial<Settings>>(SETTINGS_KEY, {})
  }))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionsOpen, setConnectionsOpen] = useState(() => window.innerWidth > 720)
  const [query, setQuery] = useState('')
  const [localFocus, setLocalFocus] = useState<string | null>(null)
  const local = localFocus !== null
  const [depth, setProfundidade] = useState(2)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [zoomLabel, setZoomLabel] = useState(100)
  const [isSimulating, setIsSimulating] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 720, height: 460 })
  const filtered = useMemo(() => {
    const queryText = query.trim().toLocaleLowerCase()
    const nodes = allGraph.nodes.filter(
      (n) =>
        (contentMode === 'all' ||
          (contentMode === 'files'
            ? ['global', 'project', 'file', 'directory'].includes(n.kind)
            : !['file', 'directory'].includes(n.kind))) &&
        (settings.sections || n.kind !== 'section') &&
        (settings.references || n.kind !== 'topic') &&
        (!queryText ||
          n.id === localFocus ||
          n.label.toLocaleLowerCase().includes(queryText) ||
          n.details?.toLocaleLowerCase().includes(queryText))
    )
    const ids = new Set(nodes.map((n) => n.id))
    const edges = allGraph.edges.filter((e) => ids.has(e.a) && ids.has(e.b))
    const degree = new Map<string, number>()
    for (const edge of edges) {
      degree.set(edge.a, (degree.get(edge.a) || 0) + 1)
      degree.set(edge.b, (degree.get(edge.b) || 0) + 1)
    }
    const included = settings.showOrphans ? nodes : nodes.filter((n) => degree.has(n.id))
    const graph = { nodes: included, edges }
    return localFocus ? buildLocalGraph(graph, localFocus, depth) : graph
  }, [
    allGraph,
    contentMode,
    settings.sections,
    settings.references,
    settings.showOrphans,
    query,
    localFocus,
    depth
  ])
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simulationRef = useRef<Simulation<SimNode, undefined> | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const simEdgesRef = useRef<SimEdge[]>([])
  const cameraRef = useRef({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<Gesture | null>(null)
  const frameRef = useRef<number | null>(null)
  const renderRef = useRef<() => void>(() => {})
  const settingsRef = useRef(settings)
  const hoveredRef = useRef(hovered)
  const selectedRef = useRef(selected)
  const lastPointerRef = useRef<Point>({ x: 0, y: 0 })
  const pinsRef = useRef<Record<string, Point>>({})
  const positionsRef = useRef<Record<string, Point>>({})
  const requestDraw = useCallback((): void => {
    if (frameRef.current !== null) {
      return
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      renderRef.current()
    })
  }, [])
  useEffect(() => {
    const observer = new MutationObserver(requestDraw)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    })
    return () => observer.disconnect()
  }, [requestDraw])
  useEffect(() => {
    settingsRef.current = settings
    safeWrite(SETTINGS_KEY, settings)
    requestDraw()
  }, [settings, requestDraw])
  useEffect(() => {
    hoveredRef.current = hovered
    requestDraw()
  }, [hovered, requestDraw])
  useEffect(() => {
    selectedRef.current = selected
    requestDraw()
  }, [selected, requestDraw])
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) {
      return
    }
    const resize = (): void => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      setCanvasSize({ width, height })
      requestDraw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()
    return () => observer.disconnect()
  }, [requestDraw])
  const positionsKey = `${POSITIONS_KEY}.${projectScope || 'all'}${localFocus ? '.local' : ''}`
  const persist = useCallback((): void => {
    const stored: Record<string, Point> = { ...positionsRef.current }
    for (const node of simNodesRef.current) {
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        stored[node.id] = { x: node.x!, y: node.y! }
      }
    }
    positionsRef.current = stored
    safeWrite(positionsKey, { nodes: stored, pins: pinsRef.current })
  }, [positionsKey])
  const updateForceSettings = useCallback(
    (sim: Simulation<SimNode, undefined>, s: Settings): void => {
      sim.force(
        'charge',
        forceManyBody<SimNode>().strength(-s.repel).distanceMin(12).distanceMax(680)
      )
      sim.force(
        'link',
        forceLink<SimNode, SimEdge>(simEdgesRef.current)
          .id((n) => n.id)
          .distance(s.distance)
          .strength(s.link)
      )
      sim.force(
        'collision',
        forceCollide<SimNode>()
          .radius((n) => getSakerGraphNodeRadius(n, s.nodeSize) + 8)
          .iterations(2)
      )
      sim.force('x', forceX<SimNode>(0).strength(s.center))
      sim.force('y', forceY<SimNode>(0).strength(s.center))
    },
    []
  )
  useEffect(() => {
    const saved = safeRead<{ nodes: Record<string, Point>; pins: Record<string, Point> }>(
      positionsKey,
      { nodes: {}, pins: {} }
    )
    positionsRef.current = saved?.nodes || {}
    pinsRef.current = saved?.pins || {}
    const degrees = new Map<string, number>()
    for (const edge of filtered.edges) {
      degrees.set(edge.a, (degrees.get(edge.a) || 0) + 1)
      degrees.set(edge.b, (degrees.get(edge.b) || 0) + 1)
    }
    const nodes: SimNode[] = filtered.nodes.map((n, i) => {
      const candidate = positionsRef.current[n.id]
      const p =
        candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
          ? candidate
          : randomSeed(i)
      const candidatePin = pinsRef.current[n.id]
      const pin =
        candidatePin && Number.isFinite(candidatePin.x) && Number.isFinite(candidatePin.y)
          ? candidatePin
          : undefined
      return {
        ...n,
        x: p.x,
        y: p.y,
        degree: degrees.get(n.id) || 0,
        pinned: !!pin,
        ...(pin ? { fx: pin.x, fy: pin.y } : {})
      }
    })
    const edges: SimEdge[] = filtered.edges.map((e) => ({ source: e.a, target: e.b, kind: e.kind }))
    simNodesRef.current = nodes
    simEdgesRef.current = edges
    const sim = forceSimulation<SimNode>(nodes).velocityDecay(0.42).alphaDecay(0.105)
    simulationRef.current = sim
    updateForceSettings(sim, settingsRef.current)
    // Precompute the initial layout before the first paint rather than making
    // users watch a multi-second settling animation.
    sim.stop()
    const warmup = nodes.every((node) => positionsRef.current[node.id])
      ? 0
      : nodes.length <= 60
        ? 45
        : nodes.length <= 180
          ? 20
          : 6
    for (let i = 0; i < warmup; i++) {
      sim.tick()
    }
    setIsSimulating(true)
    sim.on('tick', requestDraw).on('end', () => {
      setIsSimulating(false)
      persist()
      requestDraw()
    })
    sim.alpha(nodes.length <= 60 ? 0.12 : 0.28).restart()
    requestDraw()
    return () => {
      sim.stop()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      persist()
      if (simulationRef.current === sim) {
        simulationRef.current = null
      }
    }
  }, [filtered, positionsKey, requestDraw, persist, updateForceSettings])
  const physicsMounted = useRef(false)
  useEffect(() => {
    if (!physicsMounted.current) {
      physicsMounted.current = true
      return
    }
    const sim = simulationRef.current
    if (!sim) {
      return
    }
    updateForceSettings(sim, settingsRef.current)
    sim.alpha(0.35).restart()
    setIsSimulating(true)
    requestDraw()
    // Only changes to physics should reheat the layout.
  }, [
    settings.center,
    settings.repel,
    settings.link,
    settings.distance,
    settings.nodeSize,
    updateForceSettings,
    requestDraw
  ])
  useEffect(() => {
    renderRef.current = () => {
      const canvas = canvasRef.current
      const stage = stageRef.current
      if (!canvas || !stage) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      const w = canvas.clientWidth,
        h = canvas.clientHeight
      if (w <= 0 || h <= 0) {
        return
      }
      const dpr = canvas.width / w
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const cam = cameraRef.current
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y)
      ctx.scale(cam.k, cam.k)
      const nodes = simNodesRef.current,
        edges = simEdgesRef.current
      const palette = getComputedStyle(canvas)
      const colors = Object.fromEntries(
        Object.entries(COLORS).map(([kind, token]) => [
          kind,
          palette.getPropertyValue(token).trim()
        ])
      ) as Record<Kind, string>
      const foreground = palette.getPropertyValue('--foreground').trim()
      const muted = palette.getPropertyValue('--muted-foreground').trim()
      const s = settingsRef.current
      const highlight = hoveredRef.current || selectedRef.current
      const connected = new Set<string>()
      if (highlight) {
        connected.add(highlight)
        for (const e of edges) {
          const a = e.source as SimNode,
            b = e.target as SimNode
          if (a.id === highlight) {
            connected.add(b.id)
          }
          if (b.id === highlight) {
            connected.add(a.id)
          }
        }
      }
      const left = (-w / 2 - cam.x) / cam.k
      const right = (w / 2 - cam.x) / cam.k
      const top = (-h / 2 - cam.y) / cam.k
      const bottom = (h / 2 - cam.y) / cam.k
      const onScreen = (node: SimNode, margin: number): boolean =>
        node.x! >= left - margin &&
        node.x! <= right + margin &&
        node.y! >= top - margin &&
        node.y! <= bottom + margin
      ctx.lineWidth = s.thickness / Math.sqrt(cam.k)
      for (const e of edges) {
        const a = e.source as SimNode,
          b = e.target as SimNode
        if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) {
          continue
        }
        if (
          (a.x! < left && b.x! < left) ||
          (a.x! > right && b.x! > right) ||
          (a.y! < top && b.y! < top) ||
          (a.y! > bottom && b.y! > bottom)
        ) {
          continue
        }
        const active = !highlight || a.id === highlight || b.id === highlight
        ctx.lineWidth = (s.thickness * (e.kind === 'import' ? 1.6 : 0.8)) / Math.sqrt(cam.k)
        ctx.strokeStyle = colorAlpha(
          e.kind === 'import' ? colors.file : muted,
          active ? (highlight ? 0.7 : e.kind === 'import' ? 0.6 : 0.3) : 0.08
        )
        ctx.beginPath()
        ctx.moveTo(a.x!, a.y!)
        ctx.lineTo(b.x!, b.y!)
        ctx.stroke()
        if (s.arrows) {
          const dx = b.x! - a.x!,
            dy = b.y! - a.y!
          const length = Math.hypot(dx, dy) || 1
          const distance = length - getSakerGraphNodeRadius(b, s.nodeSize) - 4
          const x = a.x! + (dx * distance) / length,
            y = a.y! + (dy * distance) / length
          const angle = Math.atan2(dy, dx)
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle)
          ctx.fillStyle = colorAlpha(muted, active ? 0.75 : 0.3)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(-7, -3)
          ctx.lineTo(-7, 3)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      for (const node of nodes) {
        const active = !highlight || connected.has(node.id)
        const isFocus = node.id === highlight
        const r = getSakerGraphNodeRadius(node, s.nodeSize)
        if (!onScreen(node, r + 6)) {
          continue
        }
        ctx.fillStyle = colorAlpha(colors[node.kind], active ? (isFocus ? 1 : 0.88) : 0.14)
        ctx.beginPath()
        ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2)
        ctx.fill()
        if (isFocus || node.pinned) {
          ctx.strokeStyle = colorAlpha(colors[node.kind], isFocus ? 0.92 : 0.36)
          ctx.lineWidth = (isFocus ? 1.5 : 0.8) / cam.k
          ctx.beginPath()
          ctx.arc(node.x!, node.y!, r + (isFocus ? 4 : 2.5), 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      for (const node of nodes) {
        const isFocus = node.id === highlight
        const active = !highlight || connected.has(node.id)
        if (!onScreen(node, 140 / cam.k)) {
          continue
        }
        const label = getSakerGraphLabel(node, cam.k, s.labelThreshold, nodes.length, highlight)
        if (!label) {
          continue
        }
        ctx.font = label.font
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = colorAlpha(isFocus ? foreground : muted, active ? 1 : 0.25)
        ctx.fillText(
          label.text,
          node.x!,
          node.y! + getSakerGraphNodeRadius(node, s.nodeSize) + 6 / cam.k
        )
      }
    }
    requestDraw()
  })
  const canvasPoint = useCallback((x: number, y: number): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((x - rect.left) * canvas.clientWidth) / rect.width,
      y: ((y - rect.top) * canvas.clientHeight) / rect.height
    }
  }, [])
  const hitTest = useCallback(
    (x: number, y: number): SimNode | null => {
      const canvas = canvasRef.current
      if (!canvas) {
        return null
      }
      return hitTestSakerGraphNode(
        simNodesRef.current,
        canvasPoint(x, y),
        { left: 0, top: 0, width: canvas.clientWidth, height: canvas.clientHeight },
        cameraRef.current,
        {
          ...settingsRef.current,
          focusedId: hoveredRef.current || selectedRef.current,
          measureLabel: (text, font) => {
            const context = canvasRef.current?.getContext('2d')
            if (!context) {
              return null
            }
            context.font = font
            return context.measureText(text).width
          }
        }
      )
    },
    [canvasPoint]
  )
  const zoom = useCallback(
    (factor: number, x?: number, y?: number): void => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }
      const camera = cameraRef.current
      const point =
        x === undefined || y === undefined
          ? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }
          : canvasPoint(x, y)
      const focusX = point.x - canvas.clientWidth / 2
      const focusY = point.y - canvas.clientHeight / 2
      const next = clamp(camera.k * factor, 0.2, 5)
      const ratio = next / camera.k
      camera.x = focusX - (focusX - camera.x) * ratio
      camera.y = focusY - (focusY - camera.y) * ratio
      camera.k = next
      setZoomLabel(Math.round(next * 100))
      requestDraw()
    },
    [requestDraw, canvasPoint]
  )
  const fit = useCallback((): void => {
    const nodes = simNodesRef.current
    const canvas = canvasRef.current
    if (!nodes.length || !canvas) {
      return
    }
    const xs = nodes.map((n) => n.x || 0),
      ys = nodes.map((n) => n.y || 0)
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys)
    const k = clamp(
      Math.min(canvas.clientWidth / (maxX - minX + 145), canvas.clientHeight / (maxY - minY + 130)),
      0.4,
      2.6
    )
    cameraRef.current = { x: (-(minX + maxX) / 2) * k, y: (-(minY + maxY) / 2) * k, k }
    setZoomLabel(Math.round(k * 100))
    requestDraw()
  }, [requestDraw])
  const unpin = (id: string): void => {
    const n = simNodesRef.current.find((x) => x.id === id)
    if (!n) {
      return
    }
    delete pinsRef.current[id]
    n.fx = null
    n.fy = null
    n.pinned = false
    simulationRef.current?.alpha(0.45).restart()
    persist()
    requestDraw()
  }
  const pin = (id: string): void => {
    const n = simNodesRef.current.find((x) => x.id === id)
    if (!n) {
      return
    }
    n.pinned = true
    n.fx = n.x
    n.fy = n.y
    pinsRef.current[id] = { x: n.x!, y: n.y! }
    persist()
    requestDraw()
  }
  const settingsChange = <K extends keyof Settings>(name: K, value: Settings[K]): void =>
    setSettings((s) => ({ ...s, [name]: value }))
  const cancelDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    if (drag?.node && drag.moved) {
      drag.node.x = drag.origin.x
      drag.node.y = drag.origin.y
      drag.node.fx = drag.node.pinned ? drag.origin.x : null
      drag.node.fy = drag.node.pinned ? drag.origin.y : null
      requestDraw()
    }
    dragRef.current = null
    setIsInteracting(false)
    setHovered(null)
    simulationRef.current?.alphaTarget(0)
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId)
    }
  }
  const focused = simNodesRef.current.find((n) => n.id === hovered && n.id !== selected)
  const selectedNode = simNodesRef.current.find((n) => n.id === selected)
  const reset = (): void => {
    setSettings(DEFAULTS)
    safeWrite(SETTINGS_KEY, DEFAULTS)
    setLocalFocus(null)
    setQuery('')
    setSelected(null)
    pinsRef.current = {}
    positionsRef.current = {}
    try {
      localStorage.removeItem(positionsKey)
    } catch {
      /* optional */
    }
    const nodes = simNodesRef.current
    nodes.forEach((n, i) => {
      const p = randomSeed(i)
      n.x = p.x
      n.y = p.y
      n.fx = null
      n.fy = null
      n.vx = 0
      n.vy = 0
      n.pinned = false
    })
    simulationRef.current?.alpha(1).restart()
    cameraRef.current = { x: 0, y: 0, k: 1 }
    setZoomLabel(100)
    requestDraw()
  }
  return (
    <div className="saker-graph-obsidian flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        <select
          aria-label="Projeto do Brain"
          value={projectScope}
          onChange={(event) => {
            setProjectScope(event.target.value)
            setSelected(null)
            setHovered(null)
            setLocalFocus(null)
            setMenu(null)
          }}
          className="h-8 max-w-52 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        >
          <option value="">Geral · todos os projetos</option>
          {brain.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Conteúdo do grafo"
          value={contentMode}
          onChange={(event) => {
            setContentMode(event.target.value as typeof contentMode)
            setLocalFocus(null)
            setSelected(null)
            setHovered(null)
          }}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        >
          <option value="files">Arquivos</option>
          <option value="notes">Memória</option>
          <option value="all">Tudo</option>
        </select>
        {onRefreshFiles && (
          <button
            type="button"
            disabled={busy || !projectScope}
            onClick={() => onRefreshFiles(projectScope)}
            className="h-8 rounded-md border border-border px-2 text-xs disabled:opacity-50"
            title={
              projectScope
                ? 'Atualizar arquivos e importações'
                : 'Selecione um projeto para atualizar os arquivos'
            }
          >
            {busy ? 'Atualizando…' : 'Atualizar arquivos'}
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/80 bg-card px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            aria-label="Buscar no Brain"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no Brain..."
            className="h-8 min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} title="Limpar busca">
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center rounded-md border border-border/70 bg-card p-[2px]">
          <button
            type="button"
            aria-pressed={!local}
            onClick={() => setLocalFocus(null)}
            className={`saker-graph-view-button ${!local ? 'active' : ''}`}
          >
            Completo
          </button>
          <button
            type="button"
            aria-pressed={local}
            onClick={() => setLocalFocus(selected || projectScope || 'global')}
            className={`saker-graph-view-button ${local ? 'active' : ''}`}
          >
            Vizinhança
          </button>
        </div>
        <button
          type="button"
          aria-label="Opções do gráfico"
          title="Opções do gráfico"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
          className={`saker-graph-icon-button ${settingsOpen ? 'active' : ''}`}
        >
          <Settings2 className="size-[15px]" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          aria-label="Conexões"
          title="Conexões"
          aria-pressed={connectionsOpen}
          className={`saker-graph-icon-button ${connectionsOpen ? 'active' : ''}`}
          onClick={() => setConnectionsOpen((value) => !value)}
        >
          <PanelRight className="size-[15px]" aria-hidden />
        </button>
      </div>
      <div
        className="flex flex-wrap gap-4 py-2 text-2xs text-muted-foreground"
        aria-label="Cores do gráfico"
      >
        {(
          [
            ['global', 'Geral'],
            ['project', 'Projeto'],
            ['section', 'Seção'],
            ['topic', 'Referência'],
            ['file', 'Arquivo'],
            ['directory', 'Pasta']
          ] as const
        ).map(([kind, label]) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: `var(${COLORS[kind]})` }} />
            {label}
          </span>
        ))}
      </div>
      {contentMode !== 'notes' && (
        <p className="pb-2 text-2xs text-muted-foreground">
          Linhas finas mostram a estrutura de pastas; linhas coloridas mostram importações
          resolvidas de JavaScript/TypeScript.{' '}
          {brain.projects.some(
            (project) =>
              project.enabled &&
              (!projectScope || project.id === projectScope) &&
              !project.fileGraph?.analyzed
          ) && 'Selecione o projeto e atualize os arquivos para analisar as importações.'}
          {brain.projects.some(
            (project) =>
              project.enabled &&
              (!projectScope || project.id === projectScope) &&
              project.fileGraph?.analyzed &&
              project.fileGraph.partial
          ) &&
            ' Algumas áreas não foram analisadas por limites de leitura ou sintaxe não suportada.'}
        </p>
      )}
      {local && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-2 py-2 text-[11px] text-muted-foreground">
          <span>
            Vizinhança:{' '}
            {allGraph.nodes.find((node) => node.id === localFocus)?.label || 'Brain geral'}
          </span>
          <label className="flex items-center gap-2">
            Profundidade
            <input
              type="range"
              min="1"
              max="4"
              value={depth}
              onChange={(e) => setProfundidade(Number(e.target.value))}
            />
            <span className="font-mono">{depth}</span>
          </label>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-2">
        <div
          ref={stageRef}
          className="saker-graph-surface relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-border/70"
          tabIndex={0}
          aria-label="Grafo interativo de conhecimento"
          onKeyDown={(e) => {
            const camera = cameraRef.current,
              step = e.shiftKey ? 100 : 35
            if (e.key === '+' || e.key === '=') {
              zoom(1.15)
              e.preventDefault()
            }
            if (e.key === '-') {
              zoom(1 / 1.15)
              e.preventDefault()
            }
            if (e.key === '0') {
              fit()
              e.preventDefault()
            }
            if (e.key === 'ArrowLeft') {
              camera.x += step
              e.preventDefault()
            }
            if (e.key === 'ArrowRight') {
              camera.x -= step
              e.preventDefault()
            }
            if (e.key === 'ArrowUp') {
              camera.y += step
              e.preventDefault()
            }
            if (e.key === 'ArrowDown') {
              camera.y -= step
              e.preventDefault()
            }
            requestDraw()
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as Element).closest('button,input,label')) {
              return
            }
            const point = canvasPoint(e.clientX, e.clientY)
            const node = hitTest(e.clientX, e.clientY)
            stageRef.current!.setPointerCapture(e.pointerId)
            lastPointerRef.current = point
            setMenu(null)
            setIsInteracting(true)
            setHovered(null)
            hoveredRef.current = null
            if (node) {
              dragRef.current = {
                kind: 'node',
                node,
                start: point,
                origin: { x: node.x!, y: node.y! },
                moved: false
              }
            } else {
              setSelected(null)
              setHovered(null)
              dragRef.current = {
                kind: 'pan',
                start: point,
                origin: { x: cameraRef.current.x, y: cameraRef.current.y },
                moved: false
              }
            }
          }}
          onPointerMove={(e) => {
            const point = canvasPoint(e.clientX, e.clientY)
            lastPointerRef.current = point
            const drag = dragRef.current
            if (!drag) {
              const n = hitTest(e.clientX, e.clientY)
              if ((n?.id || null) !== hoveredRef.current) {
                setHovered(n?.id || null)
              }
              stageRef.current!.style.cursor = n ? 'pointer' : 'grab'
              return
            }
            const dx = point.x - drag.start.x,
              dy = point.y - drag.start.y
            if (!drag.moved && Math.hypot(dx, dy) < 3) {
              return
            }
            if (!drag.moved && drag.node) {
              simulationRef.current?.alphaTarget(0.14).restart()
            }
            drag.moved = true
            if (drag.kind === 'node' && drag.node) {
              const world = {
                x: drag.origin.x + dx / cameraRef.current.k,
                y: drag.origin.y + dy / cameraRef.current.k
              }
              drag.node.fx = world.x
              drag.node.fy = world.y
              drag.node.x = world.x
              drag.node.y = world.y
            } else {
              cameraRef.current.x = drag.origin.x + dx
              cameraRef.current.y = drag.origin.y + dy
            }
            requestDraw()
          }}
          onPointerUp={(e) => {
            const drag = dragRef.current
            if (!drag) {
              return
            }
            if (drag.kind === 'node' && drag.node) {
              const n = drag.node
              if (!drag.moved) {
                setSelected(n.id)
              } else if (!n.pinned) {
                n.fx = null
                n.fy = null
              } else {
                pinsRef.current[n.id] = { x: n.x!, y: n.y! }
              }
              if (drag.moved) {
                simulationRef.current?.alphaTarget(0).alpha(0.2).restart()
                persist()
              }
            }
            dragRef.current = null
            setIsInteracting(false)
            setHovered(null)
            if (stageRef.current?.hasPointerCapture(e.pointerId)) {
              stageRef.current.releasePointerCapture(e.pointerId)
            }
            requestDraw()
          }}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onPointerLeave={() => {
            if (!dragRef.current) {
              setHovered(null)
            }
          }}
          onDoubleClick={(e) => {
            const n = hitTest(e.clientX, e.clientY)
            if (!n) {
              fit()
            } else if (n.kind === 'file' || n.kind === 'directory') {
              setSelected(n.id)
              setConnectionsOpen(true)
            } else if (n.kind !== 'topic') {
              onOpenNote(n.projectId || 'global')
            }
          }}
          onContextMenu={(e) => {
            const n = hitTest(e.clientX, e.clientY)
            if (!n) {
              return
            }
            e.preventDefault()
            const point = canvasPoint(e.clientX, e.clientY)
            const canvas = canvasRef.current!
            setSelected(n.id)
            setMenu({
              id: n.id,
              x: clamp(point.x, 8, canvas.clientWidth - 200),
              y: clamp(point.y, 8, canvas.clientHeight - 150)
            })
          }}
          onWheel={(e) => {
            e.preventDefault()
            zoom(Math.exp(-e.deltaY * 0.0014), e.clientX, e.clientY)
          }}
        >
          <canvas
            ref={canvasRef}
            aria-label={`Graph with ${filtered.nodes.length} nodes and ${
              filtered.edges.length
            } conexões`}
            data-saker-graph-nodes={filtered.nodes.length}
            data-saker-graph-edges={filtered.edges.length}
            className="absolute inset-0 block h-full w-full touch-none"
          />
          {focused && !isInteracting && (
            <div
              className="saker-graph-tooltip pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-border bg-card px-2.5 py-2 text-[11px]"
              style={{
                left: clamp(lastPointerRef.current.x + 16, 8, canvasSize.width - 235),
                top: clamp(lastPointerRef.current.y - 42, 8, canvasSize.height - 64)
              }}
            >
              <div className="font-semibold text-foreground">{focused.label}</div>
              {focused.filePath && (
                <div className="mt-1 break-all font-mono text-2xs text-muted-foreground">
                  {focused.filePath}
                </div>
              )}
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {
                  {
                    global: 'Geral',
                    project: 'Projeto',
                    section: 'Seção',
                    topic: 'Referência',
                    file: 'Arquivo',
                    directory: 'Pasta'
                  }[focused.kind]
                }{' '}
                · {focused.degree} conexões
              </div>
            </div>
          )}
          {menu && (
            <div
              role="menu"
              aria-label="Ações do nó"
              className="saker-graph-menu absolute z-30 w-[180px] rounded-md border border-border bg-card p-1 shadow-floating"
              style={{ left: menu.x, top: menu.y }}
            >
              <button
                role="menuitem"
                type="button"
                disabled={!selectedNode || selectedNode.kind === 'topic'}
                onClick={() => {
                  if (selectedNode?.filePath) {
                    setSelected(selectedNode.id)
                    setConnectionsOpen(true)
                  } else if (selectedNode && selectedNode.kind !== 'topic') {
                    onOpenNote(selectedNode.projectId || 'global')
                  }
                  setMenu(null)
                }}
              >
                {selectedNode?.filePath ? 'Ver arquivo e conexões' : 'Abrir nota do Brain'}
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setLocalFocus(menu.id)
                  setMenu(null)
                }}
              >
                Mostrar vizinhança
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  if (selectedNode?.pinned) {
                    unpin(menu.id)
                  } else {
                    pin(menu.id)
                  }
                  setMenu(null)
                }}
              >
                {selectedNode?.pinned ? 'Unpin position' : 'Pin position'}
              </button>
            </div>
          )}
          {settingsOpen && (
            <aside
              className="saker-graph-settings absolute right-2 top-2 z-20 max-h-[calc(100%-16px)] w-[235px] overflow-y-auto rounded-md border border-border bg-card p-3 shadow-floating"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between text-xs font-semibold">
                Controles do gráfico
                <button type="button" title="Fechar opções" onClick={() => setSettingsOpen(false)}>
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="saker-graph-setting-heading">Filtros</div>
              {(
                [
                  ['sections', 'Mostrar seções'],
                  ['references', 'Referências e tags'],
                  ['showOrphans', 'Nós sem conexão']
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="saker-graph-check">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => settingsChange(key, e.target.checked)}
                  />
                </label>
              ))}
              <div className="saker-graph-setting-heading">Exibição</div>
              <label className="saker-graph-check">
                <span>Setas de direção</span>
                <input
                  type="checkbox"
                  checked={settings.arrows}
                  onChange={(e) => settingsChange('arrows', e.target.checked)}
                />
              </label>
              {(
                [
                  ['nodeSize', 'Tamanho dos nós', 0.5, 2.4, 0.1],
                  ['thickness', 'Espessura das conexões', 0.3, 3, 0.1],
                  ['labelThreshold', 'Visibilidade dos rótulos', 0.2, 2, 0.05]
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="saker-graph-range" key={key}>
                  <span>{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[key]}
                    onChange={(e) => settingsChange(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <div className="saker-graph-setting-heading">Forças</div>
              {(
                [
                  ['center', 'Centralização', 0.005, 0.18, 0.005],
                  ['repel', 'Repulsão', 30, 850, 10],
                  ['link', 'Atração das conexões', 0.05, 0.95, 0.05],
                  ['distance', 'Distância das conexões', 30, 250, 5]
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="saker-graph-range" key={key}>
                  <span>{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[key]}
                    onChange={(e) => settingsChange(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={reset}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-[11px] text-foreground hover:bg-accent"
              >
                <RotateCcw className="size-3" /> Restaurar padrão
              </button>
            </aside>
          )}
          {!simNodesRef.current.length && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma nota corresponde aos filtros.
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-md border border-border/70 bg-card p-1">
            <button
              type="button"
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
              className="saker-graph-tool"
              onClick={() => zoom(1 / 1.2)}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-[36px] text-center font-mono text-[10px] text-muted-foreground">
              {zoomLabel}%
            </span>
            <button
              type="button"
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
              className="saker-graph-tool"
              onClick={() => zoom(1.2)}
            >
              <Plus className="size-3.5" />
            </button>
            <span className="mx-0.5 h-4 w-px bg-card" />
            <button
              type="button"
              title="Enquadrar gráfico"
              aria-label="Enquadrar gráfico"
              className="saker-graph-tool"
              onClick={fit}
            >
              <Maximize className="size-3.5" />
            </button>
            <button
              type="button"
              title="Reorganizar nós"
              aria-label="Reorganizar nós"
              className="saker-graph-tool"
              onClick={() => {
                simulationRef.current?.alpha(0.9).restart()
                setIsSimulating(true)
              }}
            >
              <Crosshair className="size-3.5" />
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            {isSimulating && <span className="size-1.5 animate-pulse rounded-full bg-card" />}
            <span>{filtered.nodes.length} nós</span>
            <span className="text-muted-foreground">·</span>
            <span>{filtered.edges.length} conexões</span>
          </div>
        </div>
        {connectionsOpen && (
          <SakerGraphInspector
            selected={selected}
            graph={allGraph}
            brain={brain}
            onSelect={(id) => {
              setSelected(id)
              setHovered(null)
            }}
            onOpenNote={onOpenNote}
            onClear={() => {
              setSelected(null)
              setHovered(null)
            }}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between pt-2 text-[10px] text-muted-foreground/65">
        <span>
          Passe o cursor para ver conexões · Arraste para mover · Role para ampliar · Clique duas
          vezes para abrir
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="size-3" /> Organização automática
        </span>
      </div>
    </div>
  )
}
