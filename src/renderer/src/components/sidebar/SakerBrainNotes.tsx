import { SakerBrainProjectMemory } from './SakerBrainProjectMemory'
import { Save } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Button } from '@/components/ui/button'
import type { SakerBrainState } from '../../../../shared/saker-brain'

const MODES = ['write', 'preview', 'split'] as const
export type BrainNoteMode = (typeof MODES)[number]
export type BrainNoteDraft = { content: string; revision: string; dirty: boolean }
export type BrainUpdateDraft = { content: string; revision: string }
export type BrainActionOptions = {
  discardDraft?: boolean
  discardProposal?: boolean
  status?: string
}

type Props = {
  brain: SakerBrainState
  selected: string
  draft: BrainNoteDraft | null
  setDraft: (draft: BrainNoteDraft) => void
  proposal: BrainUpdateDraft | null
  setProposal: (proposal: BrainUpdateDraft) => void
  reviewOpen: boolean
  setReviewOpen: (open: boolean) => void
  mode: BrainNoteMode
  setMode: (mode: BrainNoteMode) => void
  busy: boolean
  canLeave: () => boolean
  openNote: (id: string) => void
  run: (action: () => Promise<SakerBrainState>, options?: BrainActionOptions) => Promise<void>
}

export function SakerBrainNotes({
  brain,
  selected,
  draft,
  setDraft,
  proposal,
  setProposal,
  reviewOpen,
  setReviewOpen,
  mode,
  setMode,
  busy,
  canLeave,
  openNote,
  run
}: Props): React.JSX.Element {
  const api = window.api.sakerBrain
  const project = brain?.projects.find((entry) => entry.id === selected)
  const note = draft ?? {
    content: selected === 'global' ? (brain?.global ?? '') : (project?.content ?? ''),
    revision: (selected === 'global' ? brain?.globalRevision : project?.revision) ?? 'missing',
    dirty: false
  }
  const editable = Boolean(
    brain?.config.enabled && (selected === 'global' || (project?.enabled && project.initialized))
  )
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="min-w-0 text-xs text-muted-foreground">
          <span className="sr-only">Nota do Brain</span>
          <select
            value={selected}
            className="max-w-[220px] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            onChange={(event) => openNote(event.target.value)}
          >
            <option value="global">Brain geral</option>
            {selected !== 'global' && !project && (
              <option value={selected}>Projeto indisponível</option>
            )}
            {brain.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1" aria-label="Modo do editor">
          {MODES.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? 'secondary' : 'ghost'}
              aria-pressed={mode === item}
              className="capitalize"
              onClick={() => setMode(item)}
            >
              {{ preview: 'Leitura', write: 'Editar', split: 'Lado a lado' }[item]}
            </Button>
          ))}
        </div>
      </div>
      {selected === 'global' && brain.legacyAvailable && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
          <span>
            Uma nota do Brain geral de uma versão anterior pode ser copiada para este perfil.
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || note.dirty || !editable}
            onClick={() => void run(api.importLegacy, { status: 'Brain geral copiado.' })}
          >
            Copiar nota anterior
          </Button>
        </div>
      )}
      {project?.error && (
        <p role="alert" className="text-xs">
          {project.error}
        </p>
      )}
      {project && !project.error && (
        <SakerBrainProjectMemory
          project={project}
          globallyEnabled={brain.config.enabled}
          busy={busy}
          run={run}
        />
      )}
      {reviewOpen && project && (
        <section
          aria-label="Revisar atualização do projeto"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-md border border-border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Revisar atualização do projeto</h3>
            <Button size="sm" variant="ghost" onClick={() => setReviewOpen(false)}>
              Voltar à nota
            </Button>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span>
              Cole uma atualização verificada com fatos, decisões e referências. Omita segredos e
              transcrições.
            </span>
            <textarea
              aria-label="Atualização proposta"
              className="min-h-20 rounded-md border border-border bg-background p-2 font-mono"
              value={proposal?.content ?? ''}
              disabled={busy || !editable || (!proposal && project.updatesRevision === undefined)}
              maxLength={4000}
              onChange={(event) =>
                setProposal({
                  content: event.target.value,
                  revision: proposal?.revision ?? project.updatesRevision ?? 'missing'
                })
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !editable || !proposal?.content.trim()}
              onClick={() => {
                if (!proposal) {
                  return
                }
                void run(() => api.recordUpdate(project.id, proposal.content, proposal.revision), {
                  discardProposal: true,
                  status: 'Atualização revisada registrada.'
                })
              }}
            >
              Registrar atualização
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!proposal?.content || window.confirm('Descartar esta atualização proposta?')) {
                  void run(() => api.getUpdates(project.id), { discardProposal: true })
                }
              }}
            >
              Recarregar histórico
            </Button>
          </div>
          {project.updates && (
            <div className="saker-brain-markdown">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                disallowedElements={['img']}
              >
                {project.updates}
              </Markdown>
            </div>
          )}
        </section>
      )}
      {!reviewOpen && (
        <div
          className={`saker-brain-notes-body min-h-0 flex-1 ${mode === 'split' ? 'is-split' : ''}`}
        >
          {mode !== 'preview' && (
            <textarea
              value={note.content}
              readOnly={!editable || busy}
              spellCheck={false}
              aria-label="Código Markdown"
              onChange={(event) => setDraft({ ...note, content: event.target.value, dirty: true })}
              className="saker-brain-source min-h-0 w-full resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-foreground"
            />
          )}
          {mode !== 'write' && (
            <div className="saker-brain-preview min-h-0 overflow-auto p-4">
              <div className="saker-brain-markdown">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  disallowedElements={['img']}
                >
                  {note.content}
                </Markdown>
              </div>
            </div>
          )}
        </div>
      )}
      <footer className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="mr-auto">{note.dirty ? 'Alterações não salvas' : 'Markdown local'}</span>
        {project?.initialized && !reviewOpen && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setReviewOpen(true)
              void run(() => api.getUpdates(project.id))
            }}
          >
            Revisar atualização
          </Button>
        )}
        {note.dirty && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (canLeave()) {
                void run(api.get, { discardDraft: true })
              }
            }}
          >
            Descartar rascunho
          </Button>
        )}
        <Button
          size="sm"
          disabled={busy || !editable || !note.dirty || reviewOpen}
          onClick={() =>
            void run(() => api.save(selected, note.content, note.revision), {
              discardDraft: true,
              status: 'Salvo.'
            })
          }
        >
          <Save aria-hidden /> Salvar nota
        </Button>
      </footer>
    </section>
  )
}
