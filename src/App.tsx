import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { asWorkspace, readInitialRoute, viewToPane, type NavId, type Pane } from './appShell'
import { NavIcon } from './components/ShellIcons'
import { STORAGE_WATCH_GATE } from './constants'
import type { Workspace } from './data'
import { isArchitectureFinding, isOpenFinding, laneOf, type FixLane } from './findings'
import { useTheme } from './hooks/useTheme'
import { AnalyzeArchitecturePane, AnalyzeCodePane } from './panes/Analyze'
import { FixPane } from './panes/Fix'
import { PlaygroundPane } from './panes/Playground'
import { WatchPane } from './panes/Watch'
import { Home } from './pages/Home'
import { Landing } from './pages/Landing'
import { Settings } from './pages/Settings'
import { navigate, parseHash, routeEquals, type AppRoute, type RouteView } from './routing'

export default function App() {
  const { theme, setTheme, themes } = useTheme()
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  const [route, setRoute] = useState<AppRoute>(() => readInitialRoute())
  const [watching, setWatching] = useState(true)
  const [watchGateEnabled, setWatchGateEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem(STORAGE_WATCH_GATE)
    if (stored === '0' || stored === 'false') return false
    return true
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_WATCH_GATE, watchGateEnabled ? '1' : '0')
  }, [watchGateEnabled])
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
  const onSettings = route.kind === 'settings'
  const pane: Pane = mapped?.pane ?? (onWelcome ? 'welcome' : onSettings ? 'settings' : 'home')
  const nav: NavId = mapped?.nav ?? (onSettings ? 'settings' : 'home')
  const fixLane: FixLane = mapped?.fixLane ?? 'analyze'

  const workspace = workspaceId
    ? workspaceList.find((item) => item.id === workspaceId) ?? null
    : null
  const inWorkspace = workspace !== null
  const restoringWorkspace = route.kind === 'workspace' && workspacesLoading
  const applyRoute = useCallback((next: AppRoute) => {
    setRoute((current) => (routeEquals(current, next) ? current : next))
    if (next.kind === 'home' || next.kind === 'welcome' || next.kind === 'settings') {
      setFindings([])
      setTraces([])
      setGate({ open: 0, denies: 0, ci: 0 })
      setFixFocus(null)
      return
    }
    setFixFocus(next.kind === 'workspace' ? next.findingId ?? null : null)
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
    (f) => isOpenFinding(f) && f.source === 'analyze' && !isArchitectureFinding(f),
  ).length
  const openArchFindings = findings.filter(
    (f) => isOpenFinding(f) && f.source === 'analyze' && isArchitectureFinding(f),
  ).length
  const openDevFixes = findings.filter(
    (f) => isOpenFinding(f) && f.source === 'analyze',
  ).length
  const openGateFixes = findings.filter(
    (f) => isOpenFinding(f) && laneOf(f) === 'watch',
  ).length

  const goWelcome = () => {
    navigate({ kind: 'welcome' })
    applyRoute({ kind: 'welcome' })
  }

  const goHome = () => {
    navigate({ kind: 'home' })
    applyRoute({ kind: 'home' })
  }

  const goSettings = () => {
    navigate({ kind: 'settings' })
    applyRoute({ kind: 'settings' })
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

  useEffect(() => {
    if (watchGateEnabled || !workspaceId) return
    if (pane === 'watch' || (pane === 'fix' && fixLane === 'watch')) {
      goView('analyze-code')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchGateEnabled, pane, fixLane, workspaceId])

  const openSimulate = (findingId?: string) => {
    if (!workspaceId) return
    const next: AppRoute = {
      kind: 'workspace',
      workspaceId,
      view: 'playground',
      findingId,
    }
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
    if (!window.confirm(`Delete workspace "${target.name}"?`)) return
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
          {themes.map(({ id, label }) => (
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
    [setTheme, theme, themes],
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
          <button
            type="button"
            className={onSettings ? 'topbar__link topbar__link--on' : 'topbar__link'}
            aria-current={onSettings ? 'page' : undefined}
            onClick={goSettings}
          >
            Settings
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
              : onSettings
                ? 'frame frame--home'
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
                Code Fix
                <em>{openDevFixes}</em>
              </button>
            </div>

            {watchGateEnabled ? (
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
            ) : null}

            <button
              className={nav === 'playground' ? 'nav__link nav__link--on' : 'nav__link'}
              type="button"
              onClick={() => goView('playground')}
            >
              <NavIcon kind="playground" />
              Playground
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
                <h1>{workspace.name}</h1>
                {workspace.description ? <p>{workspace.description}</p> : null}
              </div>
            </section>
          ) : null}

          {!restoringWorkspace && onWelcome ? <Landing onEnter={goHome} /> : null}
          {!restoringWorkspace && onSettings ? (
            <Settings
              watchGateEnabled={watchGateEnabled}
              onWatchGateEnabled={setWatchGateEnabled}
            />
          ) : null}
          {!restoringWorkspace && !onWelcome && !onSettings && (pane === 'home' || !inWorkspace) ? (
            <Home
              workspaces={workspaceList}
              loading={workspacesLoading}
              onOpen={openWorkspace}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : null}
          {inWorkspace && pane === 'analyze-code' ? (
            <AnalyzeCodePane
              workspaceId={workspace.id}
              findings={findings}
              onRefresh={refreshSecurity}
              onOpenFix={(id) => openFix('analyze', id)}
              onSimulate={openSimulate}
              initialFindingId={
                route.kind === 'workspace' && route.view === 'analyze-code'
                  ? route.findingId
                  : null
              }
            />
          ) : null}
          {inWorkspace && pane === 'analyze-arch' ? (
            <AnalyzeArchitecturePane
              workspaceId={workspace.id}
              findings={findings}
              onRefresh={refreshSecurity}
              onOpenFix={(id) => openFix('analyze', id)}
              onSimulate={openSimulate}
              initialFindingId={
                route.kind === 'workspace' && route.view === 'analyze-arch'
                  ? route.findingId
                  : null
              }
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
          {inWorkspace && pane === 'playground' ? (
            <PlaygroundPane
              findingId={
                route.kind === 'workspace' && route.view === 'playground'
                  ? route.findingId
                  : null
              }
              findings={findings.filter(
                isOpenFinding,
              )}
              onSelectFinding={(id) => openSimulate(id)}
              onOpenFix={(id) => openFix('analyze', id)}
              onOpenWatch={() => goView('watch')}
              onOpenAnalyze={() => {
                if (!workspaceId) return
                const fid =
                  route.kind === 'workspace' && route.view === 'playground'
                    ? route.findingId
                    : undefined
                const target = fid ? findings.find((f) => f.id === fid) : undefined
                const view: RouteView =
                  target?.category === 'architecture' ? 'analyze-arch' : 'analyze-code'
                const next: AppRoute = {
                  kind: 'workspace',
                  workspaceId,
                  view,
                  findingId: fid,
                }
                navigate(next)
                applyRoute(next)
              }}
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
        </main>
      </div>
    </div>
  )
}

