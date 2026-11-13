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

export type ArchBoardNode = {
  id?: string
  kind?: string
  label?: string
  path?: string
  x?: number
  y?: number
}

export type ArchBoardEdge = { from?: string; to?: string; kind?: string }

export type ArchBoardBoundary = {
  id?: string
  label?: string
  kind?: 'cloud' | 'trust' | 'vpc' | 'zone' | string
  x?: number
  y?: number
  w?: number
  h?: number
  z?: number
  /** Board node ids whose centers fall inside this boundary. */
  contains?: string[]
  contains_labels?: string[]
}

/** Structurizr / C4 workspace — single source of truth for board + LLM. */
export type ArchitectureGraph = {
  id?: number
  name?: string
  description?: string
  model: {
    people?: Array<{
      id: string
      name: string
      description?: string
      tags?: string
      properties?: Record<string, string>
    }>
    softwareSystems?: Array<{
      id: string
      name: string
      description?: string
      tags?: string
      properties?: Record<string, string>
    }>
    relationships?: Array<{
      id: string
      sourceId: string
      destinationId: string
      description?: string
      tags?: string
      properties?: Record<string, string>
    }>
    /** Drawn clouds / trust zones / VPCs from the playground. */
    deploymentNodes?: Array<{
      id: string
      name: string
      description?: string
      tags?: string
      properties?: Record<string, string>
    }>
  }
  views?: {
    systemLandscapeViews?: Array<{
      key?: string
      elements?: Array<{ id: string; x?: number; y?: number }>
      relationships?: Array<{ id: string }>
    }>
    configuration?: unknown
  }
  properties?: Record<string, string>
  /** @deprecated legacy board shape — accepted by server normalize */
  nodes?: ArchBoardNode[]
  edges?: ArchBoardEdge[]
  boundaries?: ArchBoardBoundary[]
  schema?: string
  meta?: { source?: string; filename?: string; [key: string]: unknown }
}

export type ArchInventory = {
  source?: string
  mode?: string
  nodes?: ArchBoardNode[]
  edges?: ArchBoardEdge[]
  board?: {
    nodes?: ArchBoardNode[]
    edges?: ArchBoardEdge[]
    boundaries?: ArchBoardBoundary[]
  }
  boundaries?: ArchBoardBoundary[]
  graph?: ArchitectureGraph
  mermaid?: string
  vision?: {
    provider?: string
    model?: string
    status?: string
    source?: string
    error?: string
    vision_error?: string
    ocr_error?: string
    extracted_chars?: number
    edge_count?: number
    ocr_labels?: number
    ocr_edges?: number
    seed?: string
    reason?: string
    message?: string
  }
  counts?: Record<string, number>
  by_kind?: Record<string, string[]>
  risk?: {
    status?: string
    provider?: string
    model?: string
    error?: string
    message?: string
  }
  privacy_posture?: {
    schema?: string
    llm_vendors?: string[]
    data_stores?: string[]
    observability_sinks?: string[]
    edge_count?: number
    risky_egress_edges?: number
    controls?: Record<string, boolean>
    gaps?: string[]
    kinds_present?: string[]
  }
  trifecta?: TrifectaScorecard
  dual_llm?: {
    verdict_count?: number
    verdicts?: DualLlmVerdict[]
    has_quarantine_pattern?: boolean
  }
  remediation_hints?: Array<{ title?: string; summary?: string; region?: string | null }>
}

export type ToxicFlow = {
  id: string
  pair_id: string
  label: string
  severity: string
  caps: string[]
  nodes: string[]
  edges?: { from: string; to: string; kind?: string }[]
  sources?: string[]
  finding_title?: string | null
}

export type DualLlmVerdict = {
  id: string
  agent_id: string
  agent_label: string
  has_untrusted: boolean
  has_privileged_tools: boolean
  has_quarantine: boolean
  severity: string
  summary: string
  owasp?: string[]
}

export type ModelSeesTool = {
  name: string
  description?: string
  poison_signals?: string[]
}

export type ModelSeesView = {
  server: string
  path: string
  raw_text: string
  tools?: ModelSeesTool[]
  poison_signals?: string[]
  split_risk?: boolean
}

export type TrustPattern = {
  id: string
  title: string
  summary: string
  remediation_id?: string | null
  owasp?: string[]
  policy_snippet?: string | null
}

export type TrifectaAxis = {
  present: boolean
  nodes?: string[]
  detail?: string
}

