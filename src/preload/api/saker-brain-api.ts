import type { BrainTransferApi } from '../../shared/saker-brain-transfer'
import type { SakerBrainState } from '../../shared/saker-brain'

export type { SakerBrainState } from '../../shared/saker-brain'

export type SakerBrainApi = BrainTransferApi & {
  get: () => Promise<SakerBrainState>
  setGlobalEnabled: (enabled: boolean) => Promise<SakerBrainState>
  setProjectEnabled: (id: string, enabled: boolean) => Promise<SakerBrainState>
  initializeProject: (id: string, guides: boolean) => Promise<SakerBrainState>
  refreshProjectMap: (id: string) => Promise<SakerBrainState>
  getUpdates: (id: string) => Promise<SakerBrainState>
  recordUpdate: (id: string, content: string, revision: string) => Promise<SakerBrainState>
  importLegacy: () => Promise<SakerBrainState>
  save: (id: string, content: string, revision: string) => Promise<SakerBrainState>
}
