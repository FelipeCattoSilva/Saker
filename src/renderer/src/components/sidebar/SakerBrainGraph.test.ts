import { describe, expect, it } from 'vitest'
import { buildLocalGraph, buildSakerGraph } from './SakerBrainGraph'
import type { SakerBrainState } from '../../../../preload/api/saker-brain-api'

describe('Saker Brain graph', () => {
  const state: SakerBrainState = {
    config: { enabled: true, agentInstructions: true },
    global: '# General Brain\n## Shared Tools\n[[TypeScript]]',
    index: '',
    projects: [
      {
        id: 'project-1',
        name: 'Saker IDE',
        path: 'C:\\Projects\\Saker',
        summary: 'A development environment',
        enabled: true,
        instructionStatus: 'created',
        content: '# Saker\n## Goals\nUse [[TypeScript]] and [[React]]'
      },
      {
        id: 'project-2',
        name: 'Demo',
        path: 'C:\\Projects\\Demo',
        summary: 'Disabled workspace',
        enabled: false,
        instructionStatus: 'disabled',
        content: '# Demo'
      }
    ]
  }

  it('connects the global brain to enabled projects and Markdown sections', () => {
    const { nodes, edges } = buildSakerGraph(state)
    expect(nodes.some((n) => n.id === 'global')).toBe(true)
    expect(nodes.some((n) => n.id === 'project-1')).toBe(true)
    expect(nodes.some((n) => n.id === 'project-2')).toBe(false)
    expect(nodes.some((n) => n.label === 'Goals' && n.kind === 'section')).toBe(true)
    expect(edges).toContainEqual({ a: 'global', b: 'project-1' })
  })

  it('deduplicates wiki-linked topics shared between global and project notes', () => {
    const { nodes, edges } = buildSakerGraph(state)
    expect(nodes.filter((n) => n.label === 'TypeScript' && n.kind === 'topic')).toHaveLength(1)
    expect(edges.filter((e) => e.b === 'topic:typescript')).toHaveLength(2)
    expect(nodes.some((n) => n.label === 'React' && n.kind === 'topic')).toBe(true)
  })

  it('local graph restricts nodes to the selected note neighborhood', () => {
    const graph = buildSakerGraph(state)
    const local = buildLocalGraph(graph, 'project-1', 1)
    expect(local.nodes.some((node) => node.id === 'project-1')).toBe(true)
    expect(local.nodes.some((node) => node.id === 'global')).toBe(true)
    expect(local.nodes.some((node) => node.label === 'React')).toBe(true)
    expect(local.nodes.some((node) => node.label === 'Shared Tools')).toBe(false)
    expect(
      local.edges.every(
        (edge) =>
          local.nodes.some((node) => node.id === edge.a) &&
          local.nodes.some((node) => node.id === edge.b)
      )
    ).toBe(true)
  })

  it('wiki-links to a known project resolve to the project node, without phantom duplicates', () => {
    const another = { ...state, global: state.global + '\\n[[Saker IDE]]' }
    const graph = buildSakerGraph(another)
    expect(graph.nodes.filter((node) => node.label === 'Saker IDE')).toHaveLength(1)
    expect(
      graph.edges.filter((edge) => edge.a === 'global' && edge.b === 'project-1')
    ).toHaveLength(1)
  })

  it('resolves forward section links without treating fenced code as links', () => {
    const { nodes, edges } = buildSakerGraph({
      ...state,
      global: 'Read [[Saker IDE#Goals]].\n\n~~~md\n[[Code sample]]\n## Example heading\n~~~'
    })
    expect(edges).toContainEqual({ a: 'global', b: 'section:project-1:goals' })
    expect(nodes.map((node) => node.label)).not.toContain('Code sample')
    expect(nodes.map((node) => node.label)).not.toContain('Example heading')
  })
  it('adds distinct files, their directory hierarchy and resolved import edges', () => {
    const graph = buildSakerGraph({
      ...state,
      projects: [
        {
          ...state.projects[0],
          fileGraph: {
            files: ['src/checkout/page.tsx', 'src/profile/page.tsx'],
            links: [{ from: 'src/checkout/page.tsx', to: 'src/profile/page.tsx' }],
            partial: false,
            analyzed: true
          }
        }
      ]
    })
    expect(graph.nodes.filter((node) => node.kind === 'file').map((node) => node.filePath)).toEqual(
      ['src/checkout/page.tsx', 'src/profile/page.tsx']
    )
    expect(
      graph.nodes.some((node) => node.kind === 'directory' && node.filePath === 'src/checkout')
    ).toBe(true)
    expect(graph.edges).toContainEqual({
      a: 'directory:project-1:src/checkout',
      b: 'file:project-1:src/checkout/page.tsx',
      kind: 'structure'
    })
    expect(graph.edges).toContainEqual({
      a: 'file:project-1:src/checkout/page.tsx',
      b: 'file:project-1:src/profile/page.tsx',
      kind: 'import'
    })
  })
})
