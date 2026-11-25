import { lazyWithPreload } from '@/app-shell/startup/lazy-with-retry'
import { timeRendererStartupStep } from '@/startup/startup-diagnostics'

export const LazyEditorPanel = lazyWithPreload(
  () => timeRendererStartupStep('editor-panel-import', () => import('./EditorPanel')),
  { reloadKey: 'editor-panel' }
)
