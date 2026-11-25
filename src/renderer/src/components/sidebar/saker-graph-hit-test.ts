import type { SakerGraphKind } from './saker-graph-types'

/** Shared screen-space geometry for the rendered circles and labels. */
export type GraphHitNode = {
  id: string
  label: string
  kind: SakerGraphKind
  degree: number
  x?: number
  y?: number
}
export type ScreenPoint = { x: number; y: number }
export type ScreenViewport = { left: number; top: number; width: number; height: number }
export type Camera = { x: number; y: number; k: number }
export type HitOptions = {
  nodeSize: number
  labelThreshold: number
  focusedId?: string | null
  measureLabel?: (label: string, font: string) => number | null
}

export function getSakerGraphNodeRadius(node: GraphHitNode, nodeSize: number): number {
  const base =
    node.kind === 'global'
      ? 5.6
      : node.kind === 'project'
        ? 4.6
        : node.kind === 'directory'
          ? 4
          : node.kind === 'file'
            ? 3.5
            : node.kind === 'topic'
              ? 3
              : 2.9
  return (base + Math.min(7, Math.sqrt(node.degree) * 1.55)) * nodeSize
}

export function getSakerGraphLabel(
  node: GraphHitNode,
  zoom: number,
  threshold: number,
  count: number,
  focusedId?: string | null
): { text: string; size: number; font: string } | null {
  const focused = node.id === focusedId
  if (
    !focused &&
    (zoom < threshold ||
      (count >= 18 && node.degree < 2 && node.kind !== 'global' && node.kind !== 'project'))
  ) {
    return null
  }
  const length = zoom < 0.85 ? 20 : 34
  const text = node.label.length > length ? `${node.label.slice(0, length - 1)}…` : node.label
  const size = (focused ? 12 : node.kind === 'section' ? 10 : 11) / Math.max(0.72, zoom)
  return {
    text,
    size,
    font: `${(focused ? '600 ' : '400 ') + size}px Geist, system-ui, sans-serif`
  }
}

export function hitTestSakerGraphNode<T extends GraphHitNode>(
  nodes: readonly T[],
  cursor: ScreenPoint,
  viewport: ScreenViewport,
  camera: Camera,
  settings: HitOptions
): T | null {
  let nearestCircle: T | null = null
  let circleDistance = Infinity
  let nearestLabel: T | null = null
  let labelDistance = Infinity
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      continue
    }
    const cx = viewport.left + viewport.width / 2 + camera.x + node.x! * camera.k
    const cy = viewport.top + viewport.height / 2 + camera.y + node.y! * camera.k
    const radius = getSakerGraphNodeRadius(node, settings.nodeSize) * camera.k
    const dist = Math.hypot(cursor.x - cx, cursor.y - cy)
    if (dist <= Math.max(10, radius + 3) && dist < circleDistance) {
      nearestCircle = node
      circleDistance = dist
    }

    const labelTop = cy + radius + 6
    if (cursor.y < labelTop - 2 || cursor.y > labelTop + 20) {
      continue
    }
    const label = getSakerGraphLabel(
      node,
      camera.k,
      settings.labelThreshold,
      nodes.length,
      settings.focusedId
    )
    if (!label) {
      continue
    }
    const fontSize = label.size * camera.k
    const measured = settings.measureLabel?.(label.text, label.font)
    const width = (measured == null ? label.text.length * fontSize * 0.55 : measured * camera.k) + 8
    if (Math.abs(cursor.x - cx) <= width / 2 && cursor.y <= labelTop + fontSize + 5) {
      const distance = Math.abs(cursor.x - cx) + Math.abs(cursor.y - labelTop)
      if (distance < labelDistance) {
        nearestLabel = node
        labelDistance = distance
      }
    }
  }
  return nearestCircle ?? nearestLabel
}
