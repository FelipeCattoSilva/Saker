import type { Repo } from '../../shared/repository/repo-types'
import {
  readFile,
  revision,
  writeAtomic,
  projectDestination,
  readSettings
} from './saker-brain-files'

const START = '<!-- saker-brain:instructions:start -->'
const END = '<!-- saker-brain:instructions:end -->'
const FILES = ['AGENTS.md', 'CLAUDE.md'] as const
const LEGACY_GUIDE = `${[
  '# Saker Brain — agent instructions',
  '',
  'Read .saker/brain.md for verified project context before working.',
  'After significant verified changes, propose a concise Markdown update for human review.',
  'Distinguish facts, decisions and hypotheses. Include verification or file references.',
  'Omit credentials, private data and transcripts. Preserve human documentation.'
].join('\n')}\n`

const INSTRUCTIONS = [
  START,
  '## Saker Brain — project memory',
  '',
  'At the start of each session in this project, read .saker/settings.json.',
  'If either enabled or agentInstructions is false, do not read or update Brain memory automatically.',
  'Otherwise read .saker/brain.md before planning or editing. Consult .saker/updates.md and referenced files when needed.',
  'When locating code, consult .saker/file-map.md and verified feature-to-file paths in brain.md before running broad repository searches. Open the recorded files directly and verify that they still exist.',
  'Record verified feature ownership (for example, checkout page, route, component and payment handler) with exact relative paths and important symbols in brain.md. Do not invent responsibilities from filenames alone.',
  'Keep .saker/file-map.md current when adding, moving or deleting files. Preserve notes outside its generated block. Search the repository only when a recorded path is missing, stale or insufficient.',
  'After each completed turn with new relevant information, update .saker/brain.md with verified progress, decisions and next steps.',
  'Include important user requirements even when no code changed. Mark hypotheses and unverified claims explicitly.',
  'Append a short dated checkpoint to .saker/updates.md, including verification results and unresolved work.',
  'Before compaction or ending a session, save a checkpoint when possible. On a new session, use the latest checkpoint to continue.',
  'Keep the main Brain concise. Do not copy full conversations, repeated status messages, credentials, personal data or secrets.',
  'Preserve human notes. Reread before writing, merge concurrent changes and never replace newer content with a stale copy.',
  'Recheck .saker/settings.json before every update. If disabled or inaccessible, stop automatic updates.',
  'If you cannot save memory, tell the user explicitly. Do not claim it was saved.',
  END
].join('\n')

function managedRange(content: string): { start: number; end: number } | null {
  const start = content.indexOf(START)
  const end = content.indexOf(END)
  if (start === -1 && end === -1) {
    return null
  }
  if (
    start === -1 ||
    end < start ||
    content.includes(START, start + START.length) ||
    content.includes(END, end + END.length)
  ) {
    throw new Error(
      'The Saker instruction block is incomplete or duplicated. Review the agent guide before changing Brain setup.'
    )
  }
  return { start, end: end + END.length }
}

function instructionsContent(original: string, enabled: boolean): string {
  const range = managedRange(original)
  if (!range) {
    if (!enabled) {
      return original
    }
    if (original === LEGACY_GUIDE) {
      return `${INSTRUCTIONS}\n`
    }
    return `${original}${original ? '\n\n' : ''}${INSTRUCTIONS}\n`
  }
  return original.slice(0, range.start) + (enabled ? INSTRUCTIONS : '') + original.slice(range.end)
}

export async function hasManagedBrainInstructions(repo: Repo): Promise<boolean> {
  const destination = projectDestination(repo)
  const root = { root: destination.root, folder: destination.root }
  const guides = await Promise.all(FILES.map((name) => readFile(root, name)))
  return guides.every((guide) => guide !== null && managedRange(guide) !== null)
}

export async function setManagedBrainInstructions(repo: Repo, enabled: boolean): Promise<void> {
  const destination = projectDestination(repo)
  const root = { root: destination.root, folder: destination.root }
  const plans = await Promise.all(
    FILES.map(async (name) => {
      const previous = await readFile(root, name)
      return { name, previous, next: instructionsContent(previous ?? '', enabled) }
    })
  )
  const raw = await readFile(destination, 'settings.json')
  const settings = readSettings(raw)
  await writeAtomic(
    destination,
    'settings.json',
    `${JSON.stringify({ ...settings, agentInstructions: false }, null, 2)}\n`,
    revision(raw)
  )
  for (const { name, previous, next } of plans) {
    if ((previous ?? '') !== next) {
      await writeAtomic(root, name, next, revision(previous))
    }
  }
  if (enabled) {
    const disabled = await readFile(destination, 'settings.json')
    const current = readSettings(disabled)
    await writeAtomic(
      destination,
      'settings.json',
      `${JSON.stringify({ ...current, enabled: true, agentInstructions: true }, null, 2)}\n`,
      revision(disabled)
    )
  }
}
