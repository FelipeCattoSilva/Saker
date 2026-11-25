export type AppIdentity = {
  name: string
  isDev: boolean
  devLabel: string | null
  devBranch: string | null
  devWorktreeName: string | null
  devRepoRoot: string | null
  dockBadgeLabel: string | null
}

export function isSakerAppName(name: string | undefined): boolean {
  return name === 'Saker' || name === 'Saker Dev'
}
