import { defineFixture } from '../../component-fixtures/component-fixture'
import { SakerBrainTransfer } from './SakerBrainTransfer'
import type { SakerBrainState } from '../../../../shared/saker-brain'

const brain: SakerBrainState = {
  config: { enabled: true, agentInstructions: true },
  global: '',
  index: '',
  projects: [
    {
      id: 'local-store',
      name: 'Loja',
      path: 'D:/Sites/loja',
      summary: '',
      enabled: true,
      content: '',
      instructionStatus: ''
    }
  ]
}
export const importPreview = defineFixture({
  width: 760,
  render: () => (
    <div className="flex h-96 items-start p-6">
      <SakerBrainTransfer
        brain={brain}
        busy={false}
        run={async (action) => {
          await action()
        }}
        api={{
          exportArchive: async () => ({ bytes: 2048, projects: 1 }),
          pickImportArchive: async () => ({
            token: 'fixture',
            fileName: 'Saker-Brain.sakerbrain',
            compressedBytes: 2048,
            generalAvailable: true,
            projects: [{ id: 'project-1', name: 'Loja', files: 128 }]
          }),
          importArchive: async () => brain
        }}
      />
    </div>
  ),
  interact: (frame) => {
    frame
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Import Brain"],button[aria-label="Importar Brain"]'
      )
      ?.click()
  }
})
