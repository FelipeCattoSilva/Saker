import { app, type BrowserWindow } from 'electron'
import icon from '../../../../resources/build/icon.ico?asset&asarUnpack'
import {
  CUSTOM_APP_ICON_ID,
  normalizeAppIconId
} from '../../../shared/app-lifecycle/identity/app-icon'
import { getDevInstanceIdentity } from '../../startup/profile-startup/dev-instance-identity'
import { getAppIconPath } from './app-icon'

export function getWindowsWindowIconPath(value: unknown): string {
  return normalizeAppIconId(value) === CUSTOM_APP_ICON_ID ? getAppIconPath(value) : icon
}

export function applyWindowsTaskbarIcon(window: BrowserWindow): void {
  if (process.platform !== 'win32') {
    return
  }
  const identity = getDevInstanceIdentity(!app.isPackaged)
  window.setAppDetails({ appId: identity.appUserModelId, appIconPath: icon })
}
