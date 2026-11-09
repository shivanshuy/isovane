import { useState } from 'react'
import { createFix, postGate, runHunt, type Trace } from '../api'

export function WatchPane({
  workspaceId,
  traces,
  watching,
  onWatching,
  onRefresh,
  onOpenFix,
}: {
  workspaceId: string
  traces: Trace[]
  watching: boolean
  onWatching: (value: boolean) => void
  onRefresh: () => void
  onOpenFix: (findingId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const events = traces.flatMap((trace) =>
    trace.events.map((event) => ({ ...event, traceId: trace.id })),
  )

  const simulate = async () => {
    setBusy(true)
    setError(null)
    try {
      await postGate({
        workspace_id: workspaceId,
        tool: 'send',
        args: { to: 'attacker@evil.test', body: 'wire funds' },
        source: 'email',
        confirmed: true,
      })
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gate failed')
    } finally {
      setBusy(false)
    }
  }

  const hunt = async () => {
    setBusy(true)
    setError(null)
    try {
      await runHunt(workspaceId)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hunt failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pane pane--watch">
      <section className="card watch-bar">
        <div>
          <strong>Runtime gate</strong>
          <p className="muted">Verdicts sit outside the model. Deny → Gate fix (policy).</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={watching}
            onChange={(event) => onWatching(event.target.checked)}
            aria-label="Watch running"
          />
          <span />
        </label>
        <span className={watching ? 'run run--on' : 'run'}>{watching ? 'Watching' : 'Paused'}</span>
        <button className="btn" type="button" disabled={busy || !watching} onClick={simulate}>
          Simulate poison send
        </button>
        <button className="btn" type="button" disabled={busy} onClick={hunt}>
          Run hunt pack
        </button>
        {error ? <span className="err">{error}</span> : null}
      </section>

      <section className="card card--stack">
        <header className="card__title">
          <span>ALLOW / DENY stream</span>
        </header>
        <div className="stream" role="log">
          {events.length === 0 ? <p className="empty">No traces yet.</p> : null}
          {events.map((event, index) => (
            <div
              key={`${event.traceId}-${index}`}
              className={event.verdict === 'deny' ? 'stream__row stream__deny' : 'stream__row stream__allow'}
            >
              <p>
                <time>{event.at.slice(11, 19)}</time>
                <b>{event.verdict.toUpperCase()}</b>
                <code>{event.tool}</code>
                <span>{event.reason}</span>
                {event.owasp?.length ? <em>{event.owasp.join(' ')}</em> : null}
              </p>
              {event.verdict === 'deny' && event.finding_id ? (
                <button
                  type="button"
                  className="btn btn--tiny"
                  onClick={async () => {
                    await createFix(event.finding_id!)
                    onOpenFix(event.finding_id!)
                  }}
                >
                  Gate fix
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
