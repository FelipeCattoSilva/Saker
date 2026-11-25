import { useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent
} from '@/components/ui/dropdown-menu'
import { UsageRosterPanel } from './UsageRosterPanel'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
const now = Date.now()
const provider: ProviderRateLimits = {
  provider: 'codex',
  status: 'ok',
  error: null,
  updatedAt: now,
  session: {
    usedPercent: 36,
    windowMinutes: 300,
    resetsAt: now + 16200000,
    resetDescription: null
  },
  weekly: {
    usedPercent: 23,
    windowMinutes: 10080,
    resetsAt: now + 259200000,
    resetDescription: null
  }
}
function Preview({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const [mode, setMode] = useState<StatusBarUsageMode>(compact ? 'compact' : 'verbose')
  const display = useAppStore((state) => state.usagePercentageDisplay)
  return (
    <div className="h-[540px] bg-background p-4">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Limites de IA</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[440px]">
          <UsageRosterPanel
            providers={[provider]}
            display={display}
            statusBarUsageMode={mode}
            onStatusBarUsageModeChange={setMode}
            isRefreshing={false}
            onRefresh={() => {}}
            onOpenProvider={() => {}}
            onSignIn={() => {}}
            canSignIn={() => false}
            onManageAccounts={() => {}}
            onUsageDetails={() => {}}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
export const limits = defineFixture({
  width: 480,
  store: { usagePercentageDisplay: 'remaining' },
  render: () => <Preview />
})
export const summary = defineFixture({
  width: 480,
  store: { usagePercentageDisplay: 'remaining' },
  render: () => <Preview compact />
})
