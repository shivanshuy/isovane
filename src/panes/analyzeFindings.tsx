import { useEffect, useState } from 'react'
import { createFix, type Finding } from '../api'
import { isArchitectureFinding, isOpenFinding } from '../findings'
import { FindingStory } from './FindingStory'

export type AnalyzeMode = 'code' | 'architecture'

export function filterFindings(findings: Finding[], mode: AnalyzeMode) {
  return findings.filter((finding) => {
    if (!isOpenFinding(finding)) return false
    if (finding.source !== 'analyze') return false
    return mode === 'architecture' ? isArchitectureFinding(finding) : !isArchitectureFinding(finding)
  })
}

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function findingType(finding: Finding): 'AI_LLM' | 'GENERAL' {
  if (finding.issue_type === 'AI_LLM' || finding.issue_type === 'GENERAL') {
    return finding.issue_type
  }
  if (['prompt', 'agency', 'injection', 'architecture', 'runtime'].includes(finding.category)) {
    return 'AI_LLM'
  }
  return 'GENERAL'
}

function severityBadge(finding: Finding): string {
  return (finding.severity_label || finding.severity || 'MEDIUM').toUpperCase()
}

function findingDescription(finding: Finding): string {
  return finding.description || finding.summary || ''
}

function sortBySeverity(items: Finding[]): Finding[] {
  return [...items].sort((a, b) => {
    const d = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
    if (d !== 0) return d
    return a.title.localeCompare(b.title)
  })
}

function groupFindings(open: Finding[]): { llm: Finding[]; general: Finding[] } {
  const llm: Finding[] = []
  const general: Finding[] = []
  for (const finding of open) {
    if (findingType(finding) === 'AI_LLM') llm.push(finding)
    else general.push(finding)
  }
  return { llm: sortBySeverity(llm), general: sortBySeverity(general) }
}

export function FindingsBoard({
  open,
  selected,
  onSelect,
  onOpenFix,
  onSimulate,
  onRefresh,
  showCodeFix = true,
}: {
  open: Finding[]
  selected: Finding | null
  onSelect: (finding: Finding) => void
  onOpenFix: (findingId: string) => void
  onSimulate?: (findingId: string) => void
  onRefresh: () => void
  showCodeFix?: boolean
}) {
  const { llm, general } = groupFindings(open)

  return (
    <section className="issues-section">
      <header className="card__title issues-section__title">
        <span>Issues</span>
        <span className="muted">
          {open.length} open · AI / LLM {llm.length} · GENERAL {general.length}
        </span>
      </header>

      <div className="pane__split pane__split--detail-heavy">
        <section className="card card--stack">
          {open.length === 0 ? (
            <p className="empty">No open issues yet.</p>
          ) : (
            <div className="findings-groups">
              <FindingGroup
                title="AI / LLM"
                items={llm}
                selected={selected}
                onSelect={onSelect}
                onOpenFix={onOpenFix}
                onRefresh={onRefresh}
                showCodeFix={showCodeFix}
              />
              <FindingGroup
                title="GENERAL"
                items={general}
                selected={selected}
                onSelect={onSelect}
                onOpenFix={onOpenFix}
                onRefresh={onRefresh}
                showCodeFix={showCodeFix}
              />
            </div>
          )}
        </section>

        <section className="card card--stack detail detail--story">
          {selected ? (
            <FindingStory
              finding={selected}
              onOpenFix={onOpenFix}
              onSimulate={onSimulate}
              onRefresh={onRefresh}
              showCodeFix={showCodeFix}
            />
          ) : (
            <p className="empty">Select an issue to open its story.</p>
          )}
        </section>
      </div>
    </section>
  )
}

function FindingGroup({
  title,
  items,
  selected,
  onSelect,
  onOpenFix,
  onRefresh,
  defaultOpen = false,
  showCodeFix = true,
}: {
  title: string
  items: Finding[]
  selected: Finding | null
  onSelect: (finding: Finding) => void
  onOpenFix: (findingId: string) => void
  onRefresh: () => void
  defaultOpen?: boolean
  showCodeFix?: boolean
}) {
  const selectedHere = Boolean(selected && items.some((item) => item.id === selected.id))
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (selectedHere) setOpen(true)
  }, [selectedHere, selected?.id])

  return (
    <div className={open ? 'findings-group findings-group--open' : 'findings-group'}>
      <button
        type="button"
        className="findings-group__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="findings-group__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <strong>{title}</strong>
        <span className="muted">
          {items.length}
          {open ? ' · sorted by severity' : ''}
        </span>
      </button>
      {open ? (
        <>
          <ul className="findings">
            {items.map((finding) => (
              <li key={finding.id}>
                <div
                  className={selected?.id === finding.id ? 'finding finding--on' : 'finding'}
                >
                  <div className="finding__head">
                    <button
                      type="button"
                      className="finding__title-btn"
                      onClick={() => onSelect(finding)}
                    >
                      <strong>{finding.title}</strong>
                    </button>
                    {showCodeFix ? (
                      <button
                        type="button"
                        className="btn finding__fix"
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
                  <button
                    type="button"
                    className="finding__select"
                    onClick={() => onSelect(finding)}
                  >
                    <span className="finding-tags">
                      <span
                        className={`finding-tag finding-tag--${findingType(finding) === 'AI_LLM' ? 'llm' : 'general'}`}
                      >
                        type={findingType(finding)}
                      </span>
                      <span
                        className={`finding-tag finding-tag--severity finding-tag--sev-${finding.severity}`}
                      >
                        severity={severityBadge(finding)}
                      </span>
                    </span>
                    <em>{findingDescription(finding)}</em>
                  </button>
                </div>
              </li>
            ))}
            {items.length === 0 ? <li className="empty">None in this group.</li> : null}
          </ul>
        </>
      ) : null}
    </div>
  )
}

