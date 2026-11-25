import { promises as fs } from 'node:fs'
import path from 'node:path'
import { init, parse } from 'es-module-lexer'
import { parse as parseJsonc, type ParseError } from 'jsonc-parser'
import type { Repo } from '../../shared/repository/repo-types'
import type { SakerBrainFileGraph } from '../../shared/saker-brain'
import { projectDestination, readFile, revision, writeAtomic } from './saker-brain-files'

const EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.vue',
  '.svelte',
  '.astro'
]
function safeRelative(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length < 1000 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.includes(':') &&
    !value.split('/').some((part) => part === '..' || part.startsWith('.'))
  )
}
type ImportPaths = { baseUrl?: string; paths: [string, string[]][] }
async function readImportPaths(repo: Repo): Promise<ImportPaths> {
  const root = projectDestination(repo).root
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    try {
      const stat = await fs.stat(path.join(root, name))
      if (stat.size > 256 * 1024) {
        continue
      }
      const raw = await readFile({ root, folder: root }, name)
      const errors: ParseError[] = []
      const config = parseJsonc(raw ?? '{}', errors) as {
        compilerOptions?: { baseUrl?: unknown; paths?: Record<string, unknown> }
      }
      if (errors.length) {
        continue
      }
      const options = config?.compilerOptions
      const paths: ImportPaths['paths'] = Object.entries(options?.paths ?? {}).flatMap(
        ([alias, targets]) =>
          Array.isArray(targets)
            ? [[alias, targets.filter((target): target is string => typeof target === 'string')]]
            : []
      )
      paths.sort((a, b) => b[0].length - a[0].length)
      return { baseUrl: typeof options?.baseUrl === 'string' ? options.baseUrl : undefined, paths }
    } catch {
      /* No usable local import configuration. */
    }
  }
  return { paths: [] }
}
function resolveImport(
  from: string,
  raw: string,
  known: Set<string>,
  config: ImportPaths
): string | undefined {
  const specifier = raw.split(/[?#]/, 1)[0]
  const targets: string[] = []
  if (specifier.startsWith('.')) {
    targets.push(path.posix.join(path.posix.dirname(from), specifier))
  } else {
    for (const [alias, values] of config.paths) {
      const star = alias.indexOf('*')
      const prefix = star === -1 ? alias : alias.slice(0, star)
      const suffix = star === -1 ? '' : alias.slice(star + 1)
      if (
        star === -1
          ? specifier !== alias
          : !specifier.startsWith(prefix) || !specifier.endsWith(suffix)
      ) {
        continue
      }
      const captured =
        star === -1 ? '' : specifier.slice(prefix.length, specifier.length - suffix.length)
      targets.push(
        ...values.map((value) =>
          path.posix.join(config.baseUrl ?? '.', value.replace('*', captured))
        )
      )
      break
    }
    if (config.baseUrl !== undefined) {
      targets.push(path.posix.join(config.baseUrl, specifier))
    }
  }
  for (const value of targets) {
    const target = path.posix.normalize(value)
    if (!safeRelative(target)) {
      continue
    }
    const resolved = [
      target,
      ...EXTENSIONS.map((ext) => target + ext),
      ...EXTENSIONS.map((ext) => `${target}/index${ext}`),
      ...(/\.[cm]?js$/.test(target)
        ? [target.replace(/\.[cm]?js$/, '.ts'), target.replace(/\.[cm]?js$/, '.tsx')]
        : [])
    ].find((candidate) => known.has(candidate))
    if (resolved) {
      return resolved
    }
  }
  return undefined
}

export async function writeBrainSourceGraph(
  repo: Repo,
  files: string[],
  scanPartial: boolean
): Promise<void> {
  const destination = projectDestination(repo)
  const previous = await readFile(destination, 'file-graph.json')
  const known = new Set(files.filter(safeRelative))
  const links: SakerBrainFileGraph['links'] = []
  let remaining = 8 * 1024 * 1024
  let partial = scanPartial
  const importPaths = await readImportPaths(repo)
  await init
  for (const file of known) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) {
      continue
    }
    const folder = path.join(destination.root, path.posix.dirname(file))
    try {
      const stat = await fs.stat(path.join(destination.root, file))
      if (stat.size > 256 * 1024 || stat.size > remaining || links.length >= 4000) {
        partial = true
        continue
      }
      const content = await readFile({ root: destination.root, folder }, path.posix.basename(file))
      if (content === null) {
        partial = true
        continue
      }
      remaining -= Buffer.byteLength(content)
      const [imports] = parse(content)
      const targets = new Set<string>()
      for (const reference of imports) {
        const target = reference.n && resolveImport(file, reference.n, known, importPaths)
        if (target && target !== file) {
          targets.add(target)
        }
      }
      for (const to of targets) {
        if (links.length >= 4000) {
          partial = true
          break
        }
        links.push({ from: file, to })
      }
    } catch {
      partial = true
    }
  }
  const graph: SakerBrainFileGraph = { files: [...known], links, partial, analyzed: true }
  await writeAtomic(
    destination,
    'file-graph.json',
    `${JSON.stringify(graph, null, 2)}\n`,
    revision(previous)
  )
}

export async function readBrainSourceGraph(repo: Repo): Promise<SakerBrainFileGraph> {
  const destination = projectDestination(repo)
  const raw = await readFile(destination, 'file-graph.json')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SakerBrainFileGraph>
      const files = Array.isArray(parsed.files)
        ? parsed.files.filter(safeRelative).slice(0, 600)
        : []
      const known = new Set(files)
      const links = Array.isArray(parsed.links)
        ? parsed.links
            .filter((edge) => edge && known.has(edge.from) && known.has(edge.to))
            .slice(0, 4000)
        : []
      if (Array.isArray(parsed.files)) {
        return {
          files,
          links,
          partial: parsed.partial === true,
          analyzed: parsed.analyzed === true
        }
      }
    } catch {
      /* Fall back to the existing Markdown inventory. */
    }
  }
  const map = await readFile(destination, 'file-map.md')
  const files = [
    ...new Set(
      Array.from((map ?? '').matchAll(/^- `([^`\n]+)`\s*$/gm), (match) => match[1]).filter(
        (file) => safeRelative(file) && !file.endsWith('/')
      )
    )
  ].slice(0, 600)
  return { files, links: [], partial: true, analyzed: false }
}
