import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyDualLlm,
  applyTrustPattern,
  analyzeDualLlmLint,
  analyzeModelView,
  analyzeToxicFlows,
  fetchStudioState,
  fetchTrifecta,
  fetchTrustPatterns,
  type DualLlmVerdict,
  type ModelSeesView,
  type ToxicFlow,
  type TrifectaScorecard,
  type TrustPattern,
} from '../api'

type StudioTab = 'toxic' | 'dual' | 'model' | 'patterns' | 'trifecta'

export function TrustStudioPane({
  workspaceId,
  onRefresh,
  onOpenFinding,
}: {
  workspaceId: string
  onRefresh: () => void
  onOpenFinding?: (findingId: string) => void
}) {
  const [tab, setTab] = useState<StudioTab>('toxic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flows, setFlows] = useState<ToxicFlow[]>([])
  const [capGraph, setCapGraph] = useState<Record<string, unknown> | null>(null)
  const [verdicts, setVerdicts] = useState<DualLlmVerdict[]>([])
  const [views, setViews] = useState<ModelSeesView[]>([])
  const [patterns, setPatterns] = useState<TrustPattern[]>([])
  const [trifecta, setTrifecta] = useState<TrifectaScorecard | null>(null)
  const [policySnippet, setPolicySnippet] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const loadCached = useCallback(async () => {
    try {
      const state = await fetchStudioState(workspaceId)
      const tf = state.toxic_flows as { flows?: ToxicFlow[]; capability_graph?: Record<string, unknown> } | undefined
      if (tf?.flows) setFlows(tf.flows)
      if (tf?.capability_graph) setCapGraph(tf.capability_graph)
      const dual = state.dual_llm as { verdicts?: DualLlmVerdict[] } | undefined
      if (dual?.verdicts) setVerdicts(dual.verdicts)
      const mv = state.model_views as { views?: ModelSeesView[] } | undefined
      if (mv?.views) setViews(mv.views)
      const tri = state.trifecta as { scorecard?: TrifectaScorecard } | undefined
      if (tri?.scorecard) setTrifecta(tri.scorecard)
    } catch {
      /* first visit */
    }
  }, [workspaceId])

  useEffect(() => {
    void loadCached()
    void fetchTrustPatterns()
      .then((r) => setPatterns(r.patterns || []))
      .catch(() => setPatterns([]))
  }, [loadCached])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      await fn()
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'toxic' as const, label: 'Toxic flows', count: flows.length },
        { id: 'dual' as const, label: 'Dual-LLM', count: verdicts.length },
        { id: 'model' as const, label: 'Model sees', count: views.filter((v) => v.poison_signals?.length || v.split_risk).length },
        { id: 'patterns' as const, label: 'Patterns', count: patterns.length },
        { id: 'trifecta' as const, label: 'Trifecta', count: trifecta?.complete ? 1 : 0 },
      ] as const,
    [flows.length, verdicts.length, views, patterns.length, trifecta?.complete],
  )

  return (
    <div className="pane pane--analyze pane--analyze-solo">
      <section className="scan-section">
        <header className="pane-header scan-section__title">
          <div className="pane-header__main">
            <span>Trust Studio</span>
            <p className="muted">
              Toxic flows · Dual-LLM / CaMeL · What the model sees · Trust patterns · Trifecta
            </p>
          </div>
          <div className="pane-header__actions">
            {tab === 'toxic' ? (
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await analyzeToxicFlows(workspaceId)
                    setFlows(r.flows || [])
                    setCapGraph(r.capability_graph || null)
                  })
                }
              >
                Analyze toxic flows
              </button>
            ) : null}
            {tab === 'dual' ? (
              <>
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await analyzeDualLlmLint(workspaceId)
                      setVerdicts(r.verdicts || [])
                    })
                  }
                >
                  Lint Dual-LLM
                </button>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await applyDualLlm(workspaceId)
                      setHint(r.hint || 'Dual-LLM pattern applied to board.')
                    })
                  }
                >
                  Apply Dual-LLM
                </button>
              </>
            ) : null}
            {tab === 'model' ? (
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await analyzeModelView(workspaceId)
                    setViews(r.views || [])
                  })
                }
              >
                Scan model view
              </button>
            ) : null}
            {tab === 'trifecta' ? (
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await fetchTrifecta(workspaceId)
                    setTrifecta(r.scorecard)
                  })
                }
              >
                Refresh scorecard
              </button>
            ) : null}
          </div>
        </header>

        <div className="story-tabs" role="tablist" aria-label="Trust Studio">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'story-tabs__tab story-tabs__tab--on' : 'story-tabs__tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="story-tabs__count">{t.count}</span>
            </button>
          ))}
        </div>

        {error ? <p className="muted" style={{ color: 'var(--danger, #b91c1c)' }}>{error}</p> : null}
        {hint ? <p className="muted">{hint}</p> : null}
        {policySnippet ? (
          <pre className="exploit__body" style={{ marginTop: '0.75rem' }}>
            {policySnippet}
          </pre>
        ) : null}

        {tab === 'toxic' ? (
          <ToxicFlowsPanel
            flows={flows}
            capGraph={capGraph}
            onOpenFinding={onOpenFinding}
          />
        ) : null}
        {tab === 'dual' ? <DualLlmPanel verdicts={verdicts} /> : null}
        {tab === 'model' ? <ModelSeesPanel views={views} /> : null}
        {tab === 'patterns' ? (
          <PatternsPanel
            patterns={patterns}
            busy={busy}
            onApply={(id) =>
              void run(async () => {
                const r = await applyTrustPattern(workspaceId, id)
                setPolicySnippet(r.policy_snippet || null)
                setHint(r.hint || `Applied ${r.title || id}`)
              })
            }
          />
        ) : null}
        {tab === 'trifecta' ? <TrifectaPanel scorecard={trifecta} /> : null}
      </section>
    </div>
  )
}

