import { useEffect, useMemo, useState } from 'react'
import { completeFix, createFix, type Finding, type FixPayload } from '../api'
import { CodeEditor } from '../components/CodeEditor'
import { FindingsGroupedList, groupFindingsByType } from '../components/FindingsGroupedList'
import { COPY_FEEDBACK_MS } from '../constants'
import { FixSummary } from '../copy'
import {
  findingType,
  isOpenFinding,
  laneOf,
  severityBadge,
  sortBySeverity,
  type FixLane,
} from '../findings'

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
    const laneItems = findings.filter((f) => isOpenFinding(f) && laneOf(f) === lane)
    return sortBySeverity(laneItems)
  }, [findings, lane])

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
  const { llm, general } = groupFindingsByType(queue)

  return (
    <div className="pane pane--fix pane--analyze-solo">
      <section className="issues-section">
        <header className="pane-header scan-section__title">
          <div className="pane-header__main">
            <span>{lane === 'analyze' ? 'Code Fix' : 'Gate fix'}</span>
          </div>
          <div className="pane-header__actions">
            {active && patch ? (
              <>
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(patch.copy_text)
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
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

        <div className="pane__split pane__split--detail-heavy">
          <section className="card card--stack">
            <header className="card__title issues-section__title">
              <span>Issues</span>
              <span className="muted">
                {queue.length} open · AI / LLM {llm.length} · GENERAL {general.length}
              </span>
            </header>
            {queue.length === 0 ? (
              <p className="empty">
                {lane === 'analyze'
                  ? 'No Analyze findings yet — run Code or Architecture first.'
                  : 'No Watch denies yet — try a poison send or run hunt.'}
              </p>
            ) : (
              <FindingsGroupedList
                findings={queue}
                selectedId={activeId}
                onSelect={(finding) => setActiveId(finding.id)}
                showCodeFix={false}
              />
            )}
          </section>

          <section className="card card--stack detail detail--story">
            {active && patch ? (
              <article className="finding-story">
                <header className="pane-header finding-story__hero">
                  <div className="pane-header__main">
                    <h2>{active.title}</h2>
                    <div className="finding-tags" aria-label="Issue fields">
                      <span
                        className={`finding-tag finding-tag--${findingType(active) === 'AI_LLM' ? 'llm' : 'general'}`}
                      >
                        type={findingType(active)}
                      </span>
                      <span
                        className={`finding-tag finding-tag--severity finding-tag--sev-${active.severity}`}
                      >
                        severity={severityBadge(active)}
                      </span>
                      {active.owasp.map((label) => (
                        <span key={label} className="finding-tag finding-tag--owasp">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </header>

                <section className="finding-story__section">
                  <h3>Patch</h3>
                  {patch.summary ? (
                    <div className="finding-story__note-in-desc">
                      <FixSummary text={patch.summary} />
                    </div>
                  ) : null}
                  <p className="hint fix-patch__kind">
                    Kind: <code>{patch.kind}</code>
                    {lane === 'analyze'
                      ? ' — edit repo / prompts / architecture'
                      : ' — tighten policy + sidecar'}
                  </p>
                  <CodeEditor
                    code={patch.copy_text}
                    label="Suggested patch"
                    path={patch.kind === 'policy' ? 'policy.yaml' : 'fix.diff'}
                    showLines={false}
                  />
                </section>
              </article>
            ) : (
              <p className="empty">Select an issue to open its patch.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
