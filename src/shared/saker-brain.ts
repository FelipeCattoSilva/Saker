export type SakerBrainFileGraph = {
  files: string[]
  links: { from: string; to: string }[]
  partial: boolean
  analyzed: boolean
}

export type SakerBrainProject = {
  id: string
  name: string
  path: string
  fileGraph?: SakerBrainFileGraph
  summary: string
  enabled: boolean
  content: string
  instructionStatus: string
  initialized?: boolean
  agentInstructions?: boolean
  revision?: string
  updates?: string
  updatesRevision?: string
  error?: string
}

export type SakerBrainState = {
  config: { enabled: boolean; agentInstructions: boolean }
  global: string
  globalRevision?: string
  legacyAvailable?: boolean
  index: string
  projects: SakerBrainProject[]
}
