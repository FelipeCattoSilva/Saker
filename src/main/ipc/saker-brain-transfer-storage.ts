import { randomUUID } from 'node:crypto'
import type { Repo } from '../../shared/repository/repo-types'
import type { BrainTransferPackage, BrainTransferProject } from '../../shared/saker-brain-transfer'
import type { SakerBrainFileGraph } from '../../shared/saker-brain'
import {
  profileDestination,
  projectDestination,
  readFile,
  readSettings,
  revision,
  writeAtomic
} from './saker-brain-files'
import { readBrainSourceGraph } from './saker-brain-source-graph'
import { setManagedBrainInstructions } from './saker-brain-instructions'

export async function collectBrainTransfer(
  profile: string,
  repos: Repo[]
): Promise<BrainTransferPackage> {
  const general = await readFile(profileDestination(profile), 'general.md')
  const projects: BrainTransferProject[] = []
  for (const repo of repos) {
    const destination = projectDestination(repo)
    const brain = await readFile(destination, 'brain.md')
    if (brain === null) {
      continue
    }
    projects.push({
      id: `project-${projects.length + 1}`,
      name: (repo.displayName || repo.path.split(/[\\/]/).at(-1) || 'Projeto')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200),
      brain,
      updates: await readFile(destination, 'updates.md'),
      fileMap: await readFile(destination, 'file-map.md'),
      fileGraph: await readBrainSourceGraph(repo)
    })
  }
  if (general === null && !projects.length) {
    throw new Error('Nenhuma memória salva para exportar. Ative o Brain de um projeto primeiro.')
  }
  return {
    format: 'saker-brain',
    version: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    general,
    projects
  }
}
function mergeNote(
  current: string | null,
  incoming: string,
  packageId: string,
  name: string
): string {
  const marker = `<!-- saker-brain:import:${packageId} -->`
  if (
    current === incoming ||
    current?.includes(marker) ||
    (incoming.trim() && current?.includes(incoming))
  ) {
    return current ?? incoming
  }
  return current
    ? `${current}\n\n${marker}\n## Memória importada — ${name}\n\n${incoming}\n`
    : `${incoming}\n\n${marker}\n`
}
async function mergeFile(
  destination: ReturnType<typeof projectDestination>,
  file: string,
  incoming: string | null,
  id: string,
  name: string
): Promise<void> {
  if (incoming === null) {
    return
  }
  const current = await readFile(destination, file)
  const content =
    file === 'file-map.md' && current
      ? incoming
          .replaceAll('<!-- saker-brain:file-map:start -->', '')
          .replaceAll('<!-- saker-brain:file-map:end -->', '')
      : incoming
  const next = mergeNote(current, content, id, name)
  if (next !== current) {
    await writeAtomic(destination, file, next, revision(current))
  }
}
export async function importGeneralBrain(
  profile: string,
  packet: BrainTransferPackage
): Promise<void> {
  await mergeFile(
    profileDestination(profile),
    'general.md',
    packet.general,
    packet.id,
    'Brain geral'
  )
}
export async function importProjectBrain(
  repo: Repo,
  incoming: BrainTransferProject,
  packetId: string,
  activate: boolean
): Promise<void> {
  const destination = projectDestination(repo)
  await mergeFile(destination, 'brain.md', incoming.brain, packetId, incoming.name)
  await mergeFile(destination, 'updates.md', incoming.updates, packetId, incoming.name)
  await mergeFile(destination, 'file-map.md', incoming.fileMap, packetId, incoming.name)
  if (incoming.fileGraph) {
    const raw = await readFile(destination, 'file-graph.json')
    const current = await readBrainSourceGraph(repo)
    const files = [...new Set([...current.files, ...incoming.fileGraph.files])].slice(0, 600)
    const known = new Set(files)
    const links = new Map<string, { from: string; to: string }>()
    for (const edge of [...current.links, ...incoming.fileGraph.links]) {
      if (known.has(edge.from) && known.has(edge.to)) {
        links.set(JSON.stringify([edge.from, edge.to]), edge)
      }
    }
    const next: SakerBrainFileGraph = {
      files,
      links: [...links.values()].slice(0, 4000),
      partial: true,
      analyzed: false
    }
    await writeAtomic(
      destination,
      'file-graph.json',
      `${JSON.stringify(next, null, 2)}\n`,
      revision(raw)
    )
  }
  if (activate) {
    await setManagedBrainInstructions(repo, true)
  } else {
    const raw = await readFile(destination, 'settings.json')
    const settings = readSettings<{ enabled?: boolean }>(raw)
    if (settings.enabled === undefined) {
      await writeAtomic(
        destination,
        'settings.json',
        `${JSON.stringify({ ...settings, enabled: false }, null, 2)}\n`,
        revision(raw)
      )
    }
  }
}
