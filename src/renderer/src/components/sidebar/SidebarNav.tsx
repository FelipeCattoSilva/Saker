import React from 'react'
import { Command, Search } from 'lucide-react'
import { useAppStore } from '@/store/index'

/**
 * Saker navigation is intentionally workspace-first.
 * The optional upstream task, automation and mobile shortcuts are removed;
 * implementation modules remain available for future migrations.
 */
const SidebarNav = React.memo(function SidebarNav(): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  return (
    <nav
      className="saker-sidebar-nav flex flex-col gap-2 px-2.5 pt-4 pb-3"
      aria-label="Saker workspace navigation"
    >
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-worktree-sidebar-foreground/40">
          Workspace
        </span>
        <Command className="size-3 text-worktree-sidebar-foreground/35" strokeWidth={1.5} />
      </div>
      <button
        type="button"
        onClick={() => openModal('worktree-palette')}
        className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12px] text-worktree-sidebar-foreground/50 transition-colors hover:bg-worktree-sidebar-foreground/[0.07] hover:text-worktree-sidebar-foreground"
      >
        <Search className="size-[15px] shrink-0 opacity-60" strokeWidth={1.7} />
        <span className="flex-1">Buscar projetos</span>
        <span className="rounded border border-worktree-sidebar-border px-1.5 py-0.5 font-mono text-[9px] opacity-60">
          ⌘ K
        </span>
      </button>
    </nav>
  )
})
export default SidebarNav
