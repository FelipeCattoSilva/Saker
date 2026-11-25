import React from 'react'
import { Keyboard, RotateCcw, Settings2 } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

/** Local-only Saker menu: no Orca marketing links, release notes or external feedback prompts. */
export function SidebarSettingsHelpMenu(): React.JSX.Element {
  const openSettingsPage = useAppStore(s => s.openSettingsPage)
  const openSettingsTarget = useAppStore(s => s.openSettingsTarget)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const shortcuts = (): void => {
    openSettingsTarget({ pane: 'shortcuts', repoId: null })
    openSettingsPage()
  }
  return (
    <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" type="button"
              aria-label="Saker options" className="text-muted-foreground">
              <Settings2 className="size-3.5" strokeWidth={1.65} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Saker options</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-44">
        <DropdownMenuItem onSelect={openSettingsPage}>
          <Settings2 className="size-3.5" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={shortcuts}>
          <Keyboard className="size-3.5" /> Shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void window.api.app.restart()}>
          <RotateCcw className="size-3.5" /> Restart Saker
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
