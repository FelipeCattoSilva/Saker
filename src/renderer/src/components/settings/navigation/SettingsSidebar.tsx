import type { KeyboardEvent, RefObject } from 'react'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { ArrowLeft, Server } from 'lucide-react'
import type { RepoIcon } from '../../../../../shared/repository/appearance/repo-icon'
import type {
  SettingsNavIcon,
  SettingsNavInstallStatus
} from '@/components/settings/navigation/settings-navigation-types'
import type { GitHubRepositoryIdentity } from '../../../../../shared/github/repositories/repository-identity'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { cn } from '@/lib/class-names'
import { RepoIconGlyph } from '../../repo/repo-icon'
import { RepoForkIndicator } from '../../repo/repo-fork-indicator'
import { Button } from '../../ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { resolveLeftSidebarStyleVariables } from '@/app-shell/appearance/left-sidebar-appearance'
import { useAppStore } from '@/store/index'
import {
  rankSettingsSearchResults,
  SETTINGS_SEARCH_RESULT_LIMIT,
  type SettingsSearchResult
} from './settings-search-results'
import { SettingsSearchField, SettingsSearchResultsList } from './SettingsSidebarSearch'

type NavSection = {
  id: string
  title: string
  icon: SettingsNavIcon
  badge?: string
  installStatus?: SettingsNavInstallStatus
}

type NavGroup = {
  id: string
  title: string
  sections: NavSection[]
}

type RepoNavSection = NavSection & {
  badgeColor?: string
  isRemote?: boolean
  repoIcon?: RepoIcon | null
  upstream?: GitHubRepositoryIdentity | null
}

type SettingsSidebarProps = {
  activeSectionId: string
  settings: GlobalSettings | null
  generalGroups: NavGroup[]
  repoSections: RepoNavSection[]
  searchCandidates: readonly SettingsSearchResult[]
  searchInputRef?: RefObject<HTMLInputElement | null>
  searchAutoFocus?: boolean
  onBack: () => void
  onSelectSection: (sectionId: string) => void
  onOpenSearchResult: (result: SettingsSearchResult) => void
}

type VisibleInstallStatus = Extract<
  SettingsNavInstallStatus,
  'update-available' | 'needs-attention'
>

function isVisibleInstallStatus(
  status: SettingsNavInstallStatus | undefined
): status is VisibleInstallStatus {
  return status === 'update-available' || status === 'needs-attention'
}

