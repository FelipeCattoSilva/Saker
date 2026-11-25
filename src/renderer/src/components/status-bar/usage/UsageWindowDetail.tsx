import type { ProviderRateLimits } from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { UsagePercentageDisplay } from '../../../../../shared/agent-usage/display/usage-percentage-display'
import { useIntlLocale, useTranslate, type Translate } from '@/i18n/use-translate'
import type { UsageSection } from './usage-headline-sections'
import { formatResetsInCaption } from './usage-reset-caption'
import { formatUsagePercentageLabel } from './usage-percentage-label'
import { UsageBar } from './usage-meter'

export function UsageWindowDetail({
  section,
  label,
  display,
  title,
  now
}: {
  section: UsageSection
  label: string
  display: UsagePercentageDisplay
  title?: string
  now: number
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const reset = formatResetsInCaption(section.window.resetsAt, now, locale, t)
  return (
    <div data-usage-window={section.label} title={title} className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {formatUsagePercentageLabel(section.window.usedPercent, display, t)}
        </span>
      </div>
      <UsageBar
        usedPercent={section.window.usedPercent}
        display={display}
        className="h-1.5 w-full"
      />
      {reset && <p className="text-2xs text-muted-foreground">{reset}</p>}
    </div>
  )
}
export function getUsageWindowTitle(
  provider: ProviderRateLimits,
  section: UsageSection,
  t: Translate
): string {
  if (section.window === provider.session && section.window.windowMinutes === 300) {
    return t('saker.usage.fiveHour', '5-hour limit')
  }
  if (section.window === provider.weekly && section.window.windowMinutes === 10080) {
    return t('saker.usage.weekly', 'Weekly limit')
  }
  return section.label
}
