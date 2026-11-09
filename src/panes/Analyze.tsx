import { useEffect, useRef, useState } from 'react'
import {
  analyzeArchive,
  analyzeCode,
  analyzeDiagramFile,
  analyzeDiagramText,
  createFix,
  type ArchInventory,
  type ArchMode,
  type Finding,
} from '../api'
import { FindingStory } from './FindingStory'

const DIAGRAM_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.mmd,.mermaid,.puml,.plantuml,.pu,.dot,.gv,.drawio,.dio,.xml,.txt,.md'

const FORMAT_OPTIONS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'mermaid', label: 'Mermaid' },
  { id: 'plantuml', label: 'PlantUML' },
  { id: 'graphviz', label: 'Graphviz / DOT' },
  { id: 'drawio', label: 'Draw.io' },
  { id: 'image', label: 'Image / PDF' },
] as const

const DEMO_PRIVACY = `@startuml
cloud "Org VPC" {
  database "Customer PII DB"
  rectangle "Agent API"
}
cloud "OpenAI (US)" as OpenAI
cloud "Anthropic (US)" as Anthropic
cloud "LangSmith traces" as Logs
"Customer PII DB" --> "Agent API"
"Agent API" --> OpenAI : prompts + docs
"Agent API" --> Anthropic : fallback model
"Agent API" --> Logs : full prompt spans
@enduml`

const DEMO_WORKFLOW = `flowchart LR
  UI[Chat UI] --> Orch[Orchestrator agent]
  Orch --> Research[Research agent]
  Orch --> Writer[Writer agent]
  Research --> MCP[MCP filesystem + browser]
  Writer --> Tools[email + shell tools]
  Research -.->|a2a handoff| Writer`

const ARCH_MODES: { id: Exclude<ArchMode, 'both'>; label: string; hint: string }[] = [
  {
    id: 'privacy',
    label: 'Deployment / network',
    hint: 'Org → cloud LLM residency, PII egress, multi-vendor hops',
  },
  {
    id: 'workflow',
    label: 'Workflow graph',
    hint: 'UI → agents → MCP → tools (Agentic Radar–style)',
  },
]

type CodeMode = 'folder' | 'git'
export type AnalyzeMode = 'code' | 'architecture'

function isArchitectureFinding(finding: Finding) {
  return finding.category === 'architecture' || Boolean(finding.evidence.diagram_region)
}

function filterFindings(findings: Finding[], mode: AnalyzeMode) {
  return findings.filter((finding) => {
    if (finding.status !== 'open' && finding.status !== 'accepted') return false
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
  // Fallback for older findings without issue_type
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

function FindingsBoard({
  open,
  selected,
  onSelect,
  onOpenFix,
  onRefresh,
}: {
  open: Finding[]
  selected: Finding | null
  onSelect: (finding: Finding) => void
  onOpenFix: (findingId: string) => void
  onRefresh: () => void
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
              />
              <FindingGroup
                title="GENERAL"
                items={general}
                selected={selected}
                onSelect={onSelect}
                onOpenFix={onOpenFix}
                onRefresh={onRefresh}
              />
            </div>
          )}
        </section>

        <section className="card card--stack detail detail--story">
          {selected ? (
            <FindingStory finding={selected} onOpenFix={onOpenFix} onRefresh={onRefresh} />
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
}: {
  title: string
  items: Finding[]
  selected: Finding | null
  onSelect: (finding: Finding) => void
  onOpenFix: (findingId: string) => void
  onRefresh: () => void
  defaultOpen?: boolean
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
                <button
                  type="button"
                  className={selected?.id === finding.id ? 'finding finding--on' : 'finding'}
                  onClick={() => onSelect(finding)}
                >
                  <strong>{finding.title}</strong>
                  <span className={`finding-tag finding-tag--${findingType(finding) === 'AI_LLM' ? 'llm' : 'general'}`}>
                    type={findingType(finding)}
                  </span>
                  <span className={`finding-tag finding-tag--severity finding-tag--sev-${finding.severity}`}>
                    severity={severityBadge(finding)}
                  </span>
                  <em>{findingDescription(finding)}</em>
                </button>
                <button
                  type="button"
                  className="btn btn--tiny"
                  onClick={async () => {
                    await createFix(finding.id)
                    onOpenFix(finding.id)
                    onRefresh()
                  }}
                >
                  Dev fix
                </button>
              </li>
            ))}
            {items.length === 0 ? <li className="empty">None in this group.</li> : null}
          </ul>
        </>
      ) : null}
    </div>
  )
}

