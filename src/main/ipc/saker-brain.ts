import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { Repo } from '../../shared/repository/repo-types'
import type { SakerBrainState } from '../../shared/saker-brain'
import type { Store } from '../persistence/loading-store/store'
import { isTrustedMainRendererSender } from './main-renderer-sender-trust'
import {
  pathKey,
  readFile,
  revision,
  writeAtomic,
  createOnly,
  readSettings,
  profileDestination,
  legacyDestination,
  projectDestination
} from './saker-brain-files'
import { setManagedBrainInstructions } from './saker-brain-instructions'
import { createBrainTransferDialogs } from './saker-brain-transfer-dialogs'
import { refreshBrainFileMap } from './saker-brain-file-map'
import { eligibleRepos, projectName, readProject, snapshot } from './saker-brain-state'

const MAX_NOTE_LENGTH = 250_000
const MAX_UPDATE_LENGTH = 4_000
let trustedRendererId: number | null = null

export function setTrustedSakerBrainRendererWebContentsId(id: number | null): void {
  trustedRendererId = id
}

function projectTemplate(name: string): string {
  return [
    `# ${name} — Brain do projeto`,
    '',
    '## Resumo',
    '',
    '## Objetivos',
    '',
    '## Arquitetura',
    '',
    '## Estado atual',
    '',
    '## Decisões',
    '',
    '## Próximos passos',
    ''
  ].join('\n')
}

