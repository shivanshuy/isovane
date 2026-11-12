/** Shared AI/LLM + GENERAL issue list used by Analyze and Code Fix. */

import { useEffect, useState } from 'react'
import { createFix, type Finding } from '../api'
import {
  findingDescription,
  findingType,
  severityBadge,
  sortBySeverity,
} from '../findings'

export function groupFindingsByType(open: Finding[]): { llm: Finding[]; general: Finding[] } {
  const llm: Finding[] = []
  const general: Finding[] = []
  for (const finding of open) {
    if (findingType(finding) === 'AI_LLM') llm.push(finding)
    else general.push(finding)
  }
  return { llm: sortBySeverity(llm), general: sortBySeverity(general) }
}

export function FindingsGroupedList({
  findings,
  selectedId,
  onSelect,
  onOpenFix,
  onRefresh,
  showCodeFix = false,
}: {
  findings: Finding[]
  selectedId: string | null
  onSelect: (finding: Finding) => void
  onOpenFix?: (findingId: string) => void
  onRefresh?: () => void
  showCodeFix?: boolean
}) {
  const { llm, general } = groupFindingsByType(findings)
  const selected = findings.find((item) => item.id === selectedId) ?? null

  if (findings.length === 0) {
    return <p className="empty">No open issues yet.</p>
  }

  return (
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
  showCodeFix = false,
}: {
  title: string
  items: Finding[]
  selected: Finding | null
  onSelect: (finding: Finding) => void
  onOpenFix?: (findingId: string) => void
  onRefresh?: () => void
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
        <ul className="findings">
          {items.map((finding) => (
            <li key={finding.id}>
              <div className={selected?.id === finding.id ? 'finding finding--on' : 'finding'}>
                <div className="finding__head">
                  <button
                    type="button"
                    className="finding__title-btn"
                    onClick={() => onSelect(finding)}
                  >
                    <strong>{finding.title}</strong>
                  </button>
                  {showCodeFix && onOpenFix && onRefresh ? (
                    <button
                      type="button"
                      className="finding__fix"
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
      ) : null}
    </div>
  )
}
