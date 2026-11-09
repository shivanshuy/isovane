import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createWorkspace as createWorkspaceApi,
  deleteWorkspace as deleteWorkspaceApi,
  fetchFindings,
  fetchGateStats,
  fetchTraces,
  fetchWorkspaces,
  updateWorkspace as updateWorkspaceApi,
  type Finding,
  type Trace,
} from './api'
import {
  agents,
  cpuBars,
  logs,
  memoryBars,
  services,
  type LogLine,
  type Workspace,
  type WorkspaceIcon,
} from './data'
import { AnalyzeArchitecturePane, AnalyzeCodePane } from './panes/Analyze'
import { FixPane } from './panes/Fix'
import { WatchPane } from './panes/Watch'
import { Landing } from './pages/Landing'
import { navigate, parseHash, routeEquals, type AppRoute, type RouteView } from './routing'

type AppTheme = 'red-dwarf' | 'earth' | 'black-hole'

const APP_THEMES: { id: AppTheme; label: string }[] = [
  { id: 'red-dwarf', label: 'Red Dwarf' },
  { id: 'earth', label: 'Earth' },
  { id: 'black-hole', label: 'Black Hole' },
]
type Pane = 'welcome' | 'home' | 'overview' | 'analyze-code' | 'analyze-arch' | 'watch' | 'fix' | 'settings'
type LogFilter = 'all' | 'web' | 'emails'
type NavId = 'home' | 'analyze-code' | 'analyze-arch' | 'watch' | 'fix-dev' | 'fix-gate' | 'settings'
type FixLane = 'analyze' | 'watch'

function viewToPane(view: RouteView): { pane: Pane; nav: NavId; fixLane: FixLane } {
  if (view === 'watch') return { pane: 'watch', nav: 'watch', fixLane: 'watch' }
  if (view === 'settings') return { pane: 'settings', nav: 'settings', fixLane: 'analyze' }
  if (view === 'fix-dev') return { pane: 'fix', nav: 'fix-dev', fixLane: 'analyze' }
  if (view === 'fix-gate') return { pane: 'fix', nav: 'fix-gate', fixLane: 'watch' }
  if (view === 'analyze-arch') return { pane: 'analyze-arch', nav: 'analyze-arch', fixLane: 'analyze' }
  return { pane: 'analyze-code', nav: 'analyze-code', fixLane: 'analyze' }
}

function readInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return { kind: 'welcome' }
  const route = parseHash(window.location.hash)
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    navigate({ kind: 'welcome' }, true)
    return { kind: 'welcome' }
  }
  return route
}

function useTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'red-dwarf'
    const stored = window.localStorage.getItem('isovane-theme')
    if (stored === 'white-dwarf') return 'red-dwarf'
    if (stored === 'black-hole' || stored === 'earth' || stored === 'red-dwarf') return stored
    return 'red-dwarf'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('isovane-theme', theme)
  }, [theme])

  return { theme, setTheme }
}

function Mark({ icon }: { icon: WorkspaceIcon }) {
  if (icon === 'drop') return <span className="mark mark--drop" aria-hidden="true" />
  if (icon === 'bolt') {
    return (
      <span className="mark mark--bolt" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
          <path d="M7.2 0.5 2 6.8h3.1L4.8 11.5 10 5.2H6.8L7.2 0.5Z" />
        </svg>
      </span>
    )
  }
  if (icon === 's') return <span className="mark mark--s" aria-hidden="true">S</span>
  return <span className="mark mark--n" aria-hidden="true">N</span>
}

