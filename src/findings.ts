/** Shared finding helpers — keep App / Analyze / Fix filters consistent. */

import type { Finding } from './api'

export type FixLane = 'analyze' | 'watch'
export type FindingType = 'AI_LLM' | 'GENERAL'

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function isArchitectureFinding(finding: Finding): boolean {
  return finding.category === 'architecture' || Boolean(finding.evidence?.diagram_region)
}

export function isOpenFinding(finding: Finding): boolean {
  return finding.status === 'open' || finding.status === 'accepted'
}

export function laneOf(finding: Finding): FixLane {
  if (
    finding.source === 'watch' ||
    finding.source === 'hunt' ||
    finding.category === 'runtime'
  ) {
    return 'watch'
  }
  return 'analyze'
}

export function findingType(finding: Finding): FindingType {
  if (finding.issue_type === 'AI_LLM' || finding.issue_type === 'GENERAL') {
    return finding.issue_type
  }
  if (['prompt', 'agency', 'injection', 'architecture', 'runtime'].includes(finding.category)) {
    return 'AI_LLM'
  }
  return 'GENERAL'
}

export function severityBadge(finding: Finding): string {
  return (finding.severity_label || finding.severity || 'MEDIUM').toUpperCase()
}

export function findingDescription(finding: Finding): string {
  return finding.description || finding.summary || ''
}

export function sortBySeverity(items: Finding[]): Finding[] {
  return [...items].sort((a, b) => {
    const d = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
    if (d !== 0) return d
    return a.title.localeCompare(b.title)
  })
}
