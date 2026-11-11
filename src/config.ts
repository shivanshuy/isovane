/** Typed loaders for config/ui.json — UI knobs live in JSON, not scattered JSX. */

import ui from './config/ui.json'
import type { FixLane } from './findings'

export type AppTheme = 'red-dwarf' | 'earth' | 'black-hole'

export const APP_THEMES = ui.themes as { id: AppTheme; label: string }[]

export const DIAGRAM_ACCEPT = ui.diagramAccept
export const DIAGRAM_FORMAT_OPTIONS = ui.diagramFormats
export const ARCH_MODE_OPTIONS = ui.archModes

const EYEBROWS = ui.paneEyebrows as Record<string, string>

export function paneEyebrow(
  pane: string,
  fixLane: FixLane,
): string {
  if (pane === 'fix' && fixLane === 'analyze') return EYEBROWS['fix-analyze']
  if (pane === 'fix' && fixLane === 'watch') return EYEBROWS['fix-watch']
  return EYEBROWS[pane] || EYEBROWS.default
}
