import type { SakerBrainFileGraph, SakerBrainState } from './saker-brain'

export type BrainTransferProject = {
  id: string
  name: string
  brain: string
  updates: string | null
  fileMap: string | null
  fileGraph?: SakerBrainFileGraph
}
export type BrainTransferPackage = {
  format: 'saker-brain'
  version: 1
  id: string
  createdAt: string
  general: string | null
  projects: BrainTransferProject[]
}
export type BrainImportPreview = {
  token: string
  fileName: string
  compressedBytes: number
  generalAvailable: boolean
  projects: { id: string; name: string; files: number }[]
}
export type BrainImportSelection = {
  token: string
  general: boolean
  activate: boolean
  mappings: { sourceId: string; projectId: string }[]
}
export type BrainExportResult = { bytes: number; projects: number } | null
export type BrainTransferApi = {
  exportArchive: () => Promise<BrainExportResult>
  pickImportArchive: () => Promise<BrainImportPreview | null>
  importArchive: (selection: BrainImportSelection) => Promise<SakerBrainState>
}
