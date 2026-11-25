import { ipcRenderer } from 'electron'
import type { SakerBrainApi } from './saker-brain-api'

export const sakerBrainApi: SakerBrainApi = {
  exportArchive: () => ipcRenderer.invoke('saker-brain:export-archive'),
  pickImportArchive: () => ipcRenderer.invoke('saker-brain:pick-import-archive'),
  importArchive: (selection) => ipcRenderer.invoke('saker-brain:import-archive', selection),
  get: () => ipcRenderer.invoke('saker-brain:sync'),
  setGlobalEnabled: (enabled) => ipcRenderer.invoke('saker-brain:global-enabled', enabled),
  setProjectEnabled: (id, enabled) =>
    ipcRenderer.invoke('saker-brain:project-enabled', id, enabled),
  initializeProject: (id, guides) => ipcRenderer.invoke('saker-brain:initialize', id, guides),
  refreshProjectMap: (id) => ipcRenderer.invoke('saker-brain:refresh-file-map', id),
  getUpdates: (id) => ipcRenderer.invoke('saker-brain:get-updates', id),
  recordUpdate: (id, content, revision) =>
    ipcRenderer.invoke('saker-brain:record-update', id, content, revision),
  importLegacy: () => ipcRenderer.invoke('saker-brain:import-legacy'),
  save: (id, content, revision) => ipcRenderer.invoke('saker-brain:save', id, content, revision)
}
