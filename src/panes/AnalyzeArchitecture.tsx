import { useEffect, useRef, useState } from 'react'
import {
  analyzeArchitectureGraph,
  analyzeDiagramFile,
  analyzeDiagramText,
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
import DEMO_PRIVACY from '../../fixtures/architecture/01-privacy-multi-cloud-egress.puml?raw'
import DEMO_WORKFLOW from '../../fixtures/architecture/demo-workflow.mmd?raw'
import { FindingsBoard, filterFindings } from './analyzeFindings'

const ARCH_MODES = ARCH_MODE_OPTIONS as {
  id: Exclude<ArchMode, 'both'>
  label: string
  hint: string
}[]

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

  const analysisNotes: { key: string; tone: string; label: string; text: string }[] = []
  if (inventory?.vision?.message || inventory?.vision?.status) {
    analysisNotes.push({
      key: 'vision',
      tone:
        inventory?.vision?.status === 'ok'
          ? 'ok'
          : inventory?.vision?.status === 'ocr_fallback'
            ? 'ocr'
            : 'warn',
      label:
        inventory?.vision?.status === 'ok'
          ? 'Image extract'
          : inventory?.vision?.status === 'ocr_fallback'
            ? 'OCR fallback'
            : 'Seed fallback',
      text: [
        inventory?.vision?.message ||
          (inventory?.vision?.status === 'ok'
            ? 'Recreated boxes and arrows from the image.'
            : inventory?.vision?.status === 'ocr_fallback'
              ? 'Vision LLM did not work — fell back to OCR.'
              : 'Vision LLM did not work — loaded a filename seed.'),
        inventory?.vision?.vision_error
          ? `Vision error: ${inventory.vision.vision_error}`
          : '',
        inventory?.vision?.ocr_error ? `OCR: ${inventory.vision.ocr_error}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    })
  }
  if (inventory?.risk?.message || inventory?.risk?.status) {
    analysisNotes.push({
      key: 'risk',
      tone: inventory?.risk?.status === 'llm' ? 'ok' : 'warn',
      label: inventory?.risk?.status === 'llm' ? 'LLM risk' : 'Rules fallback',
      text:
        inventory?.risk?.message ||
        (inventory?.risk?.status === 'llm'
          ? 'Findings from arc_image_analyze.'
          : 'LLM risk analyze unavailable — used the architecture rule catalog.'),
    })
  }
  if (inventory?.privacy_posture) {
    const gaps = inventory.privacy_posture.gaps || []
    analysisNotes.push({
      key: 'privacy',
      tone: gaps.length ? 'warn' : 'ok',
      label: 'Privacy',
      text: [
        `LLMs: ${(inventory.privacy_posture.llm_vendors || []).join(', ') || '—'}`,
        `Data: ${(inventory.privacy_posture.data_stores || []).join(', ') || '—'}`,
        `HITL: ${inventory.privacy_posture.controls?.hitl_present ? 'yes' : 'no'}`,
        `DLP/ZDR: ${inventory.privacy_posture.controls?.dlp_or_zdr_labeled ? 'yes' : 'no'}`,
        gaps.length ? `Gaps: ${gaps.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }

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
                {DIAGRAM_FORMAT_OPTIONS.map((option) => (
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

      {analysisNotes.length ? (
        <section className="analyze-notes-section" aria-label="Notes">
          <header className="analyze-notes-section__head">
            <h3>Notes</h3>
            <p className="muted">
              {analysisNotes.map((note) => note.label).join(' · ')}
            </p>
          </header>
          <details className="analyze-notes">
            <summary>
              <span className="analyze-notes__summary-label">Details</span>
              <span className="muted">Expand for status messages</span>
            </summary>
            <div className="analyze-notes__body" role="status">
              {analysisNotes.map((note) => (
                <p
                  key={note.key}
                  className={`analyze-notes__item analyze-notes__item--${note.tone}`}
                  title={note.text}
                >
                  <strong>{note.label}</strong>
                  <span>{note.text}</span>
                </p>
              ))}
            </div>
          </details>
        </section>
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
          boundaries={inventory?.board?.boundaries || inventory?.boundaries}
          onReanalyze={async (graph, board) => {
            setBusy(true)
            setError(null)
            try {
              setDiagramText(board.mermaid)
              setDiagramFormat('structurizr')
              setDiagramFile(null)
              // Same Structurizr workspace the board edited — sent to LLM/rules
              // (includes deploymentNodes / boundaries with containment)
              const result = await analyzeArchitectureGraph(workspaceId, graph, archMode)
              setInventory({
                ...(result.inventory ?? {}),
                graph: result.inventory?.graph || graph,
                board: {
                  nodes: board.nodes,
                  edges: board.edges,
                  boundaries: board.boundaries,
                },
                nodes: board.nodes,
                edges: board.edges,
                boundaries: board.boundaries,
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
