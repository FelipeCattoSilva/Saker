import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Check, Copy, FileSearch, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import type { SakerBrainProject, SakerBrainState } from '../../../../shared/saker-brain'

type Props = {
  project: SakerBrainProject
  globallyEnabled: boolean
  busy: boolean
  run: (action: () => Promise<SakerBrainState>) => Promise<void>
}

export function SakerBrainProjectMemory({
  project,
  globallyEnabled,
  busy,
  run
}: Props): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const active = project.enabled && project.agentInstructions && project.initialized
  const message = [
    t(
      'saker.brainMemory.messageIntro',
      'I enabled Saker Brain in this project. Read AGENTS.md or CLAUDE.md and .saker/settings.json now.'
    ),
    t(
      'saker.brainMemory.messageDisabled',
      'If enabled or agentInstructions is false, do not update memory automatically.'
    ),
    t(
      'saker.brainMemory.messageRead',
      'While Brain is enabled, read .saker/brain.md before continuing. Consult .saker/updates.md and referenced files as needed.'
    ),
    t(
      'saker.brainMemory.messageFiles',
      'Before searching for code, consult .saker/file-map.md and verified feature-to-file paths in brain.md. Open the recorded files directly and verify them. After investigating a feature such as checkout, record its page, route, components and handlers with exact paths. Keep the map current when files are created, moved or deleted. Search broadly only if the map is missing, stale or insufficient.'
    ),
    t(
      'saker.brainMemory.messageUpdate',
      'After each completed turn with new relevant information, update .saker/brain.md with requirements, decisions, verified progress and next steps. Append a dated checkpoint to .saker/updates.md.'
    ),
    t(
      'saker.brainMemory.messageCheckpoint',
      'Before compacting or ending the session, save outstanding work when possible. Separate facts, hypotheses and decisions. Reread files before writing and preserve changes from other sessions.'
    ),
    t(
      'saker.brainMemory.messagePrivacy',
      'Keep the summary concise. Do not store secrets, personal data or complete transcripts.'
    ),
    t(
      'saker.brainMemory.messageRecheck',
      'Check .saker/settings.json before every update. Stop automatic updates when Brain is disabled. Tell me if you cannot save memory.'
    )
  ].join('\n\n')

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {active ? (
          <>
            <span className="text-xs text-muted-foreground">
              {t('saker.brainMemory.active', 'Brain enabled')}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setCopied(false)
                setError('')
                setOpen(true)
              }}
            >
              <MessageSquareText aria-hidden />{' '}
              {t('saker.brainMemory.chatMessage', 'Message for your chat')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !globallyEnabled}
              onClick={() =>
                void run(async () => {
                  const next = await window.api.sakerBrain.refreshProjectMap(project.id)
                  setCopied(false)
                  setError('')
                  setOpen(true)
                  return next
                })
              }
            >
              <FileSearch aria-hidden /> {t('saker.brainMemory.refreshMap', 'Refresh file map')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() => window.api.sakerBrain.setProjectEnabled(project.id, false))
              }
            >
              {t('saker.brainMemory.disable', 'Disable')}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !globallyEnabled || Boolean(project.error)}
            onClick={() =>
              void run(async () => {
                const next = await window.api.sakerBrain.initializeProject(project.id, true)
                setCopied(false)
                setError('')
                setOpen(true)
                return next
              })
            }
          >
            {t('saker.brainMemory.enable', 'Enable Brain')}
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent scrollable className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t('saker.brainMemory.title', 'Brain enabled in {{name}}', { name: project.name })}
            </DialogTitle>
            <DialogDescription>
              {t(
                'saker.brainMemory.description',
                'Instructions were added to AGENTS.md and CLAUDE.md, preserving existing content. Paste this message into your current chat to start using memory. New sessions in this directory can discover the guides. The agent must read and follow these instructions.'
              )}
            </DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            value={message}
            aria-label={t('saker.brainMemory.messageLabel', 'Message to enable Brain in your chat')}
            className="h-56 w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            {t(
              'saker.brainMemory.disableHelp',
              'You can disable Brain at any time. Notes are preserved and only the Saker instruction block is removed.'
            )}
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('saker.brainMemory.done', 'Done')}
            </Button>
            <Button
              onClick={() => {
                void window.api.ui
                  .writeClipboardText(message)
                  .then(() => {
                    setCopied(true)
                    setError('')
                  })
                  .catch(() =>
                    setError(
                      t(
                        'saker.brainMemory.copyError',
                        'Could not copy the message. Select and copy the text above.'
                      )
                    )
                  )
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied
                ? t('saker.brainMemory.copied', 'Copied')
                : t('saker.brainMemory.copy', 'Copy message')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
