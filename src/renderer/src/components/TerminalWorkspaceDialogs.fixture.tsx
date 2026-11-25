import { defineFixture } from '../component-fixtures/component-fixture'
import { TerminalWorkspaceDialogs } from './TerminalWorkspaceDialogs'
import type { TerminalController } from './use-terminal-controller'

const controller = {
  confirmNativeWindowClose: async () => {},
  handleSaveDialogCancel: () => {},
  handleSaveDialogDiscard: () => {},
  handleSaveDialogSave: () => {},
  saveDialogFile: null,
  saveDialogFileId: null,
  setWindowCloseDialogOpen: () => {},
  windowCloseDialogKind: 'running',
  windowCloseDialogOpen: true
} as unknown as TerminalController

export const closeWindow = defineFixture({
  width: 560,
  render: () => (
    <div style={{ height: 320 }}>
      <TerminalWorkspaceDialogs controller={controller} />
    </div>
  )
})

export const unsavedFile = defineFixture({
  width: 560,
  render: () => (
    <div style={{ height: 320 }}>
      <TerminalWorkspaceDialogs
        controller={{
          ...controller,
          windowCloseDialogOpen: false,
          saveDialogFileId: 'fixture-file'
        }}
      />
    </div>
  )
})