export function registerSakerBrainHandlers(
  store: Store,
  profileDirectory = app.getPath('userData')
): void {
  let queue = Promise.resolve()
  function handle<T>(action: string, run: (...args: unknown[]) => Promise<T>): void {
    ipcMain.handle(`saker-brain:${action}`, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (
        trustedRendererId === null ||
        !isTrustedMainRendererSender(event.sender, trustedRendererId) ||
        event.senderFrame !== event.sender.mainFrame
      ) {
        throw new Error('Brain is only available to the main workspace.')
      }
      const result = queue.then(() => run(...args))
      queue = result.then(
        () => undefined,
        () => undefined
      )
      return result
    })
  }
  function findProject(id: unknown): Repo {
    const repo = eligibleRepos(store).find((candidate) => candidate.id === id)
    if (!repo) {
      throw new Error('Unknown local project.')
    }
    return repo
  }
  async function requireEnabled(repo?: Repo): Promise<void> {
    const settings = readSettings<{ enabled?: boolean }>(
      await readFile(profileDestination(profileDirectory), 'settings.json')
    )
    if (settings.enabled === false || (repo && !(await readProject(repo)).enabled)) {
      throw new Error('Brain memory is disabled or unavailable.')
    }
  }

  const transfer = createBrainTransferDialogs({
    profile: profileDirectory,
    repos: () => eligibleRepos(store),
    parent: () =>
      BrowserWindow.getAllWindows().find((window) => window.webContents.id === trustedRendererId) ??
      null,
    requireEnabled
  })
  handle('export-archive', () => transfer.exportArchive())
  handle('pick-import-archive', () => transfer.pickImportArchive())
  handle('import-archive', async (selection) => {
    await transfer.applyImport(selection)
    return snapshot(store, profileDirectory)
  })

  handle('sync', () => snapshot(store, profileDirectory))
  handle('global-enabled', async (enabled) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('Invalid Brain preference.')
    }
    const destination = profileDestination(profileDirectory)
    const raw = await readFile(destination, 'settings.json')
    const settings = readSettings(raw)
    await writeAtomic(
      destination,
      'settings.json',
      `${JSON.stringify({ ...settings, enabled }, null, 2)}\n`,
      revision(raw)
    )
    if (!enabled) {
      for (const repo of eligibleRepos(store)) {
        const project = await readProject(repo)
        if (project.agentInstructions) {
          await setManagedBrainInstructions(repo, false)
        }
      }
    }
    return snapshot(store, profileDirectory)
  })
  handle('project-enabled', async (id, enabled) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('Invalid project preference.')
    }
    const repo = findProject(id)
    const destination = projectDestination(repo)
    const raw = await readFile(destination, 'settings.json')
    const settings = readSettings(raw)
    await writeAtomic(
      destination,
      'settings.json',
      `${JSON.stringify({ ...settings, enabled }, null, 2)}\n`,
      revision(raw)
    )
    if (!enabled) {
      await setManagedBrainInstructions(repo, false)
    }
    return snapshot(store, profileDirectory)
  })
  handle('initialize', async (id, guides) => {
    if (typeof guides !== 'boolean') {
      throw new Error('Invalid Brain setup request.')
    }
    const repo = findProject(id)
    await requireEnabled()
    const project = await readProject(repo)
    if (project.error) {
      throw new Error(project.error)
    }
    const destination = projectDestination(repo)
    await createOnly(destination, 'brain.md', projectTemplate(projectName(repo)))
    await createOnly(destination, 'updates.md', '# Project updates\n')
    await refreshBrainFileMap(repo)
    if (guides) {
      await setManagedBrainInstructions(repo, true)
    }
    return snapshot(store, profileDirectory)
  })
  handle('refresh-file-map', async (id) => {
    const repo = findProject(id)
    await requireEnabled(repo)
    await refreshBrainFileMap(repo)
    if ((await readProject(repo)).agentInstructions) {
      await setManagedBrainInstructions(repo, true)
    }
    return snapshot(store, profileDirectory)
  })
  handle('import-legacy', async () => {
    await requireEnabled()
    const destination = profileDestination(profileDirectory)
    const legacy = legacyDestination()
    if (pathKey(destination.folder) === pathKey(legacy.folder)) {
      throw new Error('The legacy note is already in this profile.')
    }
    const original = await readFile(legacy, 'general.md')
    if (original === null) {
      throw new Error('No legacy Brain note was found.')
    }
    await writeAtomic(destination, 'general.md', original, 'missing')
    return snapshot(store, profileDirectory)
  })
  const historySnapshot = async (id: string, updates: string | null): Promise<SakerBrainState> => {
    const state = await snapshot(store, profileDirectory)
    return {
      ...state,
      projects: state.projects.map((project) =>
        project.id === id
          ? { ...project, updates: updates ?? '', updatesRevision: revision(updates) }
          : project
      )
    }
  }
  handle('get-updates', async (id) => {
    const repo = findProject(id)
    return historySnapshot(repo.id, await readFile(projectDestination(repo), 'updates.md'))
  })
  handle('record-update', async (id, content, base) => {
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > MAX_UPDATE_LENGTH ||
      typeof base !== 'string'
    ) {
      throw new Error('Enter a reviewed update of up to 4,000 characters.')
    }
    const repo = findProject(id)
    await requireEnabled(repo)
    const destination = projectDestination(repo)
    if ((await readFile(destination, 'brain.md')) === null) {
      throw new Error('Set up project memory first.')
    }
    const previous = await readFile(destination, 'updates.md')
    const entry = content.replace(/\r\n/g, '\n').trim()
    const key = `<!-- saker-update:${revision(entry)} -->`
    if (previous?.includes(key)) {
      return historySnapshot(repo.id, previous)
    }
    const next = `${(previous ?? '# Project updates').trimEnd()}\n\n${key}\n## ${new Date()
      .toISOString()
      .slice(0, 10)}\n\n${entry}\n`
    await writeAtomic(destination, 'updates.md', next, base)
    return historySnapshot(repo.id, next)
  })
  handle('save', async (id, content, base) => {
    if (
      typeof content !== 'string' ||
      content.length > MAX_NOTE_LENGTH ||
      typeof base !== 'string'
    ) {
      throw new Error('Invalid Brain note or revision.')
    }
    const repo = id === 'global' ? undefined : findProject(id)
    await requireEnabled(repo)
    if (repo && base === 'missing') {
      throw new Error('Set up project memory before saving.')
    }
    await writeAtomic(
      repo ? projectDestination(repo) : profileDestination(profileDirectory),
      repo ? 'brain.md' : 'general.md',
      content,
      base
    )
    return snapshot(store, profileDirectory)
  })
}
