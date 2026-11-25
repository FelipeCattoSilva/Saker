export type SakerGraphKind = 'global' | 'project' | 'section' | 'topic' | 'file' | 'directory'
export type SakerGraphNode = {
  id: string
  label: string
  kind: SakerGraphKind
  projectId?: string
  details?: string
  filePath?: string
}
export type SakerGraphEdge = { a: string; b: string; kind?: 'structure' | 'import' }
