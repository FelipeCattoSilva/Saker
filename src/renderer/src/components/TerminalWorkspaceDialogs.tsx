import { Files, LogOut } from 'lucide-react'
import { basename } from '../lib/path'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { TerminalController } from './use-terminal-controller'

export function TerminalWorkspaceDialogs({
  controller
}: {
  controller: TerminalController
}): React.JSX.Element {
  const t = useTranslate()
  const {
    confirmNativeWindowClose,
    handleSaveDialogCancel,
    handleSaveDialogDiscard,
    handleSaveDialogSave,
    saveDialogFile,
    saveDialogFileId,
    setWindowCloseDialogOpen,
    windowCloseDialogKind,
    windowCloseDialogOpen
  } = controller
  const cancelWindowClose = (): void => {
    setWindowCloseDialogOpen(false)
    window.api.ui.cancelWindowClose()
  }
  return (
    <>
      <Dialog
        open={saveDialogFileId !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleSaveDialogCancel()
          }
        }}
      >
        <DialogContent size="compact" className="saker-confirmation-dialog" showCloseButton={false}>
          <DialogHeader className="flex-row items-start gap-3">
            <div className="saker-confirmation-icon">
              <Files className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="text-sm">
                {t('auto.components.Terminal.21295c6b8c', 'Unsaved Changes')}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {saveDialogFile
                  ? t(
                      'auto.components.Terminal.61ed600d29',
                      '"{{value0}}" has unsaved changes. Do you want to save before closing?',
                      { value0: basename(saveDialogFile.relativePath) }
                    )
                  : t('auto.components.Terminal.46e08bc5c8', 'This file has unsaved changes.')}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleSaveDialogCancel}>
              {t('auto.components.Terminal.f82e9f02df', 'Cancel')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleSaveDialogDiscard}>
              {t('auto.components.Terminal.0037b21794', "Don't Save")}
            </Button>
            <Button type="button" size="sm" onClick={handleSaveDialogSave}>
              {t('auto.components.Terminal.cd51e28d8b', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={windowCloseDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelWindowClose()
          }
        }}
      >
        <DialogContent size="compact" className="saker-confirmation-dialog" showCloseButton={false}>
          <DialogHeader className="flex-row items-start gap-3">
            <div className="saker-confirmation-icon">
              <LogOut className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="text-sm">
                {t('auto.components.Terminal.2fa9c69ff3', 'Close Window?')}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {windowCloseDialogKind === 'unverifiable'
                  ? t(
                      'auto.components.Terminal.b7c1f0a934',
                      'A remote host could not be reached, so Orca cannot tell whether work is still running there. Close the window anyway?'
                    )
                  : t(
                      'auto.components.Terminal.93c2e9d845',
                      'There is running work in chats or terminals. Close the window anyway?'
                    )}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancelWindowClose}>
              {t('auto.components.Terminal.f82e9f02df', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              autoFocus
              onClick={() => {
                setWindowCloseDialogOpen(false)
                void confirmNativeWindowClose()
              }}
            >
              {t('auto.components.Terminal.73768427cf', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
