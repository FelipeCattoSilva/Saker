import { describe, expect, it } from 'vitest'
import { hitTestSakerGraphNode } from './saker-graph-hit-test'
import { getSakerConnections } from './SakerGraphInspector'

describe('Saker graph selection and related files', () => {
  const viewport = { left: 100, top: 80, width: 800, height: 500 }
  const nodes = [
    { id: 'global', label: 'General Brain', kind: 'global' as const, degree: 3, x: 30, y: 25 },
    { id: 'project', label: 'Project Brain', kind: 'project' as const, degree: 2, x: -130, y: -90 }
  ]
  const settings = { nodeSize: 1, labelThreshold: 0.82 }

  it('hits a circle using screen-space coordinates at different zoom levels', () => {
    for (const k of [0.5, 1, 2]) {
      const center = {
        x: viewport.left + viewport.width / 2 + 30 * k,
        y: viewport.top + viewport.height / 2 + 25 * k
      }
      expect(hitTestSakerGraphNode(nodes, center, viewport, { x: 0, y: 0, k }, settings)?.id).toBe(
        'global'
      )
    }
  })

  it('keeps the selected label clickable at low zoom', () => {
    const camera = { x: 0, y: 0, k: 0.6 }
    const centerX = viewport.left + viewport.width / 2 + 30 * camera.k
    const centerY = viewport.top + viewport.height / 2 + 25 * camera.k
    const result = hitTestSakerGraphNode(
      nodes,
      { x: centerX + 22, y: centerY + 14 },
      viewport,
      camera,
      { ...settings, focusedId: 'global' }
    )
    expect(result?.id).toBe('global')
  })

  it('clicking empty canvas returns no selection rather than a distant orb', () => {
    expect(
      hitTestSakerGraphNode(nodes, { x: 180, y: 150 }, viewport, { x: 0, y: 0, k: 0.5 }, settings)
    ).toBeNull()
  })

  it('allows text-label selection when the label is visible', () => {
    const centerX = viewport.left + viewport.width / 2 + 30
    const centerY = viewport.top + viewport.height / 2 + 25
    expect(
      hitTestSakerGraphNode(
        nodes,
        { x: centerX + 24, y: centerY + 27 },
        viewport,
        { x: 0, y: 0, k: 1 },
        settings
      )?.id
    ).toBe('global')
  })

  it('groups incoming and outgoing relations with accurate direction', () => {
    const graph = {
      nodes: [
        { id: 'global', label: 'General Brain', kind: 'global' as const },
        { id: 'project', label: 'chofer', kind: 'project' as const },
        { id: 'tag', label: 'release', kind: 'topic' as const }
      ],
      edges: [
        { a: 'global', b: 'project' },
        { a: 'project', b: 'tag' }
      ]
    }
    const related = getSakerConnections(graph, 'project')
    expect(related.inbound.map((n) => n.id)).toEqual(['global'])
    expect(related.outbound.map((n) => n.id)).toEqual(['tag'])
  })
})
