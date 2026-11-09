export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type FindingStatus = 'open' | 'accepted' | 'fixed' | 'wontfix' | 'false_positive'

export type IssueType = 'AI_LLM' | 'GENERAL'

export type IncidentCase = {
  headline: string
  when?: string
  story?: string
  technical?: string
  source?: string
}

export type Finding = {
  id: string
  workspace_id: string
  source: 'analyze' | 'watch' | 'hunt'
  severity: Severity
  /** CRITICAL | HIGH | MEDIUM | LOW */
  severity_label?: string
  title: string
  summary: string
  /** Same as summary — preferred display field */
  description?: string
  /** AI_LLM | GENERAL */
  issue_type?: IssueType
  exploit?: string | null
  real_world?: string | null
  /** Engineer root-cause / sink / harden write-up */
  technical_details?: string | null
  incident_headline?: string | null
  incident_when?: string | null
  incident_story?: string | null
  incident_technical?: string | null
  /** Multiple documented real-world incidents motivating the fix */
  incidents?: IncidentCase[]
  solutions?: string[]
  tags?: string[]
  owasp: string[]
  category: string
  evidence: {
    path?: string | null
    line?: number | null
    snippet?: string | null
    tool?: string | null
    args?: Record<string, unknown> | null
    source_channel?: string | null
    diagram_region?: string | null
  }
  pii_classes: string[]
  status: FindingStatus
  suggested_fix?: {
    kind: string
    diff?: string | null
    checklist?: string[]
    summary?: string | null
  } | null
  created_at: string
}

export type TraceEvent = {
  tool: string
  args: Record<string, unknown>
  source: string
  confirmed: boolean
  verdict: string
  reason: string
  finding_id?: string | null
  owasp: string[]
  pii_classes: string[]
  at: string
}

export type Trace = {
  id: string
  workspace_id: string
  kind: string
  events: TraceEvent[]
  finding_ids: string[]
  created_at: string
}

export type GateDecision = {
  tool: string
  verdict: string
  reason: string
  finding_id?: string | null
  trace_id?: string
  owasp: string[]
  pii_classes: string[]
}

export type FixPayload = {
  finding_id: string
  kind: string
  lane?: 'analyze' | 'watch'
  lane_label?: string
  source?: string
  summary?: string | null
  diff?: string | null
  checklist: string[]
  copy_text: string
}

export type ArchMode = 'privacy' | 'workflow' | 'both'

export type ArchInventory = {
  source?: string
  mode?: string
  nodes?: Array<{ id?: string; kind?: string; label?: string; path?: string }>
  edges?: Array<{ from?: string; to?: string; kind?: string }>
  counts?: Record<string, number>
  by_kind?: Record<string, string[]>
}

export type AnalyzeResult = {
  findings: Finding[]
  job?: { id: string; status?: string; error?: string | null }
  inventory?: ArchInventory
  mode?: ArchMode | string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`/api${path}`, { ...init, headers })
  if (!response.ok) {
    let message = response.statusText
    try {
      const payload = await response.json()
      message = payload.detail || payload.message || message
    } catch {
      const text = await response.text()
      if (text) message = text
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return response.json() as Promise<T>
}

export type WorkspaceDto = {
  id: string
  name: string
  description?: string
  folder: string
  stack: string
  branch: string
  icon: 'n' | 'drop' | 'bolt' | 's'
  url: string
  uptime: string
  since: string
  cpu: number
  cpuPeak: string
  memory: string
  memoryOf: string
  energy: string
  energyNote: string
  ports: { label: string; port: string }[]
}

export function fetchWorkspaces() {
  return request<{ workspaces: WorkspaceDto[] }>('/workspaces')
}

export function createWorkspace(payload: {
  name: string
  description?: string
  folder?: string
  stack?: string
}) {
  return request<WorkspaceDto>('/workspaces', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateWorkspace(
  workspaceId: string,
  payload: {
    name?: string
    description?: string
    folder?: string
    stack?: string
    branch?: string
    icon?: string
    url?: string
  },
) {
  return request<WorkspaceDto>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteWorkspace(workspaceId: string) {
  return request<{ ok: boolean; id: string }>(`/workspaces/${workspaceId}`, {
    method: 'DELETE',
  })
}

export function fetchFindings(workspaceId: string, status?: string) {
  const qs = new URLSearchParams({ workspace_id: workspaceId })
  if (status) qs.set('status', status)
  return request<{ findings: Finding[] }>(`/findings?${qs}`)
}

export function fetchTraces(workspaceId: string) {
  return request<{ traces: Trace[] }>(`/traces?workspace_id=${workspaceId}`)
}

export function fetchGateStats(workspaceId: string) {
  return request<{ open: number; denies: number; ci: number }>(
    `/gate/stats?workspace_id=${workspaceId}`,
  )
}

export function analyzeCode(
  workspaceId: string,
  options: {
    folder?: string | null
    repo?: string | null
    texts?: { path: string; text: string }[]
  },
) {
  return request<AnalyzeResult>('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspaceId,
      folder: options.folder || null,
      repo: options.repo || null,
      texts: options.texts || [],
    }),
  })
}

export function analyzeArchive(workspaceId: string, file: Blob, filename = 'folder.zip') {
  const body = new FormData()
  body.append('workspace_id', workspaceId)
  body.append('file', file, filename)
  return request<AnalyzeResult>('/analyze/archive', {
    method: 'POST',
    body,
  })
}

export function analyzeDiagramText(
  workspaceId: string,
  content: string,
  format: string,
  mode: ArchMode = 'both',
  folder?: string,
) {
  return request<AnalyzeResult>('/analyze/diagram/json', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspaceId,
      content,
      format,
      description: content,
      mode,
      folder: folder || undefined,
    }),
  })
}

export function analyzeDiagramFile(
  workspaceId: string,
  file: File,
  format?: string,
  mode: ArchMode = 'both',
) {
  const body = new FormData()
  body.append('workspace_id', workspaceId)
  body.append('file', file)
  if (format) body.append('format', format)
  body.append('mode', mode)
  return request<AnalyzeResult>('/analyze/diagram', {
    method: 'POST',
    body,
  })
}

export function postGate(payload: {
  workspace_id: string
  tool: string
  args?: Record<string, unknown>
  source?: string
  confirmed?: boolean
}) {
  return request<GateDecision>('/gates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function runHunt(workspaceId: string) {
  return request<{
    ok: boolean
    results: { scenario_id: string; verdict: string; passed: boolean; reason: string }[]
    finding_ids: string[]
  }>('/hunt/run', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
}

export function createFix(findingId: string) {
  return request<FixPayload>(`/fixes/${findingId}`, { method: 'POST' })
}

export function completeFix(findingId: string) {
  return request<Finding>(`/fixes/${findingId}/done`, { method: 'POST' })
}

export function patchFinding(findingId: string, status: FindingStatus) {
  return request<Finding>(`/findings/${findingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
