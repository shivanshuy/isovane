import { useEffect, useMemo, useState } from 'react'
import { completeFix, createFix, type Finding, type FixPayload } from '../api'
import { FixSummary } from '../copy'

type FixLane = 'analyze' | 'watch'

function laneOf(finding: Finding): 'analyze' | 'watch' {
  if (finding.source === 'watch' || finding.source === 'hunt' || finding.category === 'runtime') {
    return 'watch'
  }
  return 'analyze'
}

export function FixPane({
  findings,
  focusId,
  initialLane = 'analyze',
  onRefresh,
}: {
  findings: Finding[]
  focusId: string | null
  initialLane?: FixLane
  onRefresh: () => void
}) {
  const lane = initialLane
  const queue = useMemo(() => {
    const open = findings.filter((f) => f.status === 'accepted' || f.status === 'open')
    const laneItems = open.filter((f) => laneOf(f) === lane)
    // Code Fix / Gate fix opened from a selected issue → show only that issue
    if (focusId) {
      const focused = laneItems.filter((f) => f.id === focusId)
      if (focused.length) return focused
    }
    return laneItems
  }, [findings, lane, focusId])

  const [activeId, setActiveId] = useState<string | null>(focusId || queue[0]?.id || null)
  const [patch, setPatch] = useState<(FixPayload & { lane?: string; lane_label?: string }) | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (focusId) setActiveId(focusId)
  }, [focusId])

  useEffect(() => {
    if (!activeId || !queue.some((f) => f.id === activeId)) {
      setActiveId(queue[0]?.id ?? null)
    }
  }, [queue, activeId])

  useEffect(() => {
    if (!activeId) {
      setPatch(null)
      return
    }
    createFix(activeId)
      .then(setPatch)
      .catch(() => setPatch(null))
  }, [activeId])

  const active = queue.find((f) => f.id === activeId) || null
  const activeLane = active ? laneOf(active) : null

  return (
    <div className="pane pane--fix">
      <header className="pane-header fix-intro">
        <div className="pane-header__main">
          <strong>{lane === 'analyze' ? 'Code Fix' : 'Gate fix'}</strong>
          <p className="muted">
            {lane === 'analyze'
              ? 'Patches from Analyze — code, prompts, and architecture.'
              : 'Patches from Watch — policy YAML and sidecar gate rules.'}
          </p>
        </div>
        <div className="pane-header__actions">
          <span className={`lane-chip lane-chip--${lane}`}>
            {lane === 'analyze' ? 'From Analyze' : 'From Watch'}
          </span>
          {active && patch ? (
            <>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(patch.copy_text)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                }}
              >
                {copied ? 'Copied' : 'Copy patch'}
              </button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={async () => {
                  if (!activeId) return
                  await completeFix(activeId)
                  onRefresh()
                  setActiveId(null)
                }}
              >
                Mark fixed
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="pane__split">
        <section className="card card--stack">
          <header className="card__title">
            <span>
              {lane === 'analyze' ? 'Dev' : 'Gate'}{' '}
              {focusId && queue.length === 1 ? 'selected issue' : `queue ${queue.length}`}
            </span>
          </header>
          <ul className="findings">
            {queue.map((finding) => (
              <li key={finding.id}>
                <button
                  type="button"
                  className={activeId === finding.id ? 'finding finding--on' : 'finding'}
                  onClick={() => setActiveId(finding.id)}
                >
                  <strong>{finding.title}</strong>
                  <span className={`sev sev--${finding.severity}`}>{finding.severity}</span>
                  <em>
                    {finding.source} · {finding.owasp.join(' ')}
                  </em>
                </button>
              </li>
            ))}
            {queue.length === 0 ? (
              <li className="empty">
                {lane === 'analyze'
                  ? 'No Analyze findings yet — run Code or Architecture first.'
                  : 'No Watch denies yet — try a poison send or run hunt.'}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="card card--stack">
          <header className="card__title">
            <span>
              {activeLane === 'watch'
                ? 'Runtime patch'
                : activeLane === 'analyze'
                  ? 'Dev-time patch'
                  : 'Patch'}
            </span>
          </header>
          {active && patch ? (
            <div className="detail__grid">
              <div>
                <p className={`lane-banner lane-banner--${activeLane}`}>
                  {patch.lane_label ||
                    (activeLane === 'analyze'
                      ? 'Dev-time fix (Analyze)'
                      : 'Runtime gate fix (Watch)')}
                </p>
                <h3>{active.title}</h3>
                <FixSummary text={patch.summary || ''} />
                <p className="muted">
                  Kind: <code>{patch.kind}</code>
                  {activeLane === 'analyze'
                    ? ' — edit repo / prompts / architecture'
                    : ' — tighten policy + sidecar'}
                </p>
                <p className="hint">Use Copy patch / Mark fixed in the header.</p>
                <pre>{patch.copy_text}</pre>
              </div>
            </div>
          ) : (
            <p className="empty">Select a finding to generate a copyable patch.</p>
          )}
        </section>
      </div>
    </div>
  )
}
