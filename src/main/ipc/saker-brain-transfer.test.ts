import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { Repo } from '../../shared/repository/repo-types'
import {
  collectBrainTransfer,
  importGeneralBrain,
  importProjectBrain
} from './saker-brain-transfer-storage'
import { decodeBrainTransfer, encodeBrainTransfer } from './saker-brain-transfer-package'
import { createBrainTransferDialogs } from './saker-brain-transfer-dialogs'
import { refreshBrainFileMap } from './saker-brain-file-map'
const { open, save } = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('electron', () => ({ dialog: { showOpenDialog: open, showSaveDialog: save } }))
let root: string
let source: Repo
let target: Repo
let profile: string
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'saker-transfer-'))
  profile = path.join(root, 'profile')
  source = { id: 'source', path: path.join(root, 'old-pc'), displayName: 'Store' } as Repo
  target = { id: 'target', path: path.join(root, 'new-pc'), displayName: 'Store' } as Repo
  for (const folder of [profile, source.path, target.path]) await fs.mkdir(folder)
  await fs.mkdir(path.join(profile, 'brain'))
  await fs.writeFile(path.join(profile, 'brain', 'general.md'), 'Shared working style')
  await fs.mkdir(path.join(source.path, '.saker'))
  await fs.writeFile(
    path.join(source.path, '.saker', 'brain.md'),
    '# Store\nVerified checkout is src/page.tsx.\n'.repeat(400)
  )
  await fs.writeFile(path.join(source.path, '.saker', 'updates.md'), 'Verified checkpoint')
  await fs.writeFile(
    path.join(source.path, '.saker', 'file-map.md'),
    '# File map\n\n<!-- saker-brain:file-map:start -->\n- `src/page.tsx`\n<!-- saker-brain:file-map:end -->\n\nHuman map annotation'
  )
  await fs.writeFile(path.join(source.path, 'account.json'), 'PRIVATE_ACCOUNT_MARKER')
  await fs.writeFile(path.join(source.path, 'page.tsx'), 'SOURCE_CODE_MARKER')
  open.mockReset()
  save.mockReset()
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})
describe('portable Brain package', () => {
  it('compresses memory and restores it without exporting project code, accounts or host paths', async () => {
    const packet = await collectBrainTransfer(profile, [source])
    const bytes = await encodeBrainTransfer(packet)
    const json = gunzipSync(bytes).toString('utf8')
    expect(bytes.length).toBeLessThan(2048)
    expect(json).not.toContain('PRIVATE_ACCOUNT_MARKER')
    expect(json).not.toContain('SOURCE_CODE_MARKER')
    expect(json).not.toContain(source.path)
    const restored = await decodeBrainTransfer(bytes)
    expect(restored.general).toBe('Shared working style')
    expect(restored.projects[0].updates).toBe('Verified checkpoint')
    expect(restored.projects[0].fileGraph?.files).toEqual(['src/page.tsx'])
  })
  it('merges into the chosen project once and preserves local notes and source files', async () => {
    const packet = await decodeBrainTransfer(
      await encodeBrainTransfer(await collectBrainTransfer(profile, [source]))
    )
    await fs.mkdir(path.join(target.path, '.saker'))
    await fs.writeFile(path.join(target.path, '.saker', 'brain.md'), 'Local verified notes\n')
    await fs.writeFile(
      path.join(target.path, '.saker', 'file-map.md'),
      '# Local\n<!-- saker-brain:file-map:start -->\n- `local.ts`\n<!-- saker-brain:file-map:end -->\nLocal annotation'
    )
    await fs.writeFile(path.join(target.path, 'AGENTS.md'), 'Human agent guide\n')
    await fs.writeFile(path.join(target.path, 'page.tsx'), 'Keep local source')
    await importProjectBrain(target, packet.projects[0], packet.id, true)
    await importProjectBrain(target, packet.projects[0], packet.id, true)
    const note = await fs.readFile(path.join(target.path, '.saker', 'brain.md'), 'utf8')
    expect(note).toMatch(/^Local verified notes\n/)
    expect(note.match(/Memória importada — Store/g)).toHaveLength(1)
    expect(await fs.readFile(path.join(target.path, 'page.tsx'), 'utf8')).toBe('Keep local source')
    expect(await fs.readFile(path.join(target.path, 'AGENTS.md'), 'utf8')).toMatch(
      /^Human agent guide\n/
    )
    await refreshBrainFileMap(target)
    const map = await fs.readFile(path.join(target.path, '.saker', 'file-map.md'), 'utf8')
    expect(map).toContain('Human map annotation')
    expect(map).toContain('Local annotation')
    expect(map.match(/saker-brain:file-map:start/g)).toHaveLength(1)
    await importGeneralBrain(profile, packet)
  })
  it('rejects file-map paths outside the project before accepting a package', async () => {
    const packet = await collectBrainTransfer(profile, [source])
    packet.projects[0].fileGraph = {
      files: ['../outside.ts'],
      links: [],
      partial: false,
      analyzed: false
    }
    await expect(decodeBrainTransfer(gzipSync(JSON.stringify(packet)))).rejects.toThrow(
      'Mapa de arquivos inválido'
    )
  })
  it('saves a reusable compressed package through the export action', async () => {
    const file = path.join(root, 'saved.sakerbrain')
    save.mockResolvedValue({ canceled: false, filePath: file })
    const transfer = createBrainTransferDialogs({
      profile,
      repos: () => [source],
      parent: () => null,
      requireEnabled: async () => {}
    })
    await transfer.exportArchive()
    const restored = await decodeBrainTransfer(await fs.readFile(file))
    expect(restored.general).toBe('Shared working style')
    expect(restored.projects[0].name).toBe('Store')
    expect(restored.projects[0].updates).toBe('Verified checkpoint')
  })

  it('requires an eligible local destination and a preview token before writing imports', async () => {
    const file = path.join(root, 'memory.sakerbrain')
    await fs.writeFile(
      file,
      await encodeBrainTransfer(await collectBrainTransfer(profile, [source]))
    )
    open.mockResolvedValue({ canceled: false, filePaths: [file] })
    const transfer = createBrainTransferDialogs({
      profile,
      repos: () => [target],
      parent: () => null,
      requireEnabled: async () => {}
    })
    const preview = await transfer.pickImportArchive()
    await expect(
      transfer.applyImport({
        token: preview!.token,
        general: true,
        activate: false,
        mappings: [{ sourceId: 'project-1', projectId: 'foreign' }]
      })
    ).rejects.toThrow('pasta local diferente')
    expect(await fs.readdir(target.path)).toEqual([])
    await expect(
      transfer.applyImport({ token: 'forged', general: true, activate: false, mappings: [] })
    ).rejects.toThrow('novamente')
    await transfer.applyImport({
      token: preview!.token,
      general: false,
      activate: true,
      mappings: [{ sourceId: 'project-1', projectId: 'target' }]
    })
    expect(await fs.readFile(path.join(target.path, '.saker', 'updates.md'), 'utf8')).toContain(
      'Verified checkpoint'
    )
  })
})
