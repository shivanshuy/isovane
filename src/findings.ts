/** Shared finding helpers — keep App / Analyze / Fix filters consistent. */

import type { Finding } from './api'

export type FixLane = 'analyze' | 'watch'

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
