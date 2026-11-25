import type { JSX } from 'react'

/**
 * Saker original explorer icon set — a coherent 16px stroke-based visual language.
 * Unlike emoji or platform glyphs, these are editable vector marks, never rasterized.
 */
type IconKind =
  | 'folder'
  | 'folder-open'
  | 'project'
  | 'hidden'
  | 'brain'
  | 'markdown'
  | 'code'
  | 'config'
  | 'image'
  | 'json'
  | 'git'
  | 'file'
  | 'terminal'

function kindFor(name: string, directory: boolean, expanded: boolean): IconKind {
  const lower = name.toLowerCase()
  if (directory) {
    if (lower === '.saker' || lower === 'brain') return 'brain'
    if (lower === '.git' || lower === '.github') return 'git'
    if (['src', 'source', 'app', 'packages', 'components'].includes(lower)) return 'project'
    if (lower.startsWith('.')) return 'hidden'
    return expanded ? 'folder-open' : 'folder'
  }
  if (lower === 'agents.md' || lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown'
  if (/\.(png|jpe?g|gif|svg|webp|ico|avif)$/.test(lower)) return 'image'
  if (/\.(json|jsonc|lock)$/.test(lower)) return 'json'
  if (
    /(^|[.\/])(?:config|settings|env|editorconfig|prettierrc|eslintrc)/.test(lower) ||
    /\.(toml|ini|yaml|yml)$/.test(lower)
  )
    return 'config'
  if (/\.(tsx?|jsx?|py|rs|go|lua|html?|css|scss|sh|bat|ps1|cpp|h)$/.test(lower)) return 'code'
  if (lower === 'makefile' || /\.(cmd|exe)$/.test(lower)) return 'terminal'
  if (lower === '.gitignore' || lower === '.gitattributes') return 'git'
  return 'file'
}

export function SakerExplorerIcon({
  name,
  directory,
  expanded = false,
  className
}: {
  name: string
  directory: boolean
  expanded?: boolean
  className?: string
}): JSX.Element {
  const kind = kindFor(name, directory, expanded)
  const colors: Record<IconKind, string> = {
    folder: '#929aaa',
    'folder-open': '#bbc5d2',
    project: '#8cadd0',
    hidden: '#687386',
    brain: '#93b7c2',
    markdown: '#9db9db',
    code: '#9ea9c7',
    config: '#b1a6bb',
    image: '#a7bfa9',
    json: '#bfc09d',
    git: '#ae9fc5',
    file: '#858e9d',
    terminal: '#a1b9ac'
  }
  const marks: Record<IconKind, JSX.Element> = {
    folder: (
      <>
        <path d="M2.2 5.1V3.8c0-.6.5-1.1 1.1-1.1h3.4l1.7 2h4.3c.6 0 1.1.5 1.1 1.1v6.4c0 .7-.5 1.2-1.2 1.2H3.4c-.7 0-1.2-.5-1.2-1.2Z" />
        <path d="M2.2 5.1h11.6" />
      </>
    ),
    'folder-open': (
      <>
        <path d="M2 7V3.8c0-.7.5-1.2 1.2-1.2h3.2l1.6 2h4.8c.7 0 1.2.5 1.2 1.2" />
        <path d="M2.4 7h11c.8 0 1.2.6 1 1.3l-1.6 4.2c-.2.5-.6.8-1.1.8H3.2c-.5 0-.9-.3-1.1-.8L1.3 8.3c-.2-.7.2-1.3 1.1-1.3Z" />
      </>
    ),
    project: (
      <>
        <path d="M2 5V3.6c0-.6.5-1 1-1h3.3l1.7 2h4.5c.7 0 1.2.5 1.2 1.2v6.3c0 .7-.5 1.3-1.2 1.3H3.2c-.7 0-1.2-.6-1.2-1.3Z" />
        <path d="m8 7-1.6 1.6L8 10.2m1.6-3.2 1.5 1.6-1.5 1.6" />
      </>
    ),
    hidden: (
      <>
        <path d="M2.2 5V3.8c0-.7.5-1.2 1.2-1.2h3.1l1.7 2h4.4c.7 0 1.1.5 1.1 1.2v6.4c0 .7-.4 1.2-1.1 1.2H3.4c-.7 0-1.2-.5-1.2-1.2Z" />
        <path strokeDasharray="2 2" d="M5 8.7h6" />
      </>
    ),
    brain: (
      <>
        <path d="M5.5 4.2a2.2 2.2 0 0 0-3.1 3.1 3.1 0 0 0 .4 5.3A2.3 2.3 0 0 0 7 12v-8a2.1 2.1 0 0 0-1.5-1.9M10.5 4.2a2.2 2.2 0 0 1 3.1 3.1 3.1 0 0 1-.4 5.3A2.3 2.3 0 0 1 9 12V4a2.1 2.1 0 0 1 1.5-1.9M5 7.2l2 1.2m4-1.2L9 8.4" />
      </>
    ),
    markdown: (
      <>
        <rect x="1.7" y="3" width="12.6" height="10" rx="1.5" />
        <path d="M3.6 10.8V6.1l2.1 2 2.1-2v4.7m2.4-4.4v4.4m-1.5-1.5 1.5 1.5 1.5-1.5" />
      </>
    ),
    code: (
      <>
        <path d="M5.7 2.2H3.8c-.7 0-1.2.5-1.2 1.2v9.3c0 .7.5 1.2 1.2 1.2h8.4c.7 0 1.2-.5 1.2-1.2V6L9.7 2.2H5.7Z" />
        <path d="M9.6 2.3V6h3.5m-7 2.2L4.6 9.6 6.1 11m3.8-2.8 1.4 1.4-1.4 1.4" />
      </>
    ),
    config: (
      <>
        <rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2" />
        <path d="M4.6 5.2h6.8M4.6 8h6.8M4.6 10.8h6.8" />
        <circle cx="7" cy="5.2" r="1" fill="#17191d" />
        <circle cx="10" cy="8" r="1" fill="#17191d" />
        <circle cx="6.3" cy="10.8" r="1" fill="#17191d" />
      </>
    ),
    image: (
      <>
        <rect x="2.1" y="2.5" width="11.8" height="11" rx="1.4" />
        <circle cx="5.5" cy="5.7" r="1.1" />
        <path d="m3 11 3-2.8 2.2 1.7 2.1-2.7 2.6 3.5" />
      </>
    ),
    json: (
      <>
        <path d="M6 2.7C4.5 2.7 4 3.5 4 5v1c0 1-.3 1.5-1.4 2 1.1.5 1.4 1 1.4 2v1c0 1.5.5 2.3 2 2.3m4-10.6c1.5 0 2 .8 2 2.3v1c0 1 .3 1.5 1.4 2-1.1.5-1.4 1-1.4 2v1c0 1.5-.5 2.3-2 2.3" />
      </>
    ),
    git: (
      <>
        <circle cx="5" cy="3.6" r="1.5" />
        <circle cx="5" cy="12.3" r="1.5" />
        <circle cx="11.5" cy="8.4" r="1.5" />
        <path d="M5 5.1v5.7m0-2.5c0-2.2 4.9-3.2 6.5-1.4" />
      </>
    ),
    file: (
      <>
        <path d="M8.8 2.3H4.2c-.7 0-1.2.6-1.2 1.2v9c0 .7.5 1.2 1.2 1.2h7.7c.7 0 1.1-.5 1.1-1.2V6.4Z" />
        <path d="M8.8 2.3v4.1H13" />
      </>
    ),
    terminal: (
      <>
        <rect x="2.1" y="3.3" width="11.8" height="9.4" rx="1.3" />
        <path d="m4.4 6 2 1.8-2 1.8M8.4 9.6h2.8" />
      </>
    )
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke={colors[kind]}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {marks[kind]}
    </svg>
  )
}
