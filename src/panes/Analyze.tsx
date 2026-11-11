import { useEffect, useRef, useState } from 'react'
import {
  analyzeArchive,
  analyzeCode,
  analyzeArchitectureGraph,
  analyzeDiagramFile,
  analyzeDiagramText,
  createFix,
  type ArchInventory,
  type ArchMode,
  type Finding,
} from '../api'
import { ArchDiagramBoard } from '../components/ArchDiagramBoard'
import {
  ARCH_MODE_OPTIONS,
  DIAGRAM_ACCEPT,
  DIAGRAM_FORMAT_OPTIONS,
} from '../config'
import { ZIP_MAX_BYTES } from '../constants'
import { isArchitectureFinding, isOpenFinding } from '../findings'
import DEMO_PRIVACY from '../../fixtures/architecture/01-privacy-multi-cloud-egress.puml?raw'
import DEMO_WORKFLOW from '../../fixtures/architecture/demo-workflow.mmd?raw'
import { FindingStory } from './FindingStory'

const FORMAT_OPTIONS = DIAGRAM_FORMAT_OPTIONS
const ARCH_MODES = ARCH_MODE_OPTIONS as {
  id: Exclude<ArchMode, 'both'>
  label: string
  hint: string
}[]

type CodeMode = 'folder' | 'git'
type AnalyzeMode = 'code' | 'architecture'

