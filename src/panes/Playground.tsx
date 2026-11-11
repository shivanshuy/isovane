import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSimulations,
  runSimulation,
  simulationForFinding,
  type Finding,
  type SimulationForFinding,
  type SimulationPack,
  type SimulationResult,
} from '../api'

type FindingContext = NonNullable<SimulationForFinding['finding']>

export function PlaygroundPane({
  findingId,
  findings = [],
  onSelectFinding,
  onOpenFix,
  onOpenWatch,
  onOpenAnalyze,
}: {
  findingId?: string | null
  findings?: Finding[]
  onSelectFinding?: (findingId: string) => void
  onOpenFix?: (findingId: string) => void
  onOpenWatch?: () => void
  onOpenAnalyze?: () => void
}) {
  const [banner, setBanner] = useState('')
  const [packId, setPackId] = useState<string | null>(null)
  const [pack, setPack] = useState<SimulationPack | null>(null)
  const [finding, setFinding] = useState<FindingContext | null>(null)
  const [matchNote, setMatchNote] = useState('')
  const [confidence, setConfidence] = useState<string>('')
  const [seededFields, setSeededFields] = useState<string[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const autoRanFor = useRef<string | null>(null)
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs

  useEffect(() => {
    void fetchSimulations()
      .then((data) => setBanner(data.banner))
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setResult(null)
      setFinding(null)
      setMatchNote('')
      setConfidence('')
      setSeededFields([])
      autoRanFor.current = null
      if (!findingId) {
        setPack(null)
        setPackId(null)
        setInputs({})
        return
      }
      try {
        const mapped = await simulationForFinding(findingId)
        if (cancelled) return
        setPackId(mapped.pack_id)
        setFinding(mapped.finding || null)
        setMatchNote(mapped.match_note || '')
        setConfidence(mapped.confidence || '')
        setSeededFields(mapped.seeded_fields || [])
        if (mapped.pack) {
          setPack(mapped.pack)
          const next: Record<string, string> = {}
          for (const field of mapped.pack.inputs || []) {
            const seeded = mapped.seeded_inputs?.[field.id]
            next[field.id] = String(seeded ?? field.default ?? '')
          }
          setInputs(next)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load lab')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [findingId])

  const modeLabel = useMemo(() => {
    if (!pack) return ''
    if (pack.mode === 'code') return 'Similar-code lab'
    if (pack.mode === 'prompt') return 'Prompt twin lab'
    return 'Policy demo'
  }, [pack])

  const gateLesson = result?.gate_verdict?.lesson
  const watchVerdict = result?.gate_verdict?.with_isovane_gate?.verdict
  const ungatedVerdict = result?.gate_verdict?.without_gate?.verdict

  const onRun = async (override?: Record<string, string>) => {
    if (!packId) return
    setBusy(true)
    setError('')
    try {
      const data = await runSimulation(packId, {
        inputs: override ?? inputsRef.current,
        finding_id: findingId || undefined,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setBusy(false)
    }
  }

  const applyPreset = (values: Record<string, string>) => {
    setInputs((prev) => {
      const next = { ...prev, ...values }
      void onRun(next)
      return next
    })
  }

  // Auto-run once when a finding-mapped lab is ready so the insight is immediate
  useEffect(() => {
    if (!findingId || !packId || !pack || busy) return
    if (autoRanFor.current === findingId) return
    autoRanFor.current = findingId
    void onRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after load
  }, [findingId, packId, pack])

  if (!findingId) {
    return (
      <div className="playground">
        <header className="pane-header playground__header">
          <div className="pane-header__main playground__header-main">
            <p className="playground__kicker">Attack playground</p>
            <h2>Pick a finding to simulate</h2>
            <p className="playground__lede">
              Labs are mapped from a concrete Analyze issue — sealed twins of the failure class, not
              your repository.
            </p>
          </div>
          <div className="pane-header__actions playground__header-actions">
            {onOpenAnalyze ? (
              <button type="button" className="btn btn--primary" onClick={onOpenAnalyze}>
                Open Analyze
              </button>
            ) : null}
          </div>
        </header>
        <p className="playground__banner" role="status">
          {banner || 'Simulated lab — not your repository.'}
        </p>
        <section className="playground__empty-card">
          {findings.length === 0 ? (
            <p>No open findings yet. Run Analyze first, then simulate from a finding’s story.</p>
          ) : (
            <>
              <p>Open findings — choose one to run its sealed lab:</p>
              <ul className="playground__finding-picker">
                {findings.slice(0, 12).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="playground__finding-pick"
                      onClick={() => onSelectFinding?.(item.id)}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {item.severity_label || item.severity}
                        {item.category ? ` · ${item.category}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="playground">
      <header className="pane-header playground__header">
        <div className="pane-header__main playground__header-main">
          <p className="playground__kicker">Attack playground</p>
          <h2>{pack?.title || 'Simulate the gap'}</h2>
          <p className="playground__lede">
            {pack?.summary ||
              'Sealed lab for the selected finding — edit inputs, re-run, and compare ungated impact vs Isovane Watch.'}
          </p>
        </div>
        <div className="pane-header__actions playground__header-actions">
          {onOpenAnalyze ? (
            <button type="button" className="btn" onClick={onOpenAnalyze}>
              Back to finding
            </button>
          ) : null}
          {onOpenWatch ? (
            <button type="button" className="btn" onClick={onOpenWatch}>
              Watch
            </button>
          ) : null}
          {findingId && onOpenFix ? (
            <button type="button" className="btn" onClick={() => onOpenFix(findingId)}>
              Code Fix
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !packId}
            onClick={() => void onRun()}
          >
            {busy ? 'Running…' : result ? 'Re-run' : 'Run'}
          </button>
        </div>
      </header>

      <p className="playground__banner" role="status">
        {banner || 'Simulated lab — not your repository.'}
      </p>

      {finding ? (
        <section className="playground__finding" aria-label="Mapped finding">
          <p className="playground__finding-kicker">From your finding</p>
          <h3>{finding.title}</h3>
          <p className="playground__finding-meta">
            {[finding.severity_label || finding.severity, finding.category, finding.path]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {finding.summary ? <p className="playground__finding-summary">{finding.summary}</p> : null}
          {matchNote ? (
            <p className="playground__match-note" data-confidence={confidence || undefined}>
              {confidence ? `${confidence.toUpperCase()} · ` : ''}
              {matchNote}
            </p>
          ) : null}
          {seededFields.length > 0 ? (
            <p className="playground__seed-chip">Seeded from evidence: {seededFields.join(', ')}</p>
          ) : null}
        </section>
      ) : null}

      <section className="playground__lab playground__lab--solo">
        {pack ? (
          <>
            <div className="playground__meta">
              <p className="playground__mode">
                {modeLabel}
                {pack.owasp?.length ? ` · ${pack.owasp.join(', ')}` : ''}
              </p>
              <p className="playground__safety">{pack.safety}</p>
            </div>

            {pack.presets?.length ? (
              <div className="playground__presets">
                {pack.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="btn btn--ghost"
                    disabled={busy}
                    onClick={() => applyPreset(preset.values)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="playground__fields">
              {(pack.inputs || []).map((field) => (
                <label key={field.id} className="playground__field">
                  <span>{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={5}
                      value={inputs[field.id] ?? ''}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      value={inputs[field.id] ?? ''}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <p className="hint playground__run-hint">
              Change inputs or pick a preset, then use <strong>Re-run</strong> in the header.
            </p>
          </>
        ) : (
          <p className="playground__empty">Loading lab…</p>
        )}

        {error ? <p className="playground__error">{error}</p> : null}

        {result ? (
          <div className="playground__result">
            <p className="playground__banner playground__banner--tight">{result.banner}</p>

            <div className="playground__insight">
              <div>
                <span>What happened</span>
                <p>{result.impact}</p>
              </div>
              {result.teaching ? (
                <div>
                  <span>Why it matters</span>
                  <p>{result.teaching}</p>
                </div>
              ) : null}
            </div>

            <h4>Attack steps</h4>
            <ol className="playground__steps">
              {result.steps.map((step, index) => (
                <li key={`${step.title}-${index}`} data-kind={step.kind}>
                  <strong>{step.title}</strong>
                  <pre>{step.detail}</pre>
                </li>
              ))}
            </ol>

            <h4>Without gate vs Isovane Watch</h4>
            <div className="playground__gate">
              <div>
                <span>Without gate</span>
                <b data-verdict={ungatedVerdict}>{ungatedVerdict || '—'}</b>
                <small>{result.gate_verdict?.without_gate?.reason}</small>
              </div>
              <div>
                <span>With Isovane Watch</span>
                <b data-verdict={watchVerdict}>{watchVerdict || '—'}</b>
                <small>{result.gate_verdict?.with_isovane_gate?.reason}</small>
              </div>
            </div>
            {gateLesson ? <p className="playground__lesson">{gateLesson}</p> : null}

            {result.related_incidents?.length ? (
              <>
                <h4>Related cases</h4>
                <ul className="playground__incidents">
                  {result.related_incidents.map((item) => (
                    <li key={item.headline}>
                      <strong>{item.headline}</strong>
                      {item.when ? <em> · {item.when}</em> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="playground__next">
              <h4>What to do next</h4>
              <p>
                Close the gap with <strong>Code Fix</strong>, keep <strong>Watch</strong> on for the same
                tool class, or go <strong>Back to finding</strong> — all in the header.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
