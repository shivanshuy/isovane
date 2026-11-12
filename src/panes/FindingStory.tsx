import { useEffect, useState, type ReactNode } from 'react'
import { createFix, type Finding } from '../api'
import { CodeEditor } from '../components/CodeEditor'
import { FixSummary } from '../copy'
import { ExploitPathScene } from '../viz/ExploitPathScene'
import { presetForFinding } from '../viz/scenePresets'

type StoryTab = 'details' | 'case'

function paragraphs(text: string) {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function ExploitBody({ text }: { text: string }) {
  const match = text.match(/^(Example exploit:)\s*/i)
  if (!match) return <pre className="exploit__body">{text}</pre>
  return (
    <pre className="exploit__body">
      <strong>{match[1]}</strong>
      {text.slice(match[0].length)}
    </pre>
  )
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="tech-meta__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function engineerBrief(finding: Finding): string {
  const primary = (finding.technical_details || '').trim()
  if (primary) return primary
  return (finding.incident_technical || '').trim()
}

export function FindingStory({
  finding,
  onOpenFix,
  onSimulate,
  onRefresh,
  showCodeFix = true,
}: {
  finding: Finding
  onOpenFix: (findingId: string) => void
  onSimulate?: (findingId: string) => void
  onRefresh: () => void
  showCodeFix?: boolean
}) {
  const [tab, setTab] = useState<StoryTab>('details')

  useEffect(() => {
    setTab('details')
  }, [finding.id])

  const solutions =
    finding.solutions?.length ? finding.solutions : finding.suggested_fix?.checklist || []
  const preset = presetForFinding(finding)
  const incidents =
    finding.incidents && finding.incidents.length > 0
      ? finding.incidents
      : finding.incident_headline ||
          finding.incident_story ||
          finding.incident_technical ||
          finding.real_world
        ? [
            {
              headline: finding.incident_headline || 'Real-world parallel',
              when: finding.incident_when || '',
              story: finding.incident_story || finding.real_world || '',
              technical: finding.incident_technical || '',
              source: '',
            },
          ]
        : []
  const hasIncident = incidents.length > 0
  const brief = engineerBrief(finding)
  const args = finding.evidence.args || {}
  const checkId =
    (typeof args.check_id === 'string' && args.check_id) ||
    (typeof args.test_id === 'string' && args.test_id) ||
    null
  const toolMessage =
    (typeof args.issue_text === 'string' && args.issue_text) ||
    (typeof args.message === 'string' && args.message) ||
    null
  const moreInfo = typeof args.more_info === 'string' ? args.more_info : null
  const hasTechnical =
    Boolean(brief) ||
    Boolean(finding.evidence.path) ||
    Boolean(finding.evidence.tool) ||
    Boolean(finding.evidence.snippet) ||
    Boolean(finding.suggested_fix?.diff) ||
    Boolean(checkId) ||
    solutions.length > 0

  return (
    <article className="finding-story" key={finding.id}>
      <div className="finding-story__sticky">
        <header className="pane-header finding-story__hero">
          <div className="pane-header__main finding-story__hero-main">
            <h2>{finding.title}</h2>
            <div className="finding-tags" aria-label="Issue fields">
              <span
                className={
                  finding.issue_type === 'AI_LLM'
                    ? 'finding-tag finding-tag--llm'
                    : 'finding-tag finding-tag--general'
                }
              >
                type={finding.issue_type === 'AI_LLM' ? 'AI_LLM' : 'GENERAL'}
              </span>
              <span className={`finding-tag finding-tag--severity finding-tag--sev-${finding.severity}`}>
                severity={(finding.severity_label || finding.severity || 'MEDIUM').toUpperCase()}
              </span>
              {finding.owasp.map((label) => (
                <span key={label} className="finding-tag finding-tag--owasp">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="pane-header__actions finding-story__hero-actions">
            {onSimulate ? (
              <button type="button" className="btn" onClick={() => onSimulate(finding.id)}>
                Simulate
              </button>
            ) : null}
            {showCodeFix ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={async () => {
                  await createFix(finding.id)
                  onOpenFix(finding.id)
                  onRefresh()
                }}
              >
                Code Fix
              </button>
            ) : null}
          </div>
        </header>

        <div className="story-tabs" role="tablist" aria-label="Finding sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'details'}
            className={tab === 'details' ? 'story-tabs__tab story-tabs__tab--on' : 'story-tabs__tab'}
            onClick={() => setTab('details')}
          >
            Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'case'}
            className={tab === 'case' ? 'story-tabs__tab story-tabs__tab--on' : 'story-tabs__tab'}
            onClick={() => setTab('case')}
          >
            Case file
            {hasIncident ? <em className="story-tabs__count">{incidents.length}</em> : null}
          </button>
        </div>
      </div>

      {tab === 'details' ? (
        <div className="finding-story__panel" role="tabpanel">
          <section className="finding-story__section">
            <h3>Description</h3>
            <p className="finding-story__lead">{finding.description || finding.summary}</p>
            {finding.suggested_fix?.summary ? (
              <div className="finding-story__note-in-desc">
                <FixSummary text={finding.suggested_fix.summary} />
              </div>
            ) : null}
          </section>

          <section className="finding-story__section">
            <h3>How an attacker can exploit it</h3>
            <ExploitPathScene key={preset.id} preset={preset} height={152} />
            {finding.exploit ? <ExploitBody text={finding.exploit} /> : null}
          </section>

          <section className="finding-story__section">
            <h3>How to fix it</h3>
            {solutions.length > 0 ? (
              <div className="fix-box">
                <p className="fix-box__label">Solutions</p>
                <ul className="detail__checklist detail__checklist--solutions">
                  {solutions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted">
                {showCodeFix
                  ? 'Open Code Fix for a copyable patch.'
                  : 'Fix this on the architecture board, then Analyze board.'}
              </p>
            )}
          </section>

          {hasTechnical ? (
            <section className="finding-story__section finding-story__pro">
              <h3>Technical details</h3>

              {brief
                ? paragraphs(brief).map((part) => (
                    <p key={part.slice(0, 48)} className="tech-brief__body">
                      {part}
                    </p>
                  ))
                : null}

              <dl className="tech-meta">
                <MetaRow
                  label="Location"
                  value={
                    finding.evidence.path ? (
                      <>
                        <code>{finding.evidence.path}</code>
                        {finding.evidence.line ? `:${finding.evidence.line}` : ''}
                      </>
                    ) : null
                  }
                />
                <MetaRow label="Scanner" value={finding.evidence.tool || null} />
                <MetaRow label="Rule / test id" value={checkId ? <code>{checkId}</code> : null} />
                <MetaRow
                  label="Confidence"
                  value={
                    typeof args.issue_confidence === 'string' ||
                    typeof args.issue_confidence === 'number'
                      ? String(args.issue_confidence)
                      : null
                  }
                />
                <MetaRow label="Category" value={finding.category || null} />
                <MetaRow label="Issue type" value={finding.issue_type || null} />
                <MetaRow
                  label="OWASP"
                  value={finding.owasp.length ? finding.owasp.join(', ') : null}
                />
                <MetaRow
                  label="Tags"
                  value={finding.tags?.length ? finding.tags.join(' · ') : null}
                />
                <MetaRow
                  label="PII classes"
                  value={finding.pii_classes?.length ? finding.pii_classes.join(', ') : null}
                />
                <MetaRow
                  label="Source channel"
                  value={finding.evidence.source_channel || null}
                />
                <MetaRow
                  label="Pack"
                  value={typeof args.pack === 'string' ? args.pack : null}
                />
              </dl>

              {toolMessage ? (
                <div className="tech-tool-msg">
                  <p className="tech-tool-msg__label">Scanner message</p>
                  <pre className="tech-tool-msg__body">{toolMessage}</pre>
                </div>
              ) : null}

              {moreInfo ? (
                <p className="tech-more-info">
                  Reference:{' '}
                  <a href={moreInfo} target="_blank" rel="noreferrer">
                    {moreInfo}
                  </a>
                </p>
              ) : null}

              {finding.evidence.snippet ? (
                <CodeEditor
                  code={finding.evidence.snippet}
                  path={finding.evidence.path}
                  label="Sink / evidence"
                  startLine={finding.evidence.line}
                />
              ) : null}

              {finding.suggested_fix?.diff ? (
                <CodeEditor
                  code={finding.suggested_fix.diff}
                  label="Suggested patch"
                  path="fix.diff"
                  showLines={false}
                />
              ) : null}

              {solutions.length > 0 ? (
                <div className="tech-verify">
                  <p className="tech-verify__label">Verify / harden</p>
                  <ul className="detail__checklist">
                    {solutions.map((item) => (
                      <li key={`verify-${item}`}>{item}</li>
                    ))}
                    <li>
                      Re-scan the same artifact after the change; finding should clear or drop severity.
                    </li>
                    <li>
                      Add a regression test or CI hunt case with a hostile payload aimed at this sink.
                    </li>
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="finding-story__panel" role="tabpanel">
          {hasIncident ? (
            <section className="finding-story__section case-file">
              <h3>
                Historical incidents
                <span className="case-file__count"> ({incidents.length})</span>
              </h3>
              <div className="case-file__stack">
                {incidents.map((incident, index) => (
                  <details
                    key={`${incident.headline}-${index}`}
                    className="case-file__card"
                    open={index === 0}
                  >
                    <summary className="case-file__summary">
                      <p className="case-file__index">
                        Case {index + 1} of {incidents.length}
                      </p>
                      <h4 className="case-file__headline">{incident.headline}</h4>
                      {incident.when ? <p className="case-file__when">{incident.when}</p> : null}
                    </summary>
                    <div className="case-file__body">
                      {incident.story
                        ? paragraphs(incident.story).map((part) => (
                            <p key={part.slice(0, 48)} className="case-file__story">
                              {part}
                            </p>
                          ))
                        : null}
                      {incident.technical ? (
                        <details className="case-file__tech" open>
                          <summary className="case-file__tech-label">Technical details</summary>
                          {paragraphs(incident.technical).map((part) => (
                            <p key={part.slice(0, 48)}>{part}</p>
                          ))}
                        </details>
                      ) : null}
                      {incident.source ? (
                        <p className="case-file__source">Source: {incident.source}</p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : (
            <p className="empty">No historical case file for this finding yet.</p>
          )}
        </div>
      )}
    </article>
  )
}
