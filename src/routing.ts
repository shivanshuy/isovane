export type RouteView =
  | 'analyze-code'
  | 'analyze-arch'
  | 'watch'
  | 'fix-dev'
  | 'fix-gate'
  | 'settings'

export type AppRoute =
  | { kind: 'welcome' }
  | { kind: 'home' }
  | { kind: 'workspace'; workspaceId: string; view: RouteView; findingId?: string }

const VIEWS = new Set<RouteView>([
  'analyze-code',
  'analyze-arch',
  'watch',
  'fix-dev',
  'fix-gate',
  'settings',
])

function normalizeHash(raw: string): string {
  let value = (raw || '').trim()
  if (value.startsWith('#')) value = value.slice(1)
  if (!value.startsWith('/')) value = `/${value}`
  return value.replace(/\/+$/, '') || '/'
}

export function parseHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): AppRoute {
  const path = normalizeHash(hash)
  const [pathname, query = ''] = path.split('?')
  const parts = pathname.split('/').filter(Boolean)
  const params = new URLSearchParams(query)
  const findingId = params.get('f') || undefined

  if (parts.length === 0 || parts[0] === 'welcome') {
    return { kind: 'welcome' }
  }

  if (parts[0] === 'workspaces') {
    return { kind: 'home' }
  }

  if (parts[0] === 'w' && parts[1]) {
    const workspaceId = decodeURIComponent(parts[1])
    const viewPart = parts[2]
    const lanePart = parts[3]
    let view: RouteView = 'analyze-code'

    if (viewPart === 'watch') view = 'watch'
    else if (viewPart === 'settings') view = 'settings'
    else if (viewPart === 'fix' && lanePart === 'gate') view = 'fix-gate'
    else if (viewPart === 'fix' && (lanePart === 'dev' || !lanePart)) view = 'fix-dev'
    else if (viewPart === 'fix-dev') view = 'fix-dev'
    else if (viewPart === 'fix-gate') view = 'fix-gate'
    else if (viewPart === 'architecture' || viewPart === 'analyze-arch') view = 'analyze-arch'
    else if (viewPart === 'analyze' && lanePart === 'architecture') view = 'analyze-arch'
    else if (viewPart === 'analyze' && (lanePart === 'code' || !lanePart)) view = 'analyze-code'
    else if (viewPart === 'code' || viewPart === 'analyze-code') view = 'analyze-code'
    else if (VIEWS.has(viewPart as RouteView)) view = viewPart as RouteView

    return { kind: 'workspace', workspaceId, view, findingId }
  }

  return { kind: 'welcome' }
}

export function toHash(route: AppRoute): string {
  if (route.kind === 'welcome') return '#/welcome'
  if (route.kind === 'home') return '#/workspaces'
  const base = `#/w/${encodeURIComponent(route.workspaceId)}`
  const viewPath =
    route.view === 'fix-dev'
      ? '/fix/dev'
      : route.view === 'fix-gate'
        ? '/fix/gate'
        : route.view === 'analyze-code'
          ? '/analyze/code'
          : route.view === 'analyze-arch'
            ? '/analyze/architecture'
            : `/${route.view}`
  const query = route.findingId ? `?f=${encodeURIComponent(route.findingId)}` : ''
  return `${base}${viewPath}${query}`
}

export function navigate(route: AppRoute, replace = false) {
  const next = toHash(route)
  if (typeof window === 'undefined') return
  if (replace) {
    window.history.replaceState(null, '', next)
  } else if (window.location.hash !== next) {
    window.location.hash = next
  }
}

export function routeEquals(a: AppRoute, b: AppRoute): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'welcome' || b.kind === 'welcome') return a.kind === b.kind
  if (a.kind === 'home' || b.kind === 'home') return a.kind === b.kind
  return (
    a.workspaceId === b.workspaceId &&
    a.view === b.view &&
    (a.findingId || undefined) === (b.findingId || undefined)
  )
}