function NavIcon({
  kind,
}: {
  kind: 'analyze-code' | 'analyze-arch' | 'watch' | 'fix-dev' | 'fix-gate' | 'settings' | 'home'
}) {
  if (kind === 'home') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M2.5 7.2 8 2.5l5.5 4.7V13a1 1 0 0 1-1 1H9.2V9.4H6.8V14H3.5a1 1 0 0 1-1-1V7.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'analyze-code') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.4 10.4 13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'analyze-arch') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5.75" y="9" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4.75 7v1.2M11.25 7v1.2M7 9.5H6.2M10 9.5h-.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'watch') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
      </span>
    )
  }
  if (kind === 'fix-dev') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M3 12.5h10M4.2 10.2 10.8 3.6l1.6 1.6-6.6 6.6H4.2v-1.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'fix-gate') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4 2.5h3v11H4V2.5Zm5 0h3v11H9V2.5Z" fill="currentColor" />
        </svg>
      </span>
    )
  }
  return (
    <span className="nav__glyph" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function paneEyebrow(pane: Pane, fixLane: FixLane) {
  if (pane === 'home') return 'All agents'
  if (pane === 'analyze-code') return 'Find in code before ship'
  if (pane === 'analyze-arch') return 'Find in architecture before ship'
  if (pane === 'watch') return 'Gate outside the model'
  if (pane === 'fix' && fixLane === 'analyze') return 'Dev-time patch · code / prompt / architecture'
  if (pane === 'fix' && fixLane === 'watch') return 'Runtime patch · policy / sidecar'
  if (pane === 'settings') return 'Workspace'
  return 'Signal health'
}

function isArchitectureFinding(finding: Finding) {
  return finding.category === 'architecture' || Boolean(finding.evidence.diagram_region)
}

function Bars({ values, tone }: { values: number[]; tone: 'blue' | 'orange' }) {
  return (
    <div className={`bars bars--${tone}`} aria-hidden="true">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${value}%` }} />
      ))}
    </div>
  )
}

function asWorkspace(item: Workspace | Record<string, unknown>): Workspace {
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

export default function App() {
  const { theme, setTheme } = useTheme()
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  const [route, setRoute] = useState<AppRoute>(() => readInitialRoute())
  const [running, setRunning] = useState(true)
  const [watching, setWatching] = useState(true)
  const [startWithApp, setStartWithApp] = useState(false)
  const [logFilter, setLogFilter] = useState<LogFilter>('all')
  const [findings, setFindings] = useState<Finding[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [gate, setGate] = useState({ open: 0, denies: 0, ci: 0 })
  const [fixFocus, setFixFocus] = useState<string | null>(() => {
    const initial = readInitialRoute()
    return initial.kind === 'workspace' ? initial.findingId ?? null : null
  })

  const workspaceId = route.kind === 'workspace' ? route.workspaceId : null
  const mapped = route.kind === 'workspace' ? viewToPane(route.view) : null
  const onWelcome = route.kind === 'welcome'
  const pane: Pane = mapped?.pane ?? (onWelcome ? 'welcome' : 'home')
  const nav: NavId = mapped?.nav ?? 'home'
  const fixLane: FixLane = mapped?.fixLane ?? 'analyze'

  const workspace = workspaceId
    ? workspaceList.find((item) => item.id === workspaceId) ?? null
    : null
  const inWorkspace = workspace !== null
  const restoringWorkspace = route.kind === 'workspace' && workspacesLoading
  const visibleLogs = logs.filter((line) => logFilter === 'all' || line.source === logFilter)

  const applyRoute = useCallback((next: AppRoute) => {
    setRoute((current) => (routeEquals(current, next) ? current : next))
    if (next.kind === 'home' || next.kind === 'welcome') {
      setFindings([])
      setTraces([])
      setGate({ open: 0, denies: 0, ci: 0 })
      setFixFocus(null)
      return
    }
    setFixFocus(next.findingId ?? null)
  }, [])

  useEffect(() => {
    const onHash = () => applyRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      navigate({ kind: 'welcome' }, true)
      applyRoute({ kind: 'welcome' })
    }
    return () => window.removeEventListener('hashchange', onHash)
  }, [applyRoute])

  const refreshWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true)
    try {
      const payload = await fetchWorkspaces()
      setWorkspaceList((payload.workspaces || []).map(asWorkspace))
    } finally {
      setWorkspacesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshWorkspaces().catch(() => {
      setWorkspaceList([])
      setWorkspacesLoading(false)
    })
  }, [refreshWorkspaces])

  useEffect(() => {
    if (workspacesLoading || route.kind !== 'workspace') return
    const exists = workspaceList.some((item) => item.id === route.workspaceId)
    if (!exists) {
      navigate({ kind: 'home' }, true)
      applyRoute({ kind: 'home' })
    }
  }, [workspacesLoading, workspaceList, route, applyRoute])

  const refreshSecurity = useCallback(async () => {
    if (!workspaceId) return
    try {
      const [f, t, g] = await Promise.all([
        fetchFindings(workspaceId),
        fetchTraces(workspaceId),
        fetchGateStats(workspaceId),
      ])
      setFindings(f.findings)
      setTraces(t.traces)
      setGate(g)
    } catch {
      // API optional while shell loads; keep last known state
    }
  }, [workspaceId])

  useEffect(() => {
    void refreshSecurity()
  }, [refreshSecurity])

  const openCodeFindings = findings.filter(
    (f) =>
      (f.status === 'open' || f.status === 'accepted') &&
      f.source === 'analyze' &&
      !isArchitectureFinding(f),
  ).length
  const openArchFindings = findings.filter(
    (f) =>
      (f.status === 'open' || f.status === 'accepted') &&
      f.source === 'analyze' &&
      isArchitectureFinding(f),
  ).length
  const openDevFixes = findings.filter(
    (f) => (f.status === 'open' || f.status === 'accepted') && f.source === 'analyze',
  ).length
  const openGateFixes = findings.filter(
    (f) =>
      (f.status === 'open' || f.status === 'accepted') &&
      (f.source === 'watch' || f.source === 'hunt' || f.category === 'runtime'),
  ).length

  const goWelcome = () => {
    navigate({ kind: 'welcome' })
    applyRoute({ kind: 'welcome' })
  }

  const goHome = () => {
    navigate({ kind: 'home' })
    applyRoute({ kind: 'home' })
  }

  const openWorkspace = (id: string) => {
    const next: AppRoute = { kind: 'workspace', workspaceId: id, view: 'analyze-code' }
    navigate(next)
    applyRoute(next)
  }

  const goView = (viewName: RouteView) => {
    if (!workspaceId) return
    const next: AppRoute = { kind: 'workspace', workspaceId, view: viewName }
    navigate(next)
    applyRoute(next)
  }

  const openFix = (lane: FixLane, findingId?: string) => {
    if (!workspaceId) return
    const next: AppRoute = {
      kind: 'workspace',
      workspaceId,
      view: lane === 'analyze' ? 'fix-dev' : 'fix-gate',
      findingId,
    }
    navigate(next)
    applyRoute(next)
  }

  const handleCreate = async (payload: { name: string; description: string }) => {
    const created = asWorkspace(
      await createWorkspaceApi({
        name: payload.name,
        description: payload.description || undefined,
      }),
    )
    setWorkspaceList((prev) => [...prev.filter((w) => w.id !== created.id), created])
  }

  const handleDelete = async (id: string) => {
    const target = workspaceList.find((item) => item.id === id)
    if (!target) return
    if (!window.confirm(`Delete workspace “${target.name}”?`)) return
    await deleteWorkspaceApi(id)
    setWorkspaceList((prev) => prev.filter((item) => item.id !== id))
    if (workspaceId === id) goHome()
  }

  const handleUpdate = async (
    id: string,
    payload: { name?: string; description?: string; folder?: string },
  ) => {
    const updated = asWorkspace(await updateWorkspaceApi(id, payload))
    setWorkspaceList((prev) => prev.map((item) => (item.id === id ? updated : item)))
  }

  const themeSwitcher = useMemo(
    () => (
      <div className="theme-switch" role="radiogroup" aria-label="Theme">
        <div className="theme-switch__control theme-switch__control--trio">
          {APP_THEMES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              className={
                theme === id
                  ? 'theme-switch__chip theme-switch__chip--active'
                  : 'theme-switch__chip'
              }
              onClick={() => setTheme(id)}
            >
              <span className={`theme-switch__swatch theme-switch__swatch--${id}`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    ),
    [setTheme, theme],
  )

  return (
    <div className="shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={goWelcome} aria-label="Go to welcome">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="currentColor"
                d="M7 6h6a1.5 1.5 0 0 1 1.5 1.5v17A1.5 1.5 0 0 1 13 26H7a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 7 6zm12 0h6a1.5 1.5 0 0 1 1.5 1.5v17a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 19 6z"
              />
            </svg>
          </span>
          <div>
            <strong>Isovane</strong>
            <span>Agent security</span>
          </div>
        </button>
        <nav className="topbar__nav" aria-label="Primary">
          <button
            type="button"
            className={onWelcome ? 'topbar__link topbar__link--on' : 'topbar__link'}
            aria-current={onWelcome ? 'page' : undefined}
            onClick={goWelcome}
          >
            Home
          </button>
          <button
            type="button"
            className={
              route.kind === 'home' || inWorkspace || restoringWorkspace
                ? 'topbar__link topbar__link--on'
                : 'topbar__link'
            }
            aria-current={route.kind === 'home' ? 'page' : undefined}
            onClick={goHome}
          >
            Workspaces
          </button>
        </nav>
        {themeSwitcher}
      </header>

      <div
        className={
          inWorkspace || restoringWorkspace
            ? 'frame'
            : onWelcome
              ? 'frame frame--landing'
              : 'frame frame--home'
        }
      >
        {inWorkspace ? (
          <aside className="nav">
            <div className="nav__lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>

            <button
              className={nav === 'home' ? 'nav__link nav__link--on' : 'nav__link'}
              type="button"
              onClick={goHome}
            >
              <NavIcon kind="home" />
              Workspaces
            </button>

            <p className="nav__label nav__label--workspace">{workspace.name}</p>

            <div
              className={
                nav === 'analyze-code' || nav === 'analyze-arch' || nav === 'fix-dev'
                  ? 'nav__flow nav__flow--on'
                  : 'nav__flow'
              }
            >
              <p className="nav__flow-label">Find → patch</p>
              <button
                className={nav === 'analyze-code' ? 'nav__link nav__link--on' : 'nav__link'}
                type="button"
                onClick={() => goView('analyze-code')}
              >
                <NavIcon kind="analyze-code" />
                Code
                <em>{openCodeFindings} open</em>
              </button>
              <button
                className={nav === 'analyze-arch' ? 'nav__link nav__link--on' : 'nav__link'}
                type="button"
                onClick={() => goView('analyze-arch')}
              >
                <NavIcon kind="analyze-arch" />
                Architecture
                <em>{openArchFindings} open</em>
              </button>
              <button
                className={
                  nav === 'fix-dev'
                    ? 'nav__link nav__link--sub nav__link--on'
                    : 'nav__link nav__link--sub'
                }
                type="button"
                onClick={() => openFix('analyze')}
              >
                <NavIcon kind="fix-dev" />
                Dev fix
                <em>{openDevFixes}</em>
              </button>
            </div>

            <div
              className={
                nav === 'watch' || nav === 'fix-gate' ? 'nav__flow nav__flow--on' : 'nav__flow'
              }
            >
              <p className="nav__flow-label">Watch → gate</p>
              <button
                className={nav === 'watch' ? 'nav__link nav__link--on' : 'nav__link'}
                type="button"
                onClick={() => goView('watch')}
              >
                <NavIcon kind="watch" />
                Watch
                <em>{gate.denies} denies</em>
              </button>
              <button
                className={
                  nav === 'fix-gate'
                    ? 'nav__link nav__link--sub nav__link--on'
                    : 'nav__link nav__link--sub'
                }
                type="button"
                onClick={() => openFix('watch')}
              >
                <NavIcon kind="fix-gate" />
                Gate fix
                <em>{openGateFixes}</em>
              </button>
            </div>

            <button
              className={
                nav === 'settings' ? 'nav__link nav__link--foot nav__link--on' : 'nav__link nav__link--foot'
              }
              type="button"
              onClick={() => goView('settings')}
            >
              <NavIcon kind="settings" />
              Settings
            </button>
          </aside>
        ) : null}

        <main className="stage">
          {restoringWorkspace ? (
            <section className="stage__head">
              <div>
                <p className="stage__eyebrow">Restoring</p>
                <h1>Opening workspace…</h1>
                <p>{workspaceId}</p>
              </div>
            </section>
          ) : null}

          {inWorkspace ? (
            <section className="stage__head">
              <div>
                <p className="stage__eyebrow">{paneEyebrow(pane, fixLane)}</p>
                <h1>{workspace.name}</h1>
                <p>{workspace.description || 'No description yet.'}</p>
              </div>
            </section>
          ) : null}

          {!restoringWorkspace && onWelcome ? <Landing onEnter={goHome} /> : null}
          {!restoringWorkspace && !onWelcome && (pane === 'home' || !inWorkspace) ? (
            <Home
              workspaces={workspaceList}
              loading={workspacesLoading}
              onOpen={openWorkspace}
              onCreate={handleCreate}
              onDelete={handleDelete}
            />
          ) : null}
          {inWorkspace && pane === 'overview' ? (
            <Overview
              workspace={workspace}
              logs={visibleLogs}
              filter={logFilter}
              onFilter={setLogFilter}
              running={running}
              gate={gate}
            />
          ) : null}
          {inWorkspace && pane === 'analyze-code' ? (
            <AnalyzeCodePane
              workspaceId={workspace.id}
              findings={findings}
              onRefresh={refreshSecurity}
              onOpenFix={(id) => openFix('analyze', id)}
            />
          ) : null}
          {inWorkspace && pane === 'analyze-arch' ? (
            <AnalyzeArchitecturePane
              workspaceId={workspace.id}
              findings={findings}
              onRefresh={refreshSecurity}
              onOpenFix={(id) => openFix('analyze', id)}
            />
          ) : null}
          {inWorkspace && pane === 'watch' ? (
            <WatchPane
              workspaceId={workspace.id}
              traces={traces}
              watching={watching}
              onWatching={setWatching}
              onRefresh={refreshSecurity}
              onOpenFix={(id) => openFix('watch', id)}
            />
          ) : null}
          {inWorkspace && pane === 'fix' ? (
            <FixPane
              findings={findings}
              focusId={fixFocus}
              initialLane={fixLane}
              onRefresh={refreshSecurity}
            />
          ) : null}
          {inWorkspace && pane === 'settings' ? (
            <Settings
              workspace={workspace}
              running={running}
              onRunning={setRunning}
              startWithApp={startWithApp}
              onStartWithApp={setStartWithApp}
              onSave={async (payload) => {
                await handleUpdate(workspace.id, payload)
              }}
              onRemove={() => {
                void handleDelete(workspace.id)
              }}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function Home({
  workspaces: items,
  loading,
  onOpen,
  onCreate,
  onDelete,
}: {
  workspaces: Workspace[]
  loading: boolean
  onOpen: (id: string) => void
  onCreate: (payload: { name: string; description: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!menuId) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest(`[data-workspace-menu="${menuId}"]`)) return
      setMenuId(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the workspace a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <section className="stage__head home__head">
        <div>
          <p className="stage__eyebrow">All agents</p>
          <h1>Workspaces</h1>
          <p>Select an agent to secure, or create a new workspace.</p>
        </div>
        <button
          className="btn btn--accent btn--sm"
          type="submit"
          form="workspace-create"
          disabled={busy}
        >
          {busy ? 'Creating…' : 'Create workspace'}
        </button>
      </section>

      <form
        id="workspace-create"
        className="home__create"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="checkout-agent"
            autoComplete="off"
          />
        </label>
        <label className="home__create-desc">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this agent does and why it needs a gate."
            rows={3}
          />
        </label>
        {error ? <p className="home__error">{error}</p> : null}
      </form>

      {loading ? <p className="home__empty">Loading workspaces…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="home__empty">No workspaces yet. Create one above.</p>
      ) : null}
      <ul className="home__list">
        {items.map((item) => (
          <li key={item.id} className="home__row">
            <button type="button" className="home__card" onClick={() => onOpen(item.id)}>
              <Mark icon={item.icon} />
              <div>
                <strong>{item.name}</strong>
                <small>{item.description || 'No description'}</small>
              </div>
            </button>
            <div className="home__menu" data-workspace-menu={item.id}>
              <button
                type="button"
                className={menuId === item.id ? 'home__more home__more--on' : 'home__more'}
                aria-label={`Workspace actions for ${item.name}`}
                aria-haspopup="menu"
                aria-expanded={menuId === item.id}
                disabled={deletingId === item.id}
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuId((current) => (current === item.id ? null : item.id))
                }}
              >
                <span aria-hidden="true">⋯</span>
              </button>
              {menuId === item.id ? (
                <div className="home__menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="home__menu-item home__menu-item--danger"
                    disabled={deletingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      setMenuId(null)
                      setDeletingId(item.id)
                      void onDelete(item.id)
                        .catch((err) => {
                          setError(err instanceof Error ? err.message : 'Could not delete workspace')
                        })
                        .finally(() => setDeletingId(null))
                    }}
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Overview({
  workspace,
  logs: lines,
  filter,
  onFilter,
  running,
  gate,
}: {
  workspace: Workspace
  logs: LogLine[]
  filter: LogFilter
  onFilter: (filter: LogFilter) => void
  running: boolean
  gate: { open: number; denies: number; ci: number }
}) {
  return (
    <div className="overview">
      <div className="meters">
        <article className="card">
          <header>
            <span>CPU</span>
            <Bars values={cpuBars} tone="blue" />
          </header>
          <strong>{workspace.cpu} %</strong>
          <small>{workspace.cpuPeak}</small>
        </article>
        <article className="card">
          <header>
            <span>Memory</span>
            <Bars values={memoryBars} tone="orange" />
          </header>
          <strong>{workspace.memory}</strong>
          <small>{workspace.memoryOf}</small>
        </article>
        <article className="card card--gate">
          <header>
            <span>Gate</span>
            <span className="pulse" />
          </header>
          <strong>
            {gate.open} · {gate.denies} · {gate.ci}
          </strong>
          <small>open · denies · CI</small>
        </article>
      </div>

      <div className="split">
        <article className="card card--stack">
          <header className="card__title">
            <span>Ports</span>
            <button type="button">+ Add</button>
          </header>
          <ul className="ports">
            {workspace.ports.map((port) => (
              <li key={port.port}>
                <span>{port.label}</span>
                <code>:{port.port}</code>
              </li>
            ))}
          </ul>
        </article>

        <article className="card card--stack">
          <header className="card__title">
            <span>Agents {agents.length}</span>
          </header>
          <ul className="agents">
            {agents.map((agent) => (
              <li key={agent.id}>
                <span className={`agent__icon agent__icon--${agent.tone}`} aria-hidden="true">
                  {agent.tone === 'idle' ? '⌘' : '✶'}
                </span>
                <div>
                  <strong>{agent.title}</strong>
                  <small>{agent.meta}</small>
                </div>
                <span className={`track track--${agent.tone}`}>
                  <i style={{ width: agent.width }} />
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="card card--logs">
        <header className="card__title">
          <span>
            Services {running ? '2 running' : 'stopped'}
            <em>{workspace.uptime} uptime · since {workspace.since}</em>
          </span>
          <div className="filters" role="tablist" aria-label="Log source">
            {(['all', 'web', 'emails'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'filters__btn filters__btn--on' : 'filters__btn'}
                onClick={() => onFilter(item)}
              >
                {item === 'all' ? 'All' : item}
              </button>
            ))}
          </div>
        </header>
        <ul className="services">
          {services.map((service) => (
            <li key={service.name}>
              <i className={running ? 'dot dot--on' : 'dot'} />
              <strong>{service.name}</strong>
              <code>{service.command}</code>
            </li>
          ))}
        </ul>
        <div className="log" role="log" aria-live="polite">
          {lines.map((line) => (
            <p key={`${line.time}-${line.text}`}>
              <time>{line.time}</time>
              <b className={line.source === 'emails' ? 'src src--mail' : 'src'}>{line.source}</b>
              <span className={line.kind === 'ok' ? 'log__ok' : undefined}>{line.text}</span>
            </p>
          ))}
        </div>
      </article>
    </div>
  )
}

function Settings({
  workspace,
  running,
  onRunning,
  startWithApp,
  onStartWithApp,
  onSave,
  onRemove,
}: {
  workspace: Workspace
  running: boolean
  onRunning: (value: boolean) => void
  startWithApp: boolean
  onStartWithApp: (value: boolean) => void
  onSave: (payload: { name: string; description: string }) => Promise<void>
  onRemove: () => void
}) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setName(workspace.name)
    setDescription(workspace.description)
    setMessage(null)
  }, [workspace.id, workspace.name, workspace.description])

  const save = async () => {
    if (!name.trim()) {
      setMessage('Name is required.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() })
      setMessage('Saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save workspace')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings__bar">
        <button className="btn btn--accent btn--sm" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span className={running ? 'run run--on' : 'run'}>{running ? 'Running' : 'Stopped'}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={running}
            onChange={(event) => onRunning(event.target.checked)}
            aria-label="Running"
          />
          <span />
        </label>
      </div>

      <section className="card form">
        <h2>Workspace</h2>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
        {message ? <p className="hint">{message}</p> : null}
        <div className="form__row">
          <span>Start when Isovane opens</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={startWithApp}
              onChange={(event) => onStartWithApp(event.target.checked)}
              aria-label="Start when Isovane opens"
            />
            <span />
          </label>
        </div>
      </section>

      <button className="danger" type="button" onClick={onRemove}>
        Remove workspace…
      </button>
    </div>
  )
}