export type TrifectaScorecard = {
  schema_id?: string
  private_data: TrifectaAxis
  untrusted_ingress: TrifectaAxis
  egress: TrifectaAxis
  complete: boolean
  severity: string
  blocking_flows?: string[]
  gaps?: string[]
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

/** Re-analyze using Structurizr/C4 workspace (same object the board edits). */
export function analyzeArchitectureGraph(
  workspaceId: string,
  graph: ArchitectureGraph,
  mode: ArchMode = 'both',
) {
  return request<AnalyzeResult>('/analyze/diagram/json', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspaceId,
      format: 'architecture_graph',
      mode,
      graph,
      content: JSON.stringify(graph),
      description: JSON.stringify(graph),
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

export type SimulationPackSummary = {
  id: string
  title: string
  mode: 'code' | 'prompt' | 'policy'
  owasp: string[]
  difficulty: string
  summary: string
  safety: string
}

export type SimulationField = {
  id: string
  label: string
  type: string
  default?: string
}

export type SimulationPack = SimulationPackSummary & {
  inputs: SimulationField[]
  presets: { id: string; label: string; values: Record<string, string> }[]
}

export type SimulationResult = {
  pack_id: string
  title: string
  mode: string
  safety: string
  banner: string
  inputs_used: Record<string, string>
  steps: { title: string; detail: string; kind: string }[]
  impact: string
  stdout: string
  gate_verdict: {
    without_gate?: { verdict?: string; reason?: string }
    with_isovane_gate?: { verdict?: string; reason?: string; policy_rule_id?: string }
    lesson?: string
    action?: { tool?: string; args?: Record<string, unknown>; source?: string; confirmed?: boolean }
  }
  teaching: string
  related_incidents: { headline: string; when?: string; source?: string }[]
}

export type SimulationForFinding = {
  finding_id: string
  pack_id: string
  pack: SimulationPack
  seeded_inputs?: Record<string, string>
  seeded_fields?: string[]
  confidence?: 'high' | 'medium' | 'low' | string
  match_note?: string
  finding?: {
    id: string
    title: string
    severity: string
    severity_label?: string
    category: string
    summary: string
    path?: string | null
    owasp?: string[]
  }
}

export function fetchSimulations() {
  return request<{ banner: string; packs: SimulationPackSummary[] }>('/simulations')
}

export function simulationForFinding(findingId: string) {
  return request<SimulationForFinding>(
    `/simulations/for-finding/${encodeURIComponent(findingId)}`,
  )
}

export function runSimulation(
  packId: string,
  body: { inputs?: Record<string, string>; finding_id?: string },
) {
  return request<SimulationResult>(`/simulations/${encodeURIComponent(packId)}/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function analyzeToxicFlows(
  workspaceId: string,
  body?: { graph?: ArchitectureGraph; folder?: string; persist_findings?: boolean },
) {
  return request<{
    flows: ToxicFlow[]
    capability_graph: Record<string, unknown>
    findings: { id: string; title: string; severity: string }[]
  }>(`/workspaces/${workspaceId}/toxic-flows/analyze`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  })
}

export function fetchToxicFlows(workspaceId: string) {
  return request<{
    flows: ToxicFlow[]
    capability_graph?: Record<string, unknown>
  }>(`/workspaces/${workspaceId}/toxic-flows`)
}

export function analyzeDualLlmLint(
  workspaceId: string,
  body?: { graph?: ArchitectureGraph; persist_findings?: boolean },
) {
  return request<{
    verdicts: DualLlmVerdict[]
    findings: { id: string; title: string; severity: string }[]
    has_quarantine_pattern?: boolean
  }>(`/workspaces/${workspaceId}/dual-llm/lint`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  })
}

export function applyDualLlm(workspaceId: string, graph?: ArchitectureGraph) {
  return request<{
    ok: boolean
    graph?: ArchitectureGraph
    board?: unknown
    hint?: string
  }>(`/workspaces/${workspaceId}/dual-llm/apply`, {
    method: 'POST',
    body: JSON.stringify(graph ? { graph } : {}),
  })
}

export function analyzeModelView(
  workspaceId: string,
  body?: { folder?: string; live_probe?: boolean; persist_findings?: boolean },
) {
  return request<{
    views: ModelSeesView[]
    findings: { id: string; title: string; severity: string }[]
  }>(`/workspaces/${workspaceId}/mcp/model-view`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  })
}

export function fetchTrustPatterns() {
  return request<{ patterns: TrustPattern[] }>('/trust-patterns')
}

export function applyTrustPattern(
  workspaceId: string,
  patternId: string,
  graph?: ArchitectureGraph,
) {
  return request<{
    ok: boolean
    pattern_id: string
    title?: string
    graph?: ArchitectureGraph
    board?: unknown
    policy_snippet?: string | null
    hint?: string
  }>(`/workspaces/${workspaceId}/board/apply-pattern`, {
    method: 'POST',
    body: JSON.stringify({ pattern_id: patternId, graph }),
  })
}

export function fetchTrifecta(workspaceId: string, graph?: ArchitectureGraph) {
  return request<{ workspace_id: string; scorecard: TrifectaScorecard }>(
    `/workspaces/${workspaceId}/scorecard/trifecta`,
    {
      method: 'POST',
      body: JSON.stringify(graph ? { graph } : {}),
    },
  )
}

export function fetchStudioState(workspaceId: string) {
  return request<Record<string, unknown>>(`/workspaces/${workspaceId}/studio`)
}

export function putWorkspaceBoard(
  workspaceId: string,
  payload: { graph?: ArchitectureGraph; board?: unknown; source?: string },
) {
  return request<{ workspace_id: string; graph: ArchitectureGraph }>(
    `/workspaces/${workspaceId}/board`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}
