import { app } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fs, type Stats } from 'node:fs'
import path from 'node:path'
import { lock } from 'proper-lockfile'
import type { Repo } from '../../shared/repository/repo-types'

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export async function statIfPresent(target: string): Promise<Stats | null> {
  try {
    return await fs.lstat(target)
  } catch (error) {
    if (isMissing(error)) {
      return null
    }
    throw error
  }
}

export function pathKey(target: string): string {
  const normalized = path.resolve(target)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function checkRoot(root: string): Promise<void> {
  if (
    !path.isAbsolute(root) ||
    root.startsWith('\\\\') ||
    pathKey(await fs.realpath(root)) !== pathKey(root)
  ) {
    throw new Error('Brain requires a local root without symlinks or junctions.')
  }
  if (!(await fs.stat(root)).isDirectory()) {
    throw new Error('Brain root is unavailable.')
  }
}

type Destination = { root: string; folder: string }

async function checkFolder({ root, folder }: Destination, create = false): Promise<void> {
  await checkRoot(root)
  if (create) {
    await fs.mkdir(folder).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') {
        throw error
      }
    })
  }
  const stat = await statIfPresent(folder)
  if (stat && (!stat.isDirectory() || pathKey(await fs.realpath(folder)) !== pathKey(folder))) {
    throw new Error('Brain storage must be a real directory inside its root.')
  }
}

async function checkFile(destination: Destination, file: string): Promise<string> {
  await checkFolder(destination)
  const target = path.join(destination.folder, file)
  const stat = await statIfPresent(target)
  if (stat && (!stat.isFile() || pathKey(await fs.realpath(target)) !== pathKey(target))) {
    throw new Error('Brain requires regular files inside its storage directory.')
  }
  return target
}

export async function readFile(destination: Destination, file: string): Promise<string | null> {
  const target = await checkFile(destination, file)
  try {
    return await fs.readFile(target, 'utf8')
  } catch (error) {
    if (isMissing(error)) {
      return null
    }
    throw error
  }
}

export function revision(content: string | null): string {
  return content === null ? 'missing' : createHash('sha256').update(content).digest('hex')
}

export async function writeAtomic(
  destination: Destination,
  file: string,
  content: string,
  base?: string
): Promise<void> {
  await checkFolder(destination, true)
  const target = await checkFile(destination, file)
  let compromised: Error | undefined
  const release = await lock(target, {
    realpath: false,
    retries: { retries: 5, minTimeout: 20, maxTimeout: 200 },
    onCompromised: (error) => {
      compromised = error
    }
  })
  const temporary = path.join(destination.folder, `.${randomUUID()}.tmp`)
  try {
    await fs.writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    if (base !== undefined && revision(await readFile(destination, file)) !== base) {
      throw new Error('This note changed on disk. Copy your draft before reloading the note.')
    }
    await checkFile(destination, file)
    if (compromised) {
      throw compromised
    }
    if (base === 'missing') {
      try {
        await fs.link(temporary, target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error('This note changed on disk. Copy your draft before reloading the note.')
        }
        throw error
      }
    } else {
      await fs.rename(temporary, target)
    }
  } finally {
    await fs.rm(temporary, { force: true }).finally(async () => {
      if (!compromised) {
        await release()
      }
    })
  }
}

export async function createOnly(
  destination: Destination,
  file: string,
  text: string
): Promise<void> {
  if ((await readFile(destination, file)) === null) {
    try {
      await writeAtomic(destination, file, text, 'missing')
    } catch (error) {
      if ((await readFile(destination, file)) === null) {
        throw error
      }
    }
  }
}

export function readSettings<T extends object>(text: string | null): T {
  if (text === null) {
    return {} as T
  }
  const data: unknown = JSON.parse(text)
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid Brain settings file.')
  }
  return data as T
}

export function profileDestination(root: string): Destination {
  return { root, folder: path.join(root, 'brain') }
}

export function legacyDestination(): Destination {
  const root = path.join(app.getPath('appData'), 'Saker')
  return { root, folder: path.join(root, 'brain') }
}

export function projectDestination(repo: Repo): Destination {
  const root = path.resolve(repo.path)
  return { root, folder: path.join(root, '.saker') }
}
