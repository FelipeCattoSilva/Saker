import { promises as fs } from 'node:fs'
import path from 'node:path'
import { writeBrainSourceGraph } from './saker-brain-source-graph'
import type { Repo } from '../../shared/repository/repo-types'
import { pathKey, projectDestination, readFile, revision, writeAtomic } from './saker-brain-files'

const START = '<!-- saker-brain:file-map:start -->'
const END = '<!-- saker-brain:file-map:end -->'
const SKIP = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'coverage',
  'target',
  'bin',
  'obj',
  '__pycache__',
  'venv'
])
const SOURCE =
  /\.(?:[cm]?[jt]sx?|vue|svelte|astro|liquid|twig|ejs|hbs|erb|html?|css|scss|sass|less|json|md|mdx|php|py|rb|go|rs|java|cs|sql|ya?ml|toml|graphql|prisma)$/i
const MAX_FILES = 600
const MAX_ENTRIES = 6000
const MAX_DEPTH = 10

function displayPath(value: string): string {
  return value.replaceAll('`', '\\`')
}

async function scanPaths(
  root: string
): Promise<{ files: string[]; directories: string[]; partial: boolean }> {
  const queue = [{ folder: root, relative: '', depth: 0 }]
  const files: string[] = []
  const directories: string[] = []
  let visited = 0
  let partial = false
  while (queue.length && files.length < MAX_FILES && visited < MAX_ENTRIES) {
    const current = queue.shift()!
    try {
      if (
        pathKey(await fs.realpath(current.folder)) !== pathKey(current.folder) ||
        (await fs.lstat(current.folder)).isSymbolicLink()
      ) {
        partial = true
        continue
      }
      const entries = await fs.readdir(current.folder, { withFileTypes: true })
      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        if (++visited > MAX_ENTRIES || files.length >= MAX_FILES) {
          partial = true
          break
        }
        if (
          entry.name.startsWith('.') ||
          Array.from(entry.name).some((character) => character.charCodeAt(0) < 32) ||
          entry.isSymbolicLink()
        ) {
          continue
        }
        const relative = current.relative ? `${current.relative}/${entry.name}` : entry.name
        if (entry.isDirectory() && !SKIP.has(entry.name.toLowerCase())) {
          if (current.depth < 2) {
            directories.push(`${relative}/`)
          }
          if (current.depth < MAX_DEPTH) {
            queue.push({
              folder: path.join(current.folder, entry.name),
              relative,
              depth: current.depth + 1
            })
          } else {
            partial = true
          }
        } else if (
          entry.isFile() &&
          SOURCE.test(entry.name) &&
          !/(?:^|[._-])(?:env|credentials?|secrets?)(?:[._-]|$)/i.test(entry.name)
        ) {
          files.push(relative)
        }
      }
    } catch {
      partial = true
    }
  }
  return { files, directories, partial: partial || queue.length > 0 }
}

function mergeMap(previous: string | null, generated: string): string {
  if (!previous) {
    return `# Mapa de arquivos / File map\n\n${generated}\n`
  }
  const start = previous.indexOf(START)
  const end = previous.indexOf(END)
  if (start === -1 && end === -1) {
    return `${previous}\n\n${generated}\n`
  }
  if (
    start === -1 ||
    end < start ||
    previous.includes(START, start + START.length) ||
    previous.includes(END, end + END.length)
  ) {
    throw new Error(
      'The managed file map block is incomplete or duplicated. Review .saker/file-map.md before refreshing it.'
    )
  }
  return previous.slice(0, start) + generated + previous.slice(end + END.length)
}

export async function refreshBrainFileMap(repo: Repo): Promise<void> {
  const destination = projectDestination(repo)
  const note = await readFile(destination, 'brain.md')
  if (note === null) {
    throw new Error('Set up project memory before generating its file map.')
  }
  const previous = await readFile(destination, 'file-map.md')
  const { files, directories, partial } = await scanPaths(destination.root)
  const candidates = files.filter((file) =>
    /checkout|payment|pagamento|finalizar|carrinho|cart/i.test(file)
  )
  const generated = [
    START,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Path inventory only; source contents were not analyzed. Verify the chosen path before editing.',
    'Use recorded paths before broad repository searches. Add verified feature-to-file mappings outside this generated block.',
    'Refresh after files are added, renamed or removed. Dependencies, build output, hidden files, links and credential-like names are excluded.',
    partial
      ? 'Partial inventory: scan limits or inaccessible directories were reached. Search only missing areas as needed.'
      : 'Inventory completed within the scan limits.',
    '',
    '## Checkout / payment paths (name matches, not verified responsibilities)',
    ...(candidates.length
      ? candidates.map((file) => `- \`${displayPath(file)}\``)
      : [
          'No matching path names. Record verified checkout files after inspecting the relevant code.'
        ]),
    '',
    '## Directories',
    ...directories.map((directory) => `- \`${displayPath(directory)}\``),
    '',
    '## Source and configuration paths',
    ...files.map((file) => `- \`${displayPath(file)}\``),
    END
  ].join('\n')
  await writeAtomic(destination, 'file-map.md', mergeMap(previous, generated), revision(previous))
  await writeBrainSourceGraph(repo, files, partial)
  if (!note.includes('.saker/file-map.md')) {
    await writeAtomic(
      destination,
      'brain.md',
      `${note}\n\n## Mapa de arquivos\n\nConsulte \`.saker/file-map.md\` antes de procurar a estrutura novamente. Registre aqui os caminhos verificados de cada funcionalidade e mantenha o mapa atualizado ao criar, mover ou remover arquivos.\n`,
      revision(note)
    )
  }
}
