import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Store } from '../persistence/loading-store/store'
import type { SakerBrainState } from '../../shared/saker-brain'
import {
  registerSakerBrainHandlers,
  setTrustedSakerBrainRendererWebContentsId
} from './saker-brain'

const { paths, handlers, repos } = vi.hoisted(() => ({
  paths: new Map<string, string>(),
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<SakerBrainState>>(),
  repos: [] as { id: string; displayName: string; path: string; connectionId?: string }[]
}))

vi.mock('electron', () => ({
  app: { getPath: (name: string) => paths.get(name) },
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, ...args: unknown[]) => Promise<SakerBrainState>
    ) => handlers.set(channel, handler)
  }
}))
vi.mock('../persistence/migrating-orcad-catalog/source/catalog/orcad-source-visibility', () => ({
  visibleRepos: () => repos
}))

const frame = {}
function invoke(channel: string, ...args: unknown[]): Promise<SakerBrainState> {
  return Promise.resolve().then(() =>
    handlers.get(`saker-brain:${channel}`)!(
      {
        sender: { id: 92, mainFrame: frame, isDestroyed: () => false, getType: () => 'window' },
        senderFrame: frame
      },
      ...args
    )
  )
}

let root: string
let profile: string
let project: string
let external: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'saker-brain-test-'))
  profile = path.join(root, 'profile')
  project = path.join(root, 'project')
  external = path.join(root, 'outside-project')
  await Promise.all([profile, project, external].map((dir) => fs.mkdir(dir)))
  paths.set('home', root)
  paths.set('appData', root)
  repos.splice(0, repos.length, { id: 'local-1', displayName: 'Local', path: project })
  setTrustedSakerBrainRendererWebContentsId(92)
  registerSakerBrainHandlers({} as Store, profile)
})

afterEach(async () => {
  handlers.clear()
  paths.clear()
  await fs.rm(root, { recursive: true, force: true })
})

