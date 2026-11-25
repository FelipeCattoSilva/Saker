import type React from 'react'
import { useEffect, useState } from 'react'
import { SettingsGroup } from '../section-layout/SettingsGroup'

export function GeneralUpdateSettingsSection({
  children
}: { children?: React.ReactNode } = {}): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void window.api.updater
      .getVersion()
      .then((value) => {
        if (active) {
          setVersion(value)
        }
      })
      .catch(() => {
        if (active) {
          setVersion(null)
        }
      })
    return () => {
      active = false
    }
  }, [])
  return (
    <SettingsGroup title="Sobre o Saker">
      <div data-settings-row="" className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Saker IDE</span>
          <span className="font-mono text-xs text-muted-foreground">
            {version ?? 'Versão indisponível'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta versão é atualizada por uma nova build e pelo instalador do Saker.
        </p>
      </div>
      {children}
    </SettingsGroup>
  )
}
