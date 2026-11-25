import { BrainCircuit, FolderTree, Search, Settings2, UsersRound } from 'lucide-react'
import { Suspense, useRef, useState } from 'react'
import { useAppStore } from '@/store/index'
import sakerMark from '../../../../resources/logo.svg'
import { useTranslate } from '@/i18n/use-translate'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { lazyWithRetry } from './startup/lazy-with-retry'

const SakerBrainDialog = lazyWithRetry(() => import('@/components/sidebar/SakerBrainButton'), {
  reloadKey: 'saker-brain'
})

const SakerAccountMenuItems = lazyWithRetry(() => import('./SakerAccountMenuItems'), {
  reloadKey: 'saker-account-menu'
})

export function SakerNavigationRail(): React.JSX.Element {
  const t = useTranslate()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const sidebarBody = useAppStore((s) => s.sidebarBody)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setSidebarBody = useAppStore((s) => s.setSidebarBody)
  const openModal = useAppStore((s) => s.openModal)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const activeView = useAppStore((s) => s.activeView)
  const [brainOpen, setBrainOpen] = useState(false)
  const brainButton = useRef<HTMLButtonElement>(null)
  const showingProjects = sidebarOpen && sidebarBody === 'workspaces'

  return (
    <nav aria-label="Saker" className="saker-activity-rail">
      <div className="saker-rail-mark">
        <img src={sakerMark} alt="Saker" />
      </div>
      <button
        type="button"
        className="saker-rail-action"
        aria-pressed={showingProjects}
        onClick={() => {
          setSidebarBody('workspaces')
          if (showingProjects || !sidebarOpen) {
            toggleSidebar()
          }
        }}
      >
        <FolderTree aria-hidden />
        <span>Projetos</span>
      </button>
      {window.api?.sakerBrain && (
        <button
          type="button"
          className="saker-rail-action"
          ref={brainButton}
          aria-label="Saker Brain"
          aria-haspopup="dialog"
          aria-expanded={brainOpen}
          onClick={() => setBrainOpen(true)}
        >
          <BrainCircuit aria-hidden />
          <span>Brain</span>
        </button>
      )}
      <button
        type="button"
        className="saker-rail-action"
        onClick={() => openModal('worktree-palette')}
      >
        <Search aria-hidden />
        <span>Buscar</span>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="saker-rail-action mt-auto">
            <UsersRound aria-hidden />
            <span>{t('auto.components.status.bar.AccountSwitchList.accounts', 'Accounts')}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-56">
          <Suspense
            fallback={
              <div role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
                {t('common.loading', 'Loading…')}
              </div>
            }
          >
            <SakerAccountMenuItems />
          </Suspense>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="saker-rail-action"
        aria-pressed={activeView === 'settings'}
        onClick={openSettingsPage}
      >
        <Settings2 aria-hidden />
        <span>Ajustes</span>
      </button>
      {brainOpen && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              Abrindo Brain…
            </span>
          }
        >
          <SakerBrainDialog
            onClose={() => {
              setBrainOpen(false)
              window.requestAnimationFrame(() => brainButton.current?.focus())
            }}
          />
        </Suspense>
      )}
    </nav>
  )
}