describe('Saker Brain project memory', () => {
  it('reads without writing and derives the allowed catalog in Main', async () => {
    repos.push({ id: 'ssh-1', displayName: 'Remote', path: external, connectionId: 'host' })
    const snapshot = await invoke('sync', [{ id: 'foreign', path: external, name: 'Injected' }])
    expect(snapshot.projects.map(({ id }) => id)).toEqual(['local-1'])
    expect(await fs.readdir(profile)).toEqual([])
    expect(await fs.readdir(project)).toEqual([])
    expect(await fs.readdir(external)).toEqual([])
    await expect(invoke('initialize', 'ssh-1', false)).rejects.toThrow('Unknown local project')
    setTrustedSakerBrainRendererWebContentsId(93)
    await expect(invoke('sync')).rejects.toThrow('main workspace')
  })

  it('rejects a linked Brain directory without writing into its destination', async () => {
    await fs.symlink(
      external,
      path.join(project, '.saker'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    const snapshot = await invoke('sync')
    expect(snapshot.projects[0].error).toContain('real directory')
    await expect(invoke('initialize', 'local-1', true)).rejects.toThrow('real directory')
    await expect(invoke('project-enabled', 'local-1', false)).rejects.toThrow('real directory')
    expect(await fs.readdir(external)).toEqual([])
  })

  it('preserves a changed note and only records a reviewed update once', async () => {
    const guide = path.join(project, 'AGENTS.md')
    await fs.writeFile(guide, 'Human instructions')
    const setup = await invoke('initialize', 'local-1', true)
    expect(await fs.readFile(guide, 'utf8')).toMatch(
      /^Human instructions\n\n<!-- saker-brain:instructions:start -->/
    )
    const note = path.join(project, '.saker', 'brain.md')
    await fs.writeFile(note, '# external revision')
    await expect(
      invoke('save', 'local-1', '# old draft', setup.projects[0].revision)
    ).rejects.toThrow('changed on disk')
    expect(await fs.readFile(note, 'utf8')).toBe('# external revision')

    const snapshot = await invoke('get-updates', 'local-1')
    const updateRevision = snapshot.projects[0].updatesRevision
    await invoke('record-update', 'local-1', 'Verified the change with a fixture.', updateRevision)
    await invoke('record-update', 'local-1', 'Verified the change with a fixture.', updateRevision)
    const history = await fs.readFile(path.join(project, '.saker', 'updates.md'), 'utf8')
    expect(history.match(/Verified the change with a fixture\./g)).toHaveLength(1)
  })

  it('activates idempotently and removes only managed instructions when disabled', async () => {
    const guide = path.join(project, 'CLAUDE.md')
    await fs.writeFile(guide, 'Human instructions\n')
    await invoke('initialize', 'local-1', true)
    const active = await invoke('initialize', 'local-1', true)
    expect(active.projects[0].agentInstructions).toBe(true)
    expect(
      (await fs.readFile(guide, 'utf8')).match(/saker-brain:instructions:start/g)
    ).toHaveLength(1)
    const note = path.join(project, '.saker', 'brain.md')
    await fs.writeFile(note, 'Keep this memory')
    const disabled = await invoke('project-enabled', 'local-1', false)
    expect(disabled.projects[0].agentInstructions).toBe(false)
    expect(await fs.readFile(guide, 'utf8')).toMatch(/^Human instructions\n\s*$/)
    expect(await fs.readFile(note, 'utf8')).toBe('Keep this memory')
    const reactivated = await invoke('initialize', 'local-1', true)
    expect(reactivated.projects[0].enabled).toBe(true)
    expect(reactivated.projects[0].agentInstructions).toBe(true)
  })

  it('indexes project paths and preserves verified annotations when refreshing the map', async () => {
    const checkout = path.join(project, 'src', 'app', 'checkout')
    await fs.mkdir(checkout, { recursive: true })
    await fs.writeFile(path.join(checkout, 'page.tsx'), 'export default function Checkout() {}')
    await fs.writeFile(path.join(project, '.env'), 'secret')
    await fs.mkdir(path.join(project, 'node_modules'))
    await fs.writeFile(path.join(project, 'node_modules', 'dependency.ts'), 'ignored')
    await fs.writeFile(path.join(external, 'outside.ts'), 'outside')
    await fs.symlink(
      external,
      path.join(project, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    await invoke('initialize', 'local-1', true)
    const mapPath = path.join(project, '.saker', 'file-map.md')
    const initial = await fs.readFile(mapPath, 'utf8')
    expect(initial).toContain('src/app/checkout/page.tsx')
    expect(initial).not.toContain('dependency.ts')
    expect(initial).not.toContain('outside.ts')
    expect(initial).not.toContain('.env')
    expect(await fs.readFile(path.join(project, '.saker', 'brain.md'), 'utf8')).toContain(
      '.saker/file-map.md'
    )
    await fs.appendFile(mapPath, '\n## Verified ownership\nCheckout uses the payment service.\n')
    await fs.rename(path.join(checkout, 'page.tsx'), path.join(checkout, 'checkout.tsx'))
    await invoke('refresh-file-map', 'local-1')
    const refreshed = await fs.readFile(mapPath, 'utf8')
    expect(refreshed).toContain('src/app/checkout/checkout.tsx')
    expect(refreshed).not.toContain('src/app/checkout/page.tsx')
    expect(refreshed).toContain('Checkout uses the payment service.')
    expect(refreshed.match(/<!-- saker-brain:file-map:start -->/g)).toHaveLength(1)
  })

  it('connects source imports to indexed files, including local aliases, without parsing comments as imports', async () => {
    const source = path.join(project, 'src')
    await fs.mkdir(path.join(source, 'checkout'), { recursive: true })
    await fs.mkdir(path.join(source, 'components'))
    await fs.writeFile(
      path.join(project, 'tsconfig.json'),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }'
    )
    await fs.writeFile(
      path.join(source, 'checkout', 'page.tsx'),
      "import Form from '../components/Form'; import { pay } from '@/payment'; // import Hidden from '../hidden'\nexport default function Page(){ return <Form onPay={pay} /> }"
    )
    await fs.writeFile(
      path.join(source, 'components', 'Form.tsx'),
      'export default function Form() {}'
    )
    await fs.writeFile(path.join(source, 'payment.ts'), 'export function pay() {}')
    await fs.writeFile(path.join(source, 'hidden.ts'), 'export default 1')
    const state = await invoke('initialize', 'local-1', true)
    expect(state.projects[0].fileGraph?.links).toEqual([
      { from: 'src/checkout/page.tsx', to: 'src/components/Form.tsx' },
      { from: 'src/checkout/page.tsx', to: 'src/payment.ts' }
    ])
    expect(state.projects[0].fileGraph?.analyzed).toBe(true)
  })

  it('imports legacy memory only on request and never replaces a profile note', async () => {
    const legacy = path.join(root, 'Saker', 'brain')
    await fs.mkdir(legacy, { recursive: true })
    await fs.writeFile(path.join(legacy, 'general.md'), 'Legacy memory')
    const before = await invoke('sync')
    expect(before.legacyAvailable).toBe(true)
    expect(await fs.readdir(profile)).toEqual([])
    await invoke('import-legacy')
    expect(await fs.readFile(path.join(profile, 'brain', 'general.md'), 'utf8')).toBe(
      'Legacy memory'
    )
    await expect(invoke('import-legacy')).rejects.toThrow('changed on disk')
  })
})