export function AnalyzeCodePane({
  workspaceId,
  findings,
  onRefresh,
  onOpenFix,
}: {
  workspaceId: string
  findings: Finding[]
  onRefresh: () => void
  onOpenFix: (findingId: string) => void
}) {
  const [codeMode, setCodeMode] = useState<CodeMode>('folder')
  const [gitUrl, setGitUrl] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = filterFindings(findings, 'code')
  const [selected, setSelected] = useState<Finding | null>(open[0] ?? null)
  const zipRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selected || !open.some((item) => item.id === selected.id)) {
      setSelected(open[0] ?? null)
    }
  }, [open, selected])

  const runCode = async () => {
    setBusy(true)
    setError(null)
    try {
      let result: { findings: Finding[] }
      if (codeMode === 'git') {
        if (!gitUrl.trim()) {
          setError('Enter a git repository URL.')
          return
        }
        result = await analyzeCode(workspaceId, { repo: gitUrl.trim() })
      } else if (zipFile) {
        if (zipFile.size > 80 * 1024 * 1024) {
          setError('Zip is larger than 80 MB.')
          return
        }
        result = await analyzeArchive(workspaceId, zipFile, zipFile.name)
      } else {
        setError('Zip your project folder, then upload the .zip.')
        return
      }
      onRefresh()
      const next = filterFindings(result.findings, 'code')
      if (next[0]) setSelected(next[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code analyze failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pane pane--analyze pane--analyze-solo">
      <section className="scan-section">
        <header className="card__title scan-section__title">
          <span>Scan</span>
        </header>

        <section className="card drop analyze-scan">
          <header className="card__title">
            <span>Artifacts</span>
            <span className="muted">Upload or link what to scan</span>
          </header>

          <div className="filters code-modes" role="tablist" aria-label="Code source">
            {(
              [
                ['folder', 'Upload zip'],
                ['git', 'Git repo'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={codeMode === id ? 'filters__btn filters__btn--on' : 'filters__btn'}
                onClick={() => setCodeMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {codeMode === 'folder' ? (
            <div className="filedrop">
              <input
                ref={zipRef}
                type="file"
                accept=".zip,.tgz,.tar.gz"
                hidden
                onChange={(event) => {
                  setZipFile(event.target.files?.[0] || null)
                }}
              />
              <button className="btn" type="button" onClick={() => zipRef.current?.click()}>
                {zipFile ? 'Change .zip' : 'Choose .zip'}
              </button>
              <span className="muted">
                {zipFile?.name || 'You zip the project locally, then upload it here'}
              </span>
              {zipFile ? (
                <button
                  className="btn btn--tiny"
                  type="button"
                  onClick={() => {
                    setZipFile(null)
                    if (zipRef.current) zipRef.current.value = ''
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {codeMode === 'git' ? (
            <label className="field">
              Git repository URL
              <input
                type="text"
                value={gitUrl}
                onChange={(event) => setGitUrl(event.target.value)}
                placeholder="https://github.com/org/agent.git"
              />
            </label>
          ) : null}

          <p className="hint">
            {codeMode === 'folder'
              ? 'Zip the folder on your machine first, upload the archive, then the server unpacks and scans.'
              : 'Shallow-clones the repo on the server, then scans it.'}
          </p>
          <div className="pane__actions">
            <button className="btn btn--primary" type="button" disabled={busy} onClick={runCode}>
              {busy ? 'Scanning…' : 'Analyze code'}
            </button>
          </div>
        </section>
      </section>

      {error ? <p className="err">{error}</p> : null}

      <FindingsBoard
        open={open}
        selected={selected}
        onSelect={setSelected}
        onOpenFix={onOpenFix}
        onRefresh={onRefresh}
      />
    </div>
  )
}

export function AnalyzeArchitecturePane({
  workspaceId,
  findings,
  onRefresh,
  onOpenFix,
}: {
  workspaceId: string
  findings: Finding[]
  onRefresh: () => void
  onOpenFix: (findingId: string) => void
}) {
  const [archMode, setArchMode] = useState<Exclude<ArchMode, 'both'>>('privacy')
  const [diagramText, setDiagramText] = useState(DEMO_PRIVACY)
  const [diagramFormat, setDiagramFormat] = useState<string>('plantuml')
  const [diagramFile, setDiagramFile] = useState<File | null>(null)
  const [inventory, setInventory] = useState<ArchInventory | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = filterFindings(findings, 'architecture')
  const [selected, setSelected] = useState<Finding | null>(open[0] ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selected || !open.some((item) => item.id === selected.id)) {
      setSelected(open[0] ?? null)
    }
  }, [open, selected])

  const loadDemo = (mode: Exclude<ArchMode, 'both'>) => {
    if (mode === 'workflow') {
      setDiagramText(DEMO_WORKFLOW)
      setDiagramFormat('mermaid')
    } else {
      setDiagramText(DEMO_PRIVACY)
      setDiagramFormat('plantuml')
    }
    setDiagramFile(null)
  }

  const runDiagram = async () => {
    setBusy(true)
    setError(null)
    try {
      let result: { findings: Finding[]; inventory?: ArchInventory }
      if (diagramFile) {
        result = await analyzeDiagramFile(workspaceId, diagramFile, diagramFormat, archMode)
      } else if (diagramText.trim()) {
        result = await analyzeDiagramText(
          workspaceId,
          diagramText,
          diagramFormat,
          archMode,
        )
      } else {
        setError('Upload a diagram file or paste Mermaid / PlantUML / DOT / Draw.io.')
        return
      }
      setInventory(result.inventory ?? null)
      onRefresh()
      const next = filterFindings(result.findings, 'architecture')
      if (next[0]) setSelected(next[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagram analyze failed')
    } finally {
      setBusy(false)
    }
  }

  const modeHint = ARCH_MODES.find((item) => item.id === archMode)?.hint

  return (
    <div className="pane pane--analyze pane--analyze-solo">
      <section className="scan-section">
        <header className="card__title scan-section__title">
          <span>Scan architecture</span>
        </header>

        <section className="card drop analyze-scan">
          <header className="card__title">
            <span>Artifacts</span>
            <span className="muted">Diagram or source inventory</span>
          </header>

        <div className="filters code-modes" role="tablist" aria-label="Architecture analysis mode">
          {ARCH_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={archMode === item.id ? 'filters__btn filters__btn--on' : 'filters__btn'}
              onClick={() => {
                setArchMode(item.id)
                loadDemo(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {modeHint ? <p className="muted analyze-scan__hint">{modeHint}</p> : null}

        <div className="analyze-scan__grid">
          <div>
            <label className="field">
              Format
              <select
                value={diagramFormat}
                onChange={(event) => setDiagramFormat(event.target.value)}
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div
              className={diagramFile ? 'filedrop filedrop--on' : 'filedrop'}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) setDiagramFile(file)
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept={DIAGRAM_ACCEPT}
                hidden
                onChange={(event) => setDiagramFile(event.target.files?.[0] ?? null)}
              />
              <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
                {diagramFile ? 'Change file' : 'Upload diagram'}
              </button>
              <span className="muted">
                {diagramFile
                  ? diagramFile.name
                  : 'PNG, JPG, SVG, PDF, .puml, .mmd, .dot, .drawio'}
              </span>
              {diagramFile ? (
                <button
                  className="btn btn--tiny"
                  type="button"
                  onClick={() => {
                    setDiagramFile(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="pane__actions pane__actions--wrap">
              <button
                className="btn btn--tiny"
                type="button"
                onClick={() => loadDemo('privacy')}
              >
                Load privacy demo
              </button>
              <button
                className="btn btn--tiny"
                type="button"
                onClick={() => loadDemo('workflow')}
              >
                Load workflow demo
              </button>
            </div>
          </div>

          <label className="field">
            Or paste diagram source
            <textarea
              value={diagramText}
              onChange={(event) => setDiagramText(event.target.value)}
              rows={12}
              placeholder="@startuml … / flowchart TD … / digraph G { … }"
              disabled={Boolean(diagramFile)}
            />
          </label>
        </div>

        <div className="pane__actions">
          <button className="btn btn--primary" type="button" disabled={busy} onClick={runDiagram}>
            {busy ? 'Reviewing…' : 'Analyze architecture'}
          </button>
        </div>
        </section>
      </section>

      {error ? <p className="err">{error}</p> : null}

      {inventory ? <InventoryCard inventory={inventory} /> : null}

      <FindingsBoard
        open={open}
        selected={selected}
        onSelect={setSelected}
        onOpenFix={onOpenFix}
        onRefresh={onRefresh}
      />
    </div>
  )
}

function InventoryCard({ inventory }: { inventory: ArchInventory }) {
  const counts = inventory.counts || {}
  const entries = Object.entries(counts)
  if (entries.length === 0 && !(inventory.nodes && inventory.nodes.length)) return null
  return (
    <section className="card inventory-card">
      <header className="card__title">
        <span>Workflow inventory</span>
        <span className="muted">
          {inventory.source === 'code' ? 'From source tree' : 'From diagram'} · Agentic Radar–style
        </span>
      </header>
      <ul className="inventory-card__counts">
        {entries.map(([kind, count]) => (
          <li key={kind}>
            <strong>{kind}</strong>
            <span>{count}</span>
          </li>
        ))}
      </ul>
      {inventory.by_kind ? (
        <div className="inventory-card__kinds">
          {Object.entries(inventory.by_kind).map(([kind, labels]) => (
            <p key={kind}>
              <em>{kind}</em> {labels.slice(0, 6).join(' · ')}
              {labels.length > 6 ? ` · +${labels.length - 6}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