export function SettingsSidebar({
  activeSectionId,
  settings,
  generalGroups,
  repoSections,
  searchCandidates,
  searchInputRef,
  searchAutoFocus = false,
  onBack,
  onSelectSection,
  onOpenSearchResult
}: SettingsSidebarProps): React.JSX.Element {
  const t = useTranslate()
  const searchQuery = useAppStore((state) => state.settingsSearchInputQuery)
  const setSearchQuery = useAppStore((state) => state.setSettingsSearchQuery)
  const listboxId = useId()
  // Ranking follows the deferred query so a large catalog never blocks typing.
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const rankedResults = useMemo(
    () => rankSettingsSearchResults(deferredSearchQuery, searchCandidates),
    [searchCandidates, deferredSearchQuery]
  )
  const searchResults = rankedResults.slice(0, SETTINGS_SEARCH_RESULT_LIMIT)
  const hiddenResultCount = rankedResults.length - searchResults.length
  const isSearching = searchQuery.trim() !== ''
  // Nothing is selected until the user moves or picks; typing only changes the rows.
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(null)
  const selectedResultIndex = searchResults.findIndex((result) => result.key === selectedResultKey)
  const selectedResult = selectedResultIndex === -1 ? undefined : searchResults[selectedResultIndex]
  const repoSectionById = useMemo(
    () => new Map(repoSections.map((section) => [section.id, section] as const)),
    [repoSections]
  )
  const sakerGroups = useMemo(() => {
    const available = generalGroups.flatMap((group) => group.sections)
    const used = new Set<string>()
    const groups = [
      {
        id: 'personal',
        title: 'Seu Saker',
        ids: ['general', 'appearance', 'input', 'chat', 'shortcuts', 'notifications']
      },
      {
        id: 'ai',
        title: 'Inteligência artificial',
        ids: ['accounts', 'agents', 'computer-use', 'voice', 'orchestration', 'linear', 'plugins']
      },
      {
        id: 'workspace',
        title: 'Ambiente de trabalho',
        ids: [
          'terminal',
          'git',
          'browser',
          'tasks',
          'automations',
          'quick-commands',
          'integrations',
          'session-history',
          'workspace-cleanup'
        ]
      }
    ].map((group) => ({
      ...group,
      sections: group.ids.flatMap((id) => {
        const section = available.find((candidate) => candidate.id === id)
        if (!section) {
          return []
        }
        used.add(id)
        return [section]
      })
    }))
    return [
      ...groups,
      {
        id: 'more',
        title: 'Sistema e recursos',
        sections: available.filter((section) => !used.has(section.id))
      }
    ].filter((group) => group.sections.length > 0)
  }, [generalGroups])
  const groupTitleById = useMemo(
    () => new Map(sakerGroups.map((group) => [group.id, group.title] as const)),
    [sakerGroups]
  )
  const getOptionId = (index: number): string => `${listboxId}-option-${index}`

  const pickResult = (result: SettingsSearchResult): void => {
    setSelectedResultKey(result.key)
    onOpenSearchResult(result)
  }
  const changeSearchQuery = (query: string): void => {
    setSearchQuery(query)
    setSelectedResultKey(null)
  }
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'Escape' && searchQuery !== '') {
      // Keep the page-level Escape from closing Settings while clearing search.
      event.preventDefault()
      changeSearchQuery('')
      return
    }
    if (!isSearching || searchResults.length === 0) {
      return
    }
    const count = searchResults.length
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex =
        selectedResultIndex === -1
          ? event.key === 'ArrowDown'
            ? 0
            : count - 1
          : (selectedResultIndex + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      setSelectedResultKey(searchResults[nextIndex].key)
      document.getElementById(getOptionId(nextIndex))?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (event.key === 'Enter' && selectedResult) {
      event.preventDefault()
      pickResult(selectedResult)
    }
  }
  const leftSidebarStyle = useMemo(() => resolveLeftSidebarStyleVariables(settings), [settings])
  const navItemClassName = (isActive: boolean): string =>
    cn(
      'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-worktree-sidebar-ring/50',
      isActive
        ? 'bg-accent font-semibold text-accent-foreground'
        : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-accent/60 hover:text-worktree-sidebar-foreground'
    )
  const installStatusLabel = (status: VisibleInstallStatus): string => {
    switch (status) {
      case 'update-available':
        return t(
          'auto.components.skills.SkillFreshnessStatusPill.updateAvailable',
          'Update available'
        )
      case 'needs-attention':
        return t('auto.components.skills.SkillFreshnessStatusPill.needsAttention', 'Review skill')
    }
  }
  const installStatusClassName =
    'ml-auto shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-700 dark:text-amber-300'

  return (
    <aside
      className="saker-settings-sidebar flex w-[248px] shrink-0 flex-col"
      style={leftSidebarStyle}
    >
      {/* Same 48px height as SettingsHeader so both bottom borders meet in one line. */}
      <div className="box-border flex h-20 shrink-0 items-center px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-full justify-start gap-2 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('auto.components.settings.SettingsSidebar.60f8a673a7', 'Back to Saker')}
        </Button>
      </div>

      <SettingsSearchField
        searchInputRef={searchInputRef}
        searchAutoFocus={searchAutoFocus}
        query={searchQuery}
        listboxId={listboxId}
        expanded={isSearching && searchResults.length > 0}
        activeOptionId={selectedResult ? getOptionId(selectedResultIndex) : undefined}
        onQueryChange={changeSearchQuery}
        onKeyDown={handleSearchKeyDown}
      />

      {isSearching ? (
        <SettingsSearchResultsList
          results={searchResults}
          selectedIndex={selectedResultIndex}
          query={searchQuery}
          listboxId={listboxId}
          getOptionId={getOptionId}
          repoSectionById={repoSectionById}
          groupTitleById={groupTitleById}
          hiddenResultCount={hiddenResultCount}
          // The deferred ranking can trail typing by a frame; don't announce a false empty state.
          pending={deferredSearchQuery !== searchQuery}
          onSelect={pickResult}
        />
      ) : null}

      {/* Not rendered while searching so typing never re-renders every project row. */}
      {isSearching ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-3 py-4">
          <div className="space-y-5">
            {sakerGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.sections.map((section) => {
                    const Icon = section.icon
                    const isActive = activeSectionId === section.id

                    return (
                      <button
                        key={section.id}
                        aria-current={isActive ? 'page' : undefined}
                        data-current={isActive ? 'true' : undefined}
                        onClick={() => onSelectSection(section.id)}
                        className={navItemClassName(isActive)}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">
                          {section.id === 'accounts' ? 'Contas de IA' : section.title}
                        </span>
                        {isVisibleInstallStatus(section.installStatus) ? (
                          <span className={installStatusClassName}>
                            {installStatusLabel(section.installStatus)}
                          </span>
                        ) : section.badge ? (
                          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            {section.badge}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('auto.components.settings.SettingsSidebar.5c9669ff9c', 'Projects')}
              </p>

              {repoSections.length > 0 ? (
                <div className="space-y-1">
                  {repoSections.map((section) => {
                    const isActive = activeSectionId === section.id

                    return (
                      <button
                        key={section.id}
                        aria-current={isActive ? 'page' : undefined}
                        data-current={isActive ? 'true' : undefined}
                        onClick={() => onSelectSection(section.id)}
                        className={navItemClassName(isActive)}
                      >
                        <RepoIconGlyph
                          repoIcon={section.repoIcon}
                          color={section.badgeColor}
                          className="size-4 shrink-0 text-muted-foreground"
                          iconClassName="size-3.5"
                        />
                        <span className="truncate">{section.title}</span>
                        <RepoForkIndicator upstream={section.upstream} />
                        {section.isRemote && (
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                            <Server className="size-3" />
                            {t('auto.components.settings.SettingsSidebar.e0900f83e7', 'SSH')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-3 text-xs text-muted-foreground">
                  {t(
                    'auto.components.settings.SettingsSidebar.df38d612b7',
                    'No projects added yet.'
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
