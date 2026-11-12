import type { Finding } from '../api'
import { FindingsGroupedList, groupFindingsByType } from '../components/FindingsGroupedList'
import { isArchitectureFinding, isOpenFinding } from '../findings'
import { FindingStory } from './FindingStory'

type AnalyzeMode = 'code' | 'architecture'

export function filterFindings(findings: Finding[], mode: AnalyzeMode) {
  return findings.filter((finding) => {
    if (!isOpenFinding(finding)) return false
    if (finding.source !== 'analyze') return false
    return mode === 'architecture' ? isArchitectureFinding(finding) : !isArchitectureFinding(finding)
  })
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
  const { llm, general } = groupFindingsByType(open)

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
          <FindingsGroupedList
            findings={open}
            selectedId={selected?.id ?? null}
            onSelect={onSelect}
            onOpenFix={onOpenFix}
            onRefresh={onRefresh}
            showCodeFix={showCodeFix}
          />
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
