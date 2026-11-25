import { Settings2 } from 'lucide-react'
import { ClaudeSwitcherMenu } from '@/components/status-bar/accounts/ClaudeSwitcherMenu'
import { CodexSwitcherMenu } from '@/components/status-bar/accounts/CodexSwitcherMenu'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { useActiveAccountOwner } from '@/runtime/provider-accounts/ownership/use-active-account-owner'
import { defaultScopeHost } from '@/runtime/hosts/selection/default-creation-host'

export default function SakerAccountMenuItems(): React.JSX.Element {
  const t = useTranslate()
  const settings = useAppStore((state) => state.settings)
  const owner = useActiveAccountOwner(defaultScopeHost(settings))
  const codex = useAppStore((state) => state.rateLimits.codex)
  const claude = useAppStore((state) => state.rateLimits.claude)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)

  return (
    <>
      <CodexSwitcherMenu codex={codex} compact iconOnly={false} asSubmenu triggerContent="Codex" />
      <ClaudeSwitcherMenu
        claude={claude}
        compact
        iconOnly={false}
        asSubmenu
        triggerContent="Claude"
      />
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          openSettingsTarget({ pane: 'accounts', repoId: null, hostScope: owner.target })
          openSettingsPage()
        }}
      >
        <Settings2 aria-hidden />
        {t('auto.components.status.bar.StatusBar.75ded02687', 'Manage Accounts…')}
      </DropdownMenuItem>
    </>
  )
}
