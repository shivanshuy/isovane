/** Shell routing helpers — keep App.tsx focused on wiring state → panes. */

import type { Workspace, WorkspaceIcon } from './data'
import type { FixLane } from './findings'
import { navigate, parseHash, type AppRoute, type RouteView } from './routing'

export type Pane =
  | 'welcome'
  | 'home'
  | 'analyze-code'
  | 'analyze-arch'
  | 'watch'
  | 'fix'
  | 'settings'
  | 'playground'

export type NavId =
  | 'home'
  | 'analyze-code'
  | 'analyze-arch'
  | 'watch'
  | 'fix-dev'
  | 'fix-gate'
  | 'settings'
  | 'playground'

export function viewToPane(view: RouteView): { pane: Pane; nav: NavId; fixLane: FixLane } {
  if (view === 'watch') return { pane: 'watch', nav: 'watch', fixLane: 'watch' }
  if (view === 'playground') return { pane: 'playground', nav: 'playground', fixLane: 'analyze' }
  if (view === 'fix-dev') return { pane: 'fix', nav: 'fix-dev', fixLane: 'analyze' }
  if (view === 'fix-gate') return { pane: 'fix', nav: 'fix-gate', fixLane: 'watch' }
  if (view === 'analyze-arch') return { pane: 'analyze-arch', nav: 'analyze-arch', fixLane: 'analyze' }
  return { pane: 'analyze-code', nav: 'analyze-code', fixLane: 'analyze' }
}

export function readInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return { kind: 'welcome' }
  const route = parseHash(window.location.hash)
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    navigate({ kind: 'welcome' }, true)
    return { kind: 'welcome' }
  }
  return route
}

export function asWorkspace(item: Workspace | Record<string, unknown>): Workspace {
  const icon = (item.icon as WorkspaceIcon) || 'drop'
  return {
    id: String(item.id),
    name: String(item.name),
    description: String(item.description ?? ''),
    folder: String(item.folder ?? ''),
    stack: String(item.stack ?? 'Agent'),
    branch: String(item.branch ?? 'main'),
    icon: icon === 'n' || icon === 'bolt' || icon === 's' || icon === 'drop' ? icon : 'drop',
    url: String(item.url ?? ''),
    uptime: String(item.uptime ?? '—'),
    since: String(item.since ?? '—'),
    cpu: Number(item.cpu ?? 0),
    cpuPeak: String(item.cpuPeak ?? '—'),
    memory: String(item.memory ?? '—'),
    memoryOf: String(item.memoryOf ?? ''),
    energy: String(item.energy ?? '—'),
    energyNote: String(item.energyNote ?? ''),
    ports: Array.isArray(item.ports)
      ? (item.ports as { label: string; port: string }[])
      : [],
  }
}
