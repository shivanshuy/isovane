import { useEffect, useRef, useState } from 'react'
import { analyzeArchive, analyzeCode, type Finding } from '../api'
import { ZIP_MAX_BYTES } from '../constants'
import { FindingsBoard, filterFindings } from './analyzeFindings'

type CodeMode = 'folder' | 'git'

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
          </div>
        </header>

        <section className="card drop analyze-scan">
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
            <div className="analyze-scan__row">
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
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() => void runCode()}
              >
                {busy ? 'Scanning…' : 'Analyze code'}
              </button>
            </div>
          ) : null}

          {codeMode === 'git' ? (
            <div className="analyze-scan__row analyze-scan__row--git">
              <label className="field">
                Git repository URL
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(event) => setGitUrl(event.target.value)}
                  placeholder="https://github.com/org/agent.git"
                />
              </label>
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() => void runCode()}
              >
                {busy ? 'Scanning…' : 'Analyze code'}
              </button>
            </div>
          ) : null}
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

