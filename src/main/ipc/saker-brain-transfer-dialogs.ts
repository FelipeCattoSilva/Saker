import { dialog, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Repo } from '../../shared/repository/repo-types'
import type {
  BrainImportPreview,
  BrainImportSelection,
  BrainTransferPackage
} from '../../shared/saker-brain-transfer'
import {
  decodeBrainTransfer,
  encodeBrainTransfer,
  MAX_BRAIN_ARCHIVE_BYTES
} from './saker-brain-transfer-package'
import {
  collectBrainTransfer,
  importGeneralBrain,
  importProjectBrain
} from './saker-brain-transfer-storage'

export function createBrainTransferDialogs(options: {
  profile: string
  repos: () => Repo[]
  parent: () => BrowserWindow | null
  requireEnabled: () => Promise<void>
}) {
  let pending: { token: string; packet: BrainTransferPackage; expires: number } | null = null
  return {
    async exportArchive(): Promise<{ bytes: number; projects: number } | null> {
      const packet = await collectBrainTransfer(options.profile, options.repos())
      const bytes = await encodeBrainTransfer(packet)
      const parent = options.parent()
      const config = {
        title: 'Saker Brain',
        defaultPath: 'Saker-Brain.sakerbrain',
        filters: [{ name: 'Saker Brain (.sakerbrain)', extensions: ['sakerbrain'] }]
      }
      const result = parent
        ? await dialog.showSaveDialog(parent, config)
        : await dialog.showSaveDialog(config)
      if (result.canceled || !result.filePath) {
        return null
      }
      const target = result.filePath
      const temporary = path.join(
        path.dirname(target),
        `.${path.basename(target)}.${randomUUID()}.tmp`
      )
      let created = false
      try {
        await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 })
        created = true
        await fs.rename(temporary, target)
      } finally {
        if (created) {
          await fs.rm(temporary, { force: true })
        }
      }
      return { bytes: bytes.length, projects: packet.projects.length }
    },
    async pickImportArchive(): Promise<BrainImportPreview | null> {
      pending = null
      const parent = options.parent()
      const config: Electron.OpenDialogOptions = {
        title: 'Saker Brain',
        properties: ['openFile'],
        filters: [{ name: 'Saker Brain (.sakerbrain)', extensions: ['sakerbrain'] }]
      }
      const result = parent
        ? await dialog.showOpenDialog(parent, config)
        : await dialog.showOpenDialog(config)
      if (result.canceled || !result.filePaths[0]) {
        return null
      }
      const file = result.filePaths[0]
      const handle = await fs.open(file, 'r')
      let bytes: Buffer
      try {
        const stat = await handle.stat()
        if (!stat.isFile() || stat.size > MAX_BRAIN_ARCHIVE_BYTES) {
          throw new Error('Selecione um pacote do Brain de até 16 MB.')
        }
        const buffer = Buffer.alloc(stat.size + 1)
        let bytesRead = 0
        while (bytesRead < buffer.length) {
          const chunk = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead)
          if (chunk.bytesRead === 0) {
            break
          }
          bytesRead += chunk.bytesRead
        }
        if (bytesRead !== stat.size) {
          throw new Error('O arquivo mudou durante a leitura. Selecione-o novamente.')
        }
        bytes = buffer.subarray(0, bytesRead)
      } finally {
        await handle.close()
      }
      const packet = await decodeBrainTransfer(bytes)
      const token = randomUUID()
      pending = { token, packet, expires: Date.now() + 15 * 60_000 }
      return {
        token,
        fileName: path.basename(file),
        compressedBytes: bytes.length,
        generalAvailable: packet.general !== null,
        projects: packet.projects.map((project) => ({
          id: project.id,
          name: project.name,
          files: project.fileGraph?.files.length ?? 0
        }))
      }
    },
    async applyImport(value: unknown): Promise<void> {
      const selection = value as BrainImportSelection
      if (
        !selection ||
        !pending ||
        selection.token !== pending.token ||
        pending.expires < Date.now() ||
        typeof selection.general !== 'boolean' ||
        typeof selection.activate !== 'boolean' ||
        !Array.isArray(selection.mappings) ||
        selection.mappings.length > 100
      ) {
        throw new Error('Selecione o pacote do Brain novamente.')
      }
      if (selection.activate) {
        await options.requireEnabled()
      }
      const packet = pending.packet
      const repos = options.repos()
      const sources = new Set<string>()
      const destinations = new Set<string>()
      const plans = selection.mappings.map((mapping) => {
        const source = mapping && packet.projects.find((project) => project.id === mapping.sourceId)
        const repo = mapping && repos.find((candidate) => candidate.id === mapping.projectId)
        if (!source || !repo || sources.has(source.id) || destinations.has(repo.id)) {
          throw new Error('Escolha uma pasta local diferente para cada projeto importado.')
        }
        sources.add(source.id)
        destinations.add(repo.id)
        return { source, repo }
      })
      if (!plans.length && !(selection.general && packet.general !== null)) {
        throw new Error('Selecione ao menos uma memória para importar.')
      }
      try {
        if (selection.general) {
          await importGeneralBrain(options.profile, packet)
        }
        for (const plan of plans) {
          await importProjectBrain(plan.repo, plan.source, packet.id, selection.activate)
        }
      } catch (cause) {
        throw new Error(
          `Importação interrompida. As notas já mescladas foram preservadas; você pode tentar novamente. ${cause instanceof Error ? cause.message : String(cause)}`
        )
      }
      pending = null
    }
  }
}