function ToxicFlowsPanel({
  flows,
  capGraph,
  onOpenFinding,
}: {
  flows: ToxicFlow[]
  capGraph: Record<string, unknown> | null
  onOpenFinding?: (findingId: string) => void
}) {
  const download = () => {
    const blob = new Blob([JSON.stringify(capGraph || { flows }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'capability-graph.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="studio-panel">
      <div className="pane-header__actions" style={{ marginBottom: '0.75rem' }}>
        <button className="btn" type="button" onClick={download} disabled={!capGraph && !flows.length}>
          Download capability graph
        </button>
      </div>
      {!flows.length ? (
        <p className="muted">No toxic flows yet — analyze board / MCP / code capabilities.</p>
      ) : (
        <ul className="findings-list">
          {flows.map((f) => (
            <li key={f.id} className="findings-list__item">
              <strong>{f.finding_title || f.label}</strong>
              <span className="muted">
                {f.severity} · {f.caps.join(' + ')} · {(f.sources || []).join('+') || 'board'}
              </span>
              <p className="muted">{f.nodes?.join(' → ')}</p>
            </li>
          ))}
        </ul>
      )}
      {onOpenFinding ? null : null}
    </div>
  )
}

function DualLlmPanel({ verdicts }: { verdicts: DualLlmVerdict[] }) {
  if (!verdicts.length) {
    return <p className="muted">No Dual-LLM gaps detected on the current board (or lint not run).</p>
  }
  return (
    <ul className="findings-list">
      {verdicts.map((v) => (
        <li key={v.id} className="findings-list__item">
          <strong>{v.agent_label}</strong>
          <span className="muted">{v.severity}</span>
          <p>{v.summary}</p>
        </li>
      ))}
    </ul>
  )
}

function ModelSeesPanel({ views }: { views: ModelSeesView[] }) {
  if (!views.length) {
    return <p className="muted">Set a workspace folder, then scan MCP configs for model-visible text.</p>
  }
  return (
    <div className="studio-panel">
      {views.map((v) => (
        <article key={`${v.server}-${v.path}`} className="scan-section" style={{ marginBottom: '1rem' }}>
          <header className="pane-header">
            <div className="pane-header__main">
              <strong>{v.server}</strong>
              <p className="muted">{v.path}</p>
            </div>
          </header>
          {(v.poison_signals?.length || v.split_risk) ? (
            <p className="muted">
              Signals: {[...(v.poison_signals || []), v.split_risk ? 'split-instruction' : '']
                .filter(Boolean)
                .join(', ')}
            </p>
          ) : (
            <p className="muted">No poison / split signals</p>
          )}
          <pre className="exploit__body">{highlightPoison(v.raw_text, v.poison_signals || [])}</pre>
          {v.tools?.length ? (
            <ul className="findings-list">
              {v.tools.map((t) => (
                <li key={t.name} className="findings-list__item">
                  <strong>{t.name}</strong>
                  <p className="muted">{t.description || '—'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function highlightPoison(text: string, _signals: string[]) {
  // Keep plain text — CSS poison highlight would need span markup; show full blob.
  return text.slice(0, 6000)
}

function PatternsPanel({
  patterns,
  busy,
  onApply,
}: {
  patterns: TrustPattern[]
  busy: boolean
  onApply: (id: string) => void
}) {
  if (!patterns.length) return <p className="muted">No trust patterns loaded.</p>
  return (
    <ul className="findings-list">
      {patterns.map((p) => (
        <li key={p.id} className="findings-list__item">
          <div className="pane-header" style={{ alignItems: 'flex-start' }}>
            <div className="pane-header__main">
              <strong>{p.title}</strong>
              <p>{p.summary}</p>
              <p className="muted">{(p.owasp || []).join(' · ')}</p>
            </div>
            <div className="pane-header__actions">
              <button className="btn btn--primary" type="button" disabled={busy} onClick={() => onApply(p.id)}>
                Apply to board
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrifectaPanel({ scorecard }: { scorecard: TrifectaScorecard | null }) {
  if (!scorecard) {
    return <p className="muted">Refresh the trifecta scorecard from the saved board.</p>
  }
  const axes = [
    { key: 'Private data', axis: scorecard.private_data },
    { key: 'Untrusted ingress', axis: scorecard.untrusted_ingress },
    { key: 'Egress', axis: scorecard.egress },
  ]
  return (
    <div className="studio-panel">
      <p>
        <strong>{scorecard.complete ? 'Lethal trifecta complete' : 'Trifecta incomplete'}</strong>
        <span className="muted"> · {scorecard.severity}</span>
      </p>
      <ul className="findings-list">
        {axes.map(({ key, axis }) => (
          <li key={key} className="findings-list__item">
            <strong>
              {key}: {axis.present ? 'present' : 'absent'}
            </strong>
            <p className="muted">{axis.detail}</p>
            {axis.nodes?.length ? <p className="muted">{axis.nodes.join(', ')}</p> : null}
          </li>
        ))}
      </ul>
      {scorecard.gaps?.length ? (
        <ul className="findings-list">
          {scorecard.gaps.map((g) => (
            <li key={g} className="findings-list__item muted">
              {g}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
