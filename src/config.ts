/** Typed loaders for config/ui.json — UI knobs live in JSON, not scattered JSX. */

import ui from './config/ui.json'

export type AppTheme = 'red-dwarf' | 'earth' | 'black-hole'

export const APP_THEMES = ui.themes as { id: AppTheme; label: string }[]

export const DIAGRAM_ACCEPT = ui.diagramAccept
export const DIAGRAM_FORMAT_OPTIONS = ui.diagramFormats
export const ARCH_MODE_OPTIONS = ui.archModes
