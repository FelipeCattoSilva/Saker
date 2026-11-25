import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../../shared/constants'
import { normalizeLoadedUiState } from './normalize-loaded-ui-state'

describe('Saker usage display migration', () => {
  it('switches existing consumption displays once and preserves later explicit preferences', () => {
    const defaults = getDefaultPersistedState('/fixture')
    const old = {
      ...defaults,
      ui: {
        ...defaults.ui,
        usagePercentageDisplay: 'used' as const,
        _sakerUsageRemainingMigrated: undefined
      }
    }
    const migrated = normalizeLoadedUiState(
      old,
      defaults,
      defaults.onboarding,
      false,
      false,
      () => {}
    )
    expect(migrated.usagePercentageDisplay).toBe('remaining')
    const chosen = { ...old, ui: { ...migrated, usagePercentageDisplay: 'used' as const } }
    const loaded = normalizeLoadedUiState(
      chosen,
      defaults,
      defaults.onboarding,
      false,
      false,
      () => {}
    )
    expect(loaded.usagePercentageDisplay).toBe('used')
  })
})