function filterFindings(findings: Finding[], mode: AnalyzeMode) {
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

export function AnalyzeCodePane({
  workspaceId,
  findings,
  onRefresh,
  onOpenFix,
  onSimulate,
  initialFindingId,
}: {
  workspaceId: string
  findings: Finding[]
  onRefresh: () => void
  onOpenFix: (findingId: string) => void
  onSimulate?: (findingId: string) => void
  initialFindingId?: string | null
}) {
  const [codeMode, setCodeMode] = useState<CodeMode>('folder')
  const [gitUrl, setGitUrl] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = filterFindings(findings, 'code')
  const [selected, setSelected] = useState<Finding | null>(() => {
    if (initialFindingId) {
      return open.find((item) => item.id === initialFindingId) ?? open[0] ?? null
    }
    return open[0] ?? null
  })
  const zipRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialFindingId) return
    const focused = open.find((item) => item.id === initialFindingId)
    if (focused) setSelected(focused)
  }, [initialFindingId, open])

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
        if (zipFile.size > ZIP_MAX_BYTES) {
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
        <header className="pane-header scan-section__title">
          <div className="pane-header__main">
            <span>Scan</span>
            <p className="muted">Upload or link what to scan, then run Analyze.</p>
          </div>
          <div className="pane-header__actions">
            <button className="btn btn--primary" type="button" disabled={busy} onClick={runCode}>
              {busy ? 'Scanning…' : 'Analyze code'}
            </button>
          </div>
        </header>

        <section className="card drop analyze-scan">
          <header className="card__title">
            <span>Artifacts</span>
            <span className="muted">Zip upload or git URL</span>
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
                  className="btn"
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
              ? 'Zip the folder on your machine first, upload the archive, then use Analyze code in the header.'
              : 'Shallow-clones the repo on the server — use Analyze code in the header when ready.'}
          </p>
        </section>
      </section>

      {error ? <p className="err">{error}</p> : null}

      <FindingsBoard
        open={open}
        selected={selected}
        onSelect={setSelected}
        onOpenFix={onOpenFix}
        onSimulate={onSimulate}
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
  onSimulate,
  initialFindingId,
}: {
  workspaceId: string
  findings: Finding[]
  onRefresh: () => void
  onOpenFix: (findingId: string) => void
  onSimulate?: (findingId: string) => void
  initialFindingId?: string | null
}) {
  const [archMode, setArchMode] = useState<Exclude<ArchMode, 'both'>>('privacy')
  const [diagramText, setDiagramText] = useState(DEMO_PRIVACY)
  const [diagramFormat, setDiagramFormat] = useState<string>('plantuml')
  const [diagramFile, setDiagramFile] = useState<File | null>(null)
  const [inventory, setInventory] = useState<ArchInventory | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = filterFindings(findings, 'architecture')
  const [selected, setSelected] = useState<Finding | null>(() => {
    if (initialFindingId) {
      return open.find((item) => item.id === initialFindingId) ?? open[0] ?? null
    }
    return open[0] ?? null
  })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialFindingId) return
    const focused = open.find((item) => item.id === initialFindingId)
    if (focused) setSelected(focused)
  }, [initialFindingId, open])

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

  const runDiagram = async (fileOverride?: File | null) => {
    const file = fileOverride === undefined ? diagramFile : fileOverride
    setBusy(true)
    setError(null)
    try {
      let result: { findings: Finding[]; inventory?: ArchInventory }
      if (file) {
        result = await analyzeDiagramFile(workspaceId, file, diagramFormat, archMode)
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

  const takeDiagramFile = (file: File | null) => {
    setDiagramFile(file)
    if (!file) return
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      void runDiagram(file)
    }
  }

  const modeHint = ARCH_MODES.find((item) => item.id === archMode)?.hint

  return (
    <div className="pane pane--analyze pane--analyze-solo">
      <section className="scan-section">
        <header className="pane-header scan-section__title">
          <div className="pane-header__main">
            <span>Scan architecture</span>
            <p className="muted">{modeHint || 'Diagram or source inventory'}</p>
          </div>
          <div className="pane-header__actions">
            <button className="btn" type="button" onClick={() => loadDemo('privacy')}>
              Privacy demo
            </button>
            <button className="btn" type="button" onClick={() => loadDemo('workflow')}>
              Workflow demo
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={busy}
              onClick={() => void runDiagram()}
            >
              {busy ? 'Reviewing…' : 'Analyze architecture'}
            </button>
          </div>
        </header>

        <section className="card drop analyze-scan">
          <header className="card__title">
            <span>Artifacts</span>
            <span className="muted">PNG/JPG rebuilds the board; edit it to fix findings</span>
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
                takeDiagramFile(event.dataTransfer.files?.[0] ?? null)
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept={DIAGRAM_ACCEPT}
                hidden
                onChange={(event) => takeDiagramFile(event.target.files?.[0] ?? null)}
              />
              <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
                {diagramFile ? 'Change file' : 'Upload diagram'}
              </button>
              <span className="muted">
                {diagramFile
                  ? diagramFile.name
                  : 'PNG/JPG → faithful board recreate · or paste .puml / .mmd / .dot / .drawio'}
              </span>
              {diagramFile ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    takeDiagramFile(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                >
                  Clear
                </button>
              ) : null}
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

        <p className="hint">
          1) Upload PNG/JPG — vision recreates boxes and arrows as closely as possible. 2) Correct any
          extraction mistakes on the board. 3) Fix architecture issues by changing the diagram
          (add HITL, cut risky paths, pin MCP…). 4) Analyze board to refresh findings.
        </p>
        </section>
      </section>

      {error ? <p className="err">{error}</p> : null}

      {inventory?.vision?.message || inventory?.vision?.status ? (
        <p
          className={
            inventory?.vision?.status === 'ok'
              ? 'extract-banner extract-banner--ok'
              : inventory?.vision?.status === 'ocr_fallback'
                ? 'extract-banner extract-banner--ocr'
                : 'extract-banner extract-banner--warn'
          }
          role="status"
        >
          <strong>
            {inventory?.vision?.status === 'ok'
              ? 'Image extract'
              : inventory?.vision?.status === 'ocr_fallback'
                ? 'OCR fallback'
                : 'Seed fallback'}
          </strong>
          <span>
            {inventory?.vision?.message ||
              (inventory?.vision?.status === 'ok'
                ? 'Recreated boxes and arrows from the image.'
                : inventory?.vision?.status === 'ocr_fallback'
                  ? 'Vision LLM did not work — fell back to OCR.'
                  : 'Vision LLM did not work — loaded a filename seed.')}
            {inventory?.vision?.vision_error
              ? ` Vision error: ${inventory.vision.vision_error}`
              : ''}
            {inventory?.vision?.ocr_error ? ` OCR: ${inventory.vision.ocr_error}` : ''}
          </span>
        </p>
      ) : null}

      {inventory?.risk?.message || inventory?.risk?.status ? (
        <p
          className={
            inventory?.risk?.status === 'llm'
              ? 'extract-banner extract-banner--ok'
              : 'extract-banner extract-banner--warn'
          }
          role="status"
        >
          <strong>
            {inventory?.risk?.status === 'llm' ? 'LLM risk analyze' : 'Rules fallback'}
          </strong>
          <span>
            {inventory?.risk?.message ||
              (inventory?.risk?.status === 'llm'
                ? 'Findings from arc_image_analyze.'
                : 'LLM risk analyze unavailable — used the architecture rule catalog.')}
          </span>
        </p>
      ) : null}

      {inventory?.privacy_posture ? (
        <div className="extract-banner extract-banner--ok privacy-posture" role="status">
          <strong>Privacy posture</strong>
          <span>
            LLMs: {(inventory.privacy_posture.llm_vendors || []).join(', ') || '—'}
            {' · '}
            Data: {(inventory.privacy_posture.data_stores || []).join(', ') || '—'}
            {' · '}
            HITL: {inventory.privacy_posture.controls?.hitl_present ? 'yes' : 'no'}
            {' · '}
            DLP/ZDR labeled: {inventory.privacy_posture.controls?.dlp_or_zdr_labeled ? 'yes' : 'no'}
            {(inventory.privacy_posture.gaps || []).length
              ? ` · Gaps: ${(inventory.privacy_posture.gaps || []).join(', ')}`
              : ''}
          </span>
        </div>
      ) : null}

      {inventory?.graph?.nodes?.length ||
      inventory?.board?.nodes?.length ||
      inventory?.nodes?.length ? (
        <ArchDiagramBoard
          nodes={inventory?.board?.nodes || inventory?.nodes || inventory?.graph?.nodes}
          edges={inventory?.board?.edges || inventory?.edges || inventory?.graph?.edges}
          issueCount={open.length}
          remediationHints={inventory?.remediation_hints}
          visionNote={
            inventory?.vision?.status === 'ok'
              ? `Vision (${inventory.vision.provider || 'model'}:${inventory.vision.model || '—'}) recreated this board from the image as closely as possible.`
              : inventory?.vision?.status === 'ocr_fallback'
                ? 'Vision LLM failed — OCR rebuilt labels (arrows may be heuristic). Correct the board, then Analyze.'
                : inventory?.vision?.status === 'seeded'
                  ? 'Vision had no usable arrows — board loaded from a faithful filename seed. Correct anything off, then fix issues on the diagram.'
                  : inventory?.vision?.status === 'fallback'
                    ? 'Vision LLM failed — board loaded from a faithful filename seed. Correct if needed, then Analyze board.'
                    : 'Board edits the Structurizr/C4 workspace (same model the LLM sees).'
          }
          busy={busy}
          onReanalyze={async (graph, board) => {
            setBusy(true)
            setError(null)
            try {
              setDiagramText(board.mermaid)
              setDiagramFormat('structurizr')
              setDiagramFile(null)
              // Same Structurizr workspace the board edited — sent to LLM/rules
              const result = await analyzeArchitectureGraph(workspaceId, graph, archMode)
              setInventory({
                ...(result.inventory ?? {}),
                graph: result.inventory?.graph || graph,
                board: {
                  nodes: board.nodes,
                  edges: board.edges,
                },
                nodes: board.nodes,
                edges: board.edges,
                mermaid: board.mermaid,
              })
              onRefresh()
              const next = filterFindings(result.findings, 'architecture')
              if (next[0]) setSelected(next[0])
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Board re-analyze failed')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}

      <FindingsBoard
        open={open}
        selected={selected}
        onSelect={setSelected}
        onOpenFix={onOpenFix}
        onSimulate={onSimulate}
        onRefresh={onRefresh}
        showCodeFix={false}
      />
    </div>
  )
}
