import React from 'react'
import { ArrowDownLeft, ArrowUpRight, FileText, Link2, MousePointer2, X } from 'lucide-react'
import type { SakerBrainState } from '../../../../shared/saker-brain'

import type { SakerGraphNode as Node, SakerGraphEdge as Edge } from './saker-graph-types'

export function getSakerConnections(
  graph: { nodes: Node[]; edges: Edge[] },
  nodeId: string
): { inbound: Node[]; outbound: Node[] } {
  const map = new Map(graph.nodes.map((node) => [node.id, node]))
  const incoming = new Set<string>()
  const outgoing = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.b === nodeId) {
      incoming.add(edge.a)
    }
    if (edge.a === nodeId) {
      outgoing.add(edge.b)
    }
  }
  return {
    inbound: [...incoming].map((id) => map.get(id)).filter((n): n is Node => !!n),
    outbound: [...outgoing].map((id) => map.get(id)).filter((n): n is Node => !!n)
  }
}

export function SakerGraphInspector({
  selected,
  graph,
  brain,
  onSelect,
  onOpenNote,
  onClear
}: {
  selected: string | null
  graph: { nodes: Node[]; edges: Edge[] }
  brain: SakerBrainState
  onSelect: (id: string) => void
  onOpenNote: (id: string) => void
  onClear: () => void
}): React.JSX.Element {
  const node = graph.nodes.find((n) => n.id === selected)
  const related = node ? getSakerConnections(graph, node.id) : { inbound: [], outbound: [] }
  const project = node?.projectId
    ? brain.projects.find((p) => p.id === node.projectId)
    : node?.id === 'global'
      ? undefined
      : brain.projects.find((p) => p.id === node?.id)
  const sourceName =
    node?.filePath && project
      ? `${project.path.replace(/[\\/]+$/, '')}/${node.filePath}`
      : node?.kind === 'global' || (node?.kind === 'section' && !node.projectId)
        ? 'Brain geral / general.md'
        : project
          ? `${project.path.replace(/[\\/]+$/, '')}\\.saker\\brain.md`
          : null
  const noteId = project?.id || 'global'

  const section = (title: string, nodes: Node[], incoming: boolean): React.JSX.Element => (
    <section className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <span className="font-mono text-muted-foreground">{nodes.length}</span>
      </div>
      {nodes.length ? (
        nodes.map((n) => (
          <button
            type="button"
            key={n.id}
            title={`Selecionar ${n.label}`}
            onClick={() => onSelect(n.id)}
            className="saker-graph-inspector-link group flex w-full min-w-0 items-center gap-2 rounded px-2 py-2 text-left"
          >
            {incoming ? (
              <ArrowDownLeft className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-foreground">{n.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {n.filePath ||
                  (n.kind === 'file'
                    ? 'Arquivo do projeto'
                    : n.kind === 'directory'
                      ? 'Pasta do projeto'
                      : n.kind === 'project'
                        ? 'Arquivo do Brain do projeto'
                        : n.kind === 'global'
                          ? 'Arquivo do Brain geral'
                          : n.kind === 'section'
                            ? 'Seção Markdown'
                            : 'Link interno ou tag')}
              </span>
            </span>
          </button>
        ))
      ) : (
        <div className="px-2 py-2 text-[11px] text-muted-foreground">
          Nenhuma conexão {incoming ? 'recebida' : 'de saída'} encontrada
        </div>
      )}
    </section>
  )

  return (
    <aside
      aria-label="Arquivos e conexões"
      className="saker-graph-inspector flex w-[225px] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card"
    >
      <header className="flex min-h-[39px] items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
          <Link2 className="size-3.5 text-muted-foreground" /> Conexões
        </div>
        {node && (
          <button
            type="button"
            title="Clear selection"
            aria-label="Limpar seleção"
            onClick={onClear}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </header>
      {!node ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <MousePointer2 className="size-5 text-muted-foreground" strokeWidth={1.45} />
          <div className="text-[11px] font-medium text-foreground">Selecione um nó</div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Os arquivos relacionados e as conexões aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {
              {
                global: 'Geral',
                project: 'Projeto',
                section: 'Seção',
                topic: 'Referência',
                file: 'Arquivo',
                directory: 'Pasta'
              }[node.kind]
            }
          </div>
          <h3 className="mt-1 break-words text-[13px] font-semibold leading-snug text-foreground">
            {node.label}
          </h3>
          {node.details && (
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
              {node.details}
            </p>
          )}
          {sourceName && (
            <div className="mt-3 rounded-md border border-border bg-card p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
                <FileText className="size-3" /> Arquivo de origem
              </div>
              <p
                title={sourceName}
                className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-muted-foreground"
              >
                {sourceName}
              </p>
              {!node.filePath && (
                <button
                  type="button"
                  onClick={() => onOpenNote(noteId)}
                  className="mt-2 text-[10px] font-semibold text-muted-foreground hover:underline"
                >
                  Abrir nota do Brain
                </button>
              )}
            </div>
          )}
          {!sourceName && (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Esta referência é um link ou uma tag; o arquivo no disco ainda não foi verificado.
            </p>
          )}
          {section(
            'Importa',
            related.outbound.filter((target) =>
              graph.edges.some(
                (edge) => edge.a === node.id && edge.b === target.id && edge.kind === 'import'
              )
            ),
            false
          )}
          {section(
            'Usado por',
            related.inbound.filter((target) =>
              graph.edges.some(
                (edge) => edge.b === node.id && edge.a === target.id && edge.kind === 'import'
              )
            ),
            true
          )}
          {section(
            'Estrutura e referências',
            related.outbound.filter(
              (target) =>
                !graph.edges.some(
                  (edge) => edge.a === node.id && edge.b === target.id && edge.kind === 'import'
                )
            ),
            false
          )}
          {section(
            'Origem e estrutura',
            related.inbound.filter(
              (target) =>
                !graph.edges.some(
                  (edge) => edge.b === node.id && edge.a === target.id && edge.kind === 'import'
                )
            ),
            true
          )}
        </div>
      )}
      <footer className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        {node
          ? `${related.inbound.length + related.outbound.length} nós conectados`
          : 'Clique em um nó ou rótulo'}
      </footer>
    </aside>
  )
}
