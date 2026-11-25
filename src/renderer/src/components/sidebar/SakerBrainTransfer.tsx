import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { useTranslate } from '@/i18n/use-translate'
import type { SakerBrainState } from '../../../../shared/saker-brain'
import type { BrainImportPreview, BrainTransferApi } from '../../../../shared/saker-brain-transfer'

type Props = {
  brain: SakerBrainState
  busy: boolean
  run: (action: () => Promise<SakerBrainState>) => Promise<void>
  api?: BrainTransferApi
}
export function SakerBrainTransfer({
  brain,
  busy,
  run,
  api = window.api.sakerBrain
}: Props): React.JSX.Element {
  const t = useTranslate()
  const [working, setWorking] = useState(false)
  const [preview, setPreview] = useState<BrainImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState(true)
  const [activate, setActivate] = useState(brain.config.enabled)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = busy || working
  const canImport = Boolean(
    preview && ((general && preview.generalAvailable) || Object.values(mapping).some(Boolean))
  )
  const fail = (cause: unknown): void =>
    setError(cause instanceof Error ? cause.message : String(cause))
  const exportBrain = async (): Promise<void> => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await api.exportArchive()
      if (result) {
        setNotice(
          t('saker.transfer.exported', 'Brain exported: {{size}} KB, {{count}} projects.', {
            size: Math.max(1, Math.round(result.bytes / 1024)),
            count: result.projects
          })
        )
      }
    } catch (cause) {
      fail(cause)
    } finally {
      setWorking(false)
    }
  }
  const pickImport = async (): Promise<void> => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const next = await api.pickImportArchive()
      if (!next) {
        return
      }
      setMapping(
        Object.fromEntries(
          next.projects.map((project) => {
            const matches = brain.projects.filter(
              (candidate) =>
                !candidate.error &&
                candidate.name.toLocaleLowerCase() === project.name.toLocaleLowerCase()
            )
            return [project.id, matches.length === 1 ? matches[0].id : '']
          })
        )
      )
      setGeneral(next.generalAvailable)
      setActivate(brain.config.enabled)
      setPreview(next)
    } catch (cause) {
      fail(cause)
    } finally {
      setWorking(false)
    }
  }
  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={t('saker.transfer.export', 'Export Brain')}
          onClick={() => void exportBrain()}
        >
          <Download aria-hidden />
          <span className="hidden sm:inline">{t('saker.transfer.export', 'Export Brain')}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={t('saker.transfer.import', 'Import Brain')}
          onClick={() => void pickImport()}
        >
          <Upload aria-hidden />
          <span className="hidden sm:inline">{t('saker.transfer.import', 'Import Brain')}</span>
        </Button>
      </div>
      {(notice || (error && !preview)) && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setNotice('')
              setError('')
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {error
                  ? t('saker.transfer.failed', 'Brain transfer failed')
                  : t('saker.transfer.ready', 'Brain package saved')}
              </DialogTitle>
              <DialogDescription>{error || notice}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setNotice('')
                  setError('')
                }}
              >
                {t('saker.transfer.close', 'Close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setPreview(null)
            setError('')
          }
        }}
      >
        <DialogContent
          scrollable
          className="sm:max-w-xl"
          showCloseButton={!pending}
          onEscapeKeyDown={(event) => {
            if (pending) {
              event.preventDefault()
            }
          }}
          onInteractOutside={(event) => {
            if (pending) {
              event.preventDefault()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('saker.transfer.import', 'Import Brain')}</DialogTitle>
            <DialogDescription>
              {t(
                'saker.transfer.description',
                'Choose the local project folders for these memories. Existing notes are preserved and merged. The package contains Brain notes and maps; copy or clone your source code separately.'
              )}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              <p className="break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
                {preview.fileName} · {Math.max(1, Math.round(preview.compressedBytes / 1024))} KB
              </p>
              {preview.generalAvailable && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={general}
                    disabled={pending}
                    onChange={(event) => setGeneral(event.target.checked)}
                  />
                  {t('saker.transfer.general', 'Include general Brain')}
                </label>
              )}
              <div className="space-y-3">
                {preview.projects.map((source) => (
                  <label
                    key={source.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm"
                  >
                    <span className="font-medium">{source.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('saker.transfer.destination', 'Local destination project')}
                    </span>
                    <select
                      aria-label={t('saker.transfer.destinationFor', 'Destination for {{name}}', {
                        name: source.name
                      })}
                      value={mapping[source.id] ?? ''}
                      disabled={pending}
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [source.id]: event.target.value }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">
                        {t('saker.transfer.skip', 'Do not import this project')}
                      </option>
                      {brain.projects
                        .filter((project) => !project.error)
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name} — {project.path}
                          </option>
                        ))}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      {t('saker.transfer.files', '{{count}} indexed files', {
                        count: source.files
                      })}
                    </span>
                  </label>
                ))}
              </div>
              {preview.projects.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'saker.transfer.addProject',
                    'If the destination is missing, add its folder to Saker first, then select this package again.'
                  )}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activate && brain.config.enabled}
                  disabled={pending || !brain.config.enabled}
                  onChange={(event) => setActivate(event.target.checked)}
                />
                {t('saker.transfer.activate', 'Enable agent memory in imported projects')}
              </label>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null)
                setError('')
              }}
            >
              {t('saker.transfer.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={pending || !canImport}
              onClick={() => {
                if (!preview) {
                  return
                }
                setError('')
                void run(async () => {
                  try {
                    const next = await api.importArchive({
                      token: preview.token,
                      general,
                      activate: activate && brain.config.enabled,
                      mappings: Object.entries(mapping)
                        .filter(([, projectId]) => projectId)
                        .map(([sourceId, projectId]) => ({ sourceId, projectId }))
                    })
                    setPreview(null)
                    setNotice(
                      t(
                        'saker.transfer.imported',
                        'Brain imported. In a new chat, follow the project guides and check the recorded paths on this computer.'
                      )
                    )
                    return next
                  } catch (cause) {
                    fail(cause)
                    throw cause
                  }
                })
              }}
            >
              {pending
                ? t('saker.transfer.importing', 'Importing…')
                : t('saker.transfer.merge', 'Import and merge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
