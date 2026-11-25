import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BookOpenText, BrainCircuit, GitBranch, List, RefreshCw } from 'lucide-react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { SakerBrainState } from '../../../../shared/saker-brain'
import {
  SakerBrainNotes,
  type BrainActionOptions,
  type BrainNoteDraft,
  type BrainNoteMode,
  type BrainUpdateDraft
} from './SakerBrainNotes'

import { SakerBrainTransfer } from './SakerBrainTransfer'
import { SakerBrainProjectMemory } from './SakerBrainProjectMemory'

const Graph = lazyWithRetry(
  () => import('./SakerBrainGraph').then((module) => ({ default: module.SakerBrainGraph })),
  { reloadKey: 'saker-brain-graph' }
)

const TABS = [
  { id: 'graph', label: 'Grafo', icon: GitBranch },
  { id: 'notes', label: 'Notas', icon: BookOpenText },
  { id: 'index', label: 'Projetos', icon: List }
] as const
type Tab = (typeof TABS)[number]['id']

export default function SakerBrainDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const api = window.api.sakerBrain
  const [brain, setBrain] = useState<SakerBrainState | null>(null)
  const [selected, setSelected] = useState('global')
  const [draft, setDraft] = useState<BrainNoteDraft | null>(null)
  const [proposal, setProposal] = useState<BrainUpdateDraft | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('graph')
  const [mode, setMode] = useState<BrainNoteMode>('preview')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const inFlight = useRef(false)
  const canLeave = (): boolean =>
    !busy &&
    (!(draft?.dirty || proposal?.content) ||
      window.confirm('Descartar alterações não salvas do Brain?'))

  const run = useCallback(
    async (
      action: () => Promise<SakerBrainState>,
      options: BrainActionOptions = {}
    ): Promise<void> => {
      if (inFlight.current) {
        return
      }
      inFlight.current = true
      setBusy(true)
      setStatus(null)
      try {
        const snapshot = await action()
        setBrain(snapshot)
        if (options.discardDraft) {
          setDraft(null)
        }
        if (options.discardProposal) {
          setProposal(null)
        }
        if (options.status) {
          setStatus({ text: options.status })
        }
      } catch (error) {
        setStatus({
          text:
            error instanceof Error
              ? error.message
              : 'Não foi possível concluir a operação no Brain.',
          error: true
        })
      } finally {
        setBusy(false)
        inFlight.current = false
      }
    },
    []
  )

  useEffect(() => {
    void run(api.get)
  }, [api, run])

  const openNote = (id: string): void => {
    if (id !== selected) {
      if (!canLeave()) {
        return
      }
      setDraft(null)
      setSelected(id)
      setProposal(null)
      setReviewOpen(false)
      setStatus(null)
    }
    setTab('notes')
  }

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && canLeave()) {
          onClose()
        }
      }}
    >
      <DialogContent className="saker-brain-window flex max-h-[92vh] h-[min(760px,92vh)] w-[calc(100vw-24px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[1180px]">
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 border-b border-border px-4 py-3 pr-12 text-left">
          <BrainCircuit className="size-5 shrink-0 text-ai-action-accent" aria-hidden />
          <DialogTitle>Saker Brain</DialogTitle>
          <DialogDescription className="sr-only">
            Explore conexões e gerencie a memória local dos projetos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-1" aria-label="Visualizações do Brain">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={tab === id ? 'secondary' : 'ghost'}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
          {brain && <SakerBrainTransfer brain={brain} busy={busy} run={run} />}
          <Button
            variant="ghost"
            size="icon"
            className={brain ? undefined : 'ml-auto'}
            aria-label="Atualizar Brain"
            disabled={busy}
            onClick={() => void run(api.get)}
          >
            <RefreshCw aria-hidden />
          </Button>
        </div>
        {status && (
          <p
            role={status.error ? 'alert' : 'status'}
            className="shrink-0 border-b border-border px-4 py-2 text-xs"
          >
            {status.text}
          </p>
        )}
        {!brain && !status && (
          <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
            Carregando memória…
          </p>
        )}
        {tab === 'graph' && brain && (
          <div className="min-h-0 flex-1 p-3">
            <Suspense
              fallback={
                <p role="status" className="text-sm text-muted-foreground">
                  Carregando gráfico…
                </p>
              }
            >
              <Graph
                brain={brain}
                onOpenNote={openNote}
                busy={busy}
                onRefreshFiles={(id) =>
                  void run(() => api.refreshProjectMap(id), {
                    status: 'Arquivos e conexões atualizados.'
                  })
                }
              />
            </Suspense>
          </div>
        )}
        {tab === 'index' && brain && (
          <section className="min-h-0 flex-1 overflow-auto p-4">
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={brain.config.enabled}
                disabled={busy}
                onChange={(event) => {
                  const enabled = event.target.checked
                  void run(() => api.setGlobalEnabled(enabled))
                }}
              />
              Permitir edição e ativação do Brain
            </label>
            <div className="divide-y divide-border rounded-md border border-border">
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-accent"
                onClick={() => openNote('global')}
              >
                Brain geral
              </button>
              {brain.projects.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md py-1 text-left text-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => openNote(item.id)}
                  >
                    <span className="block truncate font-medium">{item.name}</span>
                    {item.summary && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.summary}
                      </span>
                    )}
                    {item.error && (
                      <span className="block text-xs text-destructive">{item.error}</span>
                    )}
                  </button>
                  <SakerBrainProjectMemory
                    project={item}
                    globallyEnabled={brain.config.enabled}
                    busy={busy}
                    run={run}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'notes' && brain && (
          <SakerBrainNotes
            brain={brain}
            selected={selected}
            draft={draft}
            setDraft={setDraft}
            proposal={proposal}
            setProposal={setProposal}
            reviewOpen={reviewOpen}
            setReviewOpen={setReviewOpen}
            mode={mode}
            setMode={setMode}
            busy={busy}
            canLeave={canLeave}
            openNote={openNote}
            run={run}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
