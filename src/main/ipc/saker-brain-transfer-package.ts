import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import type { BrainTransferPackage, BrainTransferProject } from '../../shared/saker-brain-transfer'
import type { SakerBrainFileGraph } from '../../shared/saker-brain'

export const MAX_BRAIN_ARCHIVE_BYTES = 16 * 1024 * 1024
const MAX_CONTENT_BYTES = 32 * 1024 * 1024
const compress = promisify(gzip)
const decompress = promisify(gunzip)
function text(value: unknown, nullable = false): string | null {
  if (nullable && value === null) {
    return null
  }
  if (typeof value !== 'string' || value.length > 2_000_000) {
    throw new Error('Texto inválido no pacote do Brain.')
  }
  return value
}
function relative(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length < 1000 &&
    !value.includes('\\') &&
    !value.includes(':') &&
    !value.split('/').some((segment) => !segment || segment.startsWith('.'))
  )
}
function graph(value: unknown): SakerBrainFileGraph | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Mapa de arquivos inválido.')
  }
  const source = value as Partial<SakerBrainFileGraph>
  if (
    !Array.isArray(source.files) ||
    source.files.length > 600 ||
    !source.files.every(relative) ||
    !Array.isArray(source.links) ||
    source.links.length > 4000
  ) {
    throw new Error('Mapa de arquivos inválido.')
  }
  const known = new Set(source.files)
  if (!source.links.every((edge) => edge && known.has(edge.from) && known.has(edge.to))) {
    throw new Error('Conexões inválidas no pacote.')
  }
  return {
    files: [...known],
    links: source.links.map(({ from, to }) => ({ from, to })),
    partial: true,
    analyzed: false
  }
}
function validate(value: unknown): BrainTransferPackage {
  if (!value || typeof value !== 'object') {
    throw new Error('Pacote do Brain inválido.')
  }
  const packet = value as Partial<BrainTransferPackage>
  if (
    packet.format !== 'saker-brain' ||
    packet.version !== 1 ||
    typeof packet.id !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(packet.id) ||
    typeof packet.createdAt !== 'string' ||
    !Array.isArray(packet.projects) ||
    packet.projects.length > 100
  ) {
    throw new Error('Formato ou versão do Brain não suportada.')
  }
  const ids = new Set<string>()
  const projects: BrainTransferProject[] = packet.projects.map((project) => {
    if (
      !project ||
      typeof project.id !== 'string' ||
      !/^project-\d+$/.test(project.id) ||
      ids.has(project.id) ||
      typeof project.name !== 'string' ||
      !project.name.trim() ||
      project.name.length > 200
    ) {
      throw new Error('Projeto inválido no pacote.')
    }
    ids.add(project.id)
    return {
      id: project.id,
      name: project.name,
      brain: text(project.brain)!,
      updates: text(project.updates, true),
      fileMap: text(project.fileMap, true),
      fileGraph: graph(project.fileGraph)
    }
  })
  return {
    format: 'saker-brain',
    version: 1,
    id: packet.id,
    createdAt: packet.createdAt,
    general: text(packet.general, true),
    projects
  }
}
export async function encodeBrainTransfer(packet: BrainTransferPackage): Promise<Buffer> {
  const json = Buffer.from(JSON.stringify(validate(packet)), 'utf8')
  if (json.length > MAX_CONTENT_BYTES) {
    throw new Error('O Brain excede o limite de 32 MB. Exporte menos conteúdo por vez.')
  }
  const compressed = await compress(json, { level: 9 })
  if (compressed.length > MAX_BRAIN_ARCHIVE_BYTES) {
    throw new Error('O pacote compactado excede 16 MB.')
  }
  return compressed
}
export async function decodeBrainTransfer(bytes: Uint8Array): Promise<BrainTransferPackage> {
  if (bytes.byteLength > MAX_BRAIN_ARCHIVE_BYTES) {
    throw new Error('O pacote excede 16 MB.')
  }
  let value: unknown
  try {
    const json = await decompress(bytes, { maxOutputLength: MAX_CONTENT_BYTES })
    value = JSON.parse(json.toString('utf8'))
  } catch {
    throw new Error(
      'Não foi possível ler o pacote do Brain. Ele pode estar incompleto ou corrompido.'
    )
  }
  return validate(value)
}
