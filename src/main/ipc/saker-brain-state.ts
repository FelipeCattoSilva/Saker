import { app } from 'electron'
import path from 'node:path'
import { isRepoOnCatalogHost } from '../../shared/execution-host'
import type { Repo } from '../../shared/repository/repo-types'
import type { SakerBrainProject, SakerBrainState } from '../../shared/saker-brain'
import type { Store } from '../persistence/loading-store/store'
import { visibleRepos } from '../persistence/migrating-orcad-catalog/source/catalog/orcad-source-visibility'
import {
  legacyDestination,
  pathKey,
  profileDestination,
  projectDestination,
  readFile,
  readSettings,
  revision,
  statIfPresent
} from './saker-brain-files'

import { readBrainSourceGraph } from './saker-brain-source-graph'
import { hasManagedBrainInstructions } from './saker-brain-instructions'

const GENERAL_NOTE =
  '# Saker — Brain geral\n\n## Objetivo\n\n## Decisões compartilhadas\n\n## Forma de trabalho\n'
export function eligibleRepos(store: Store): Repo[] {
  const userHome = app.getPath('home')
  return visibleRepos(store).filter((repo) => {
    if (!isRepoOnCatalogHost(repo) || !path.isAbsolute(repo.path) || repo.path.startsWith('\\\\')) {
      return false
    }
    const protectedFolders = [
      path.parse(repo.path).root,
      userHome,
      path.join(userHome, 'Desktop'),
      path.join(userHome, 'Downloads'),
      path.join(userHome, 'Documents'),
      process.env.WINDIR,
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)']
    ]
    return !protectedFolders.some((folder) => folder && pathKey(folder) === pathKey(repo.path))
  })
}

export function projectName(repo: Repo): string {
  const name = repo.displayName || path.basename(repo.path)
  return Array.from(name)
    .filter((character) => character.charCodeAt(0) >= 32 && character !== '<' && character !== '>')
    .slice(0, 90)
    .join('')
}

function summarize(content: string): string {
  return (
    content
      .match(/^## (?:Summary|Resumo)\s*\r?\n([^#\r\n][^\r\n]*)/m)?.[1]
      .trim()
      .slice(0, 180) ?? ''
  )
}

export async function readProject(repo: Repo): Promise<SakerBrainProject> {
  const destination = projectDestination(repo)
  const project = { id: repo.id, name: projectName(repo), path: repo.path }
  try {
    const [note, rawSettings] = await Promise.all([
      readFile(destination, 'brain.md'),
      readFile(destination, 'settings.json')
    ])
    const settings = readSettings<{ enabled?: boolean; agentInstructions?: boolean }>(rawSettings)
    const agentInstructions =
      settings.agentInstructions === true && (await hasManagedBrainInstructions(repo))
    return {
      ...project,
      enabled: settings.enabled !== false,
      initialized: note !== null,
      agentInstructions,
      fileGraph: note === null ? undefined : await readBrainSourceGraph(repo),
      content: note ?? '',
      summary: summarize(note ?? ''),
      revision: revision(note),
      instructionStatus: agentInstructions
        ? 'Instruções do agente ativas'
        : note === null
          ? 'Ainda não ativado'
          : 'Memória disponível'
    }
  } catch (error) {
    return {
      ...project,
      enabled: false,
      initialized: false,
      content: '',
      summary: '',
      revision: 'missing',
      instructionStatus: 'Indisponível',
      error: error instanceof Error ? error.message : 'Project memory is unavailable.'
    }
  }
}

export async function snapshot(store: Store, profileDirectory: string): Promise<SakerBrainState> {
  const destination = profileDestination(profileDirectory)
  const [rawSettings, globalNote] = await Promise.all([
    readFile(destination, 'settings.json'),
    readFile(destination, 'general.md')
  ])
  const config = readSettings<Partial<SakerBrainState['config']>>(rawSettings)
  const legacy = legacyDestination()
  const legacyAvailable =
    globalNote === null &&
    pathKey(destination.folder) !== pathKey(legacy.folder) &&
    (await statIfPresent(path.join(legacy.folder, 'general.md')))?.isFile() === true
  const projects: SakerBrainProject[] = []
  const repos = eligibleRepos(store)
  for (let offset = 0; offset < repos.length; offset += 16) {
    projects.push(...(await Promise.all(repos.slice(offset, offset + 16).map(readProject))))
  }
  const index = [
    '# Saker — Project Index',
    '',
    ...projects.map((project) => {
      const status = project.initialized && project.enabled && config.enabled !== false
      return `- ${project.name}${status && project.summary ? ` — ${project.summary}` : ''}`
    })
  ].join('\n')
  return {
    config: {
      enabled: config.enabled !== false,
      agentInstructions: config.agentInstructions !== false
    },
    global: globalNote ?? GENERAL_NOTE,
    globalRevision: revision(globalNote),
    legacyAvailable,
    index,
    projects
  }
}
