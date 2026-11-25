import { Suspense, type JSX } from 'react'
import type { TopLevelView } from '../../../shared/ui-chrome-types'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { NotificationCardStack } from '../components/NotificationCardStack'
import { OverlayBoundary } from './app-root-surface-boundaries'

const UnexpectedSignoutCard = lazy(() =>
  import('../components/UnexpectedSignoutCard').then((module) => ({
    default: module.UnexpectedSignoutCard
  }))
)

/**
 * Saker removes Orca onboarding, promotional and release cards.
 * Keep account/security notifications so hiding promotional chrome never hides
 * an actionable sign-out.
 */
export function AppNotificationCards({
  activeView
}: {
  activeView: TopLevelView
  shouldMountUpdateCard: boolean
  chatUiHereCornerCardOpen: boolean
  onChatUiHereCornerCardClose: () => void
}): JSX.Element {
  return (
    <NotificationCardStack>
      <Suspense fallback={null}>
        <OverlayBoundary boundaryId="overlay.unexpected-signout" resetKey={activeView}>
          <UnexpectedSignoutCard />
        </OverlayBoundary>
      </Suspense>
    </NotificationCardStack>
  )
}
