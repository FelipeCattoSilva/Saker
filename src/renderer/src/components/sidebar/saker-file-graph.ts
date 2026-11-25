import type { SakerBrainProject } from '../../../../shared/saker-brain'
import type { SakerGraphNode, SakerGraphEdge } from './saker-graph-types'

export function buildSakerFileGraph(project: SakerBrainProject): {
  nodes: SakerGraphNode[]
  edges: SakerGraphEdge[]
} {
  const nodes: SakerGraphNode[] = []
  const edges: SakerGraphEdge[] = []
  const directories = new Map<string, string>()
  const fileId = (file: string): string => `file:${project.id}:${file}`
  for (const file of project.fileGraph?.files ?? []) {
    const segments = file.split('/')
    let parent = project.id
    for (let depth = 1; depth < segments.length && depth <= 3; depth++) {
      const folder = segments.slice(0, depth).join('/')
      let id = directories.get(folder)
      if (!id && directories.size < 240) {
        id = `directory:${project.id}:${folder}`
        directories.set(folder, id)
        nodes.push({
          id,
          label: `${segments[depth - 1]}/`,
          kind: 'directory',
          projectId: project.id,
          filePath: folder,
          details: folder
        })
        edges.push({ a: parent, b: id, kind: 'structure' })
      }
      if (id) {
        parent = id
      }
    }
    const id = fileId(file)
    nodes.push({
      id,
      label: segments.at(-1) ?? file,
      kind: 'file',
      projectId: project.id,
      filePath: file,
      details: file
    })
    edges.push({ a: parent, b: id, kind: 'structure' })
  }
  for (const link of project.fileGraph?.links ?? []) {
    edges.push({ a: fileId(link.from), b: fileId(link.to), kind: 'import' })
  }
  return { nodes, edges }
}
