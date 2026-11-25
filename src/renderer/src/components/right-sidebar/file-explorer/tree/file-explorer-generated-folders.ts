const GENERATED_FOLDERS = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  'vendor'
])

export function isGeneratedExplorerFolder(name: string): boolean {
  return GENERATED_FOLDERS.has(name.toLowerCase())
}
