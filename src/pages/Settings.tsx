export function Settings({
  watchGateEnabled,
  onWatchGateEnabled,
}: {
  watchGateEnabled: boolean
  onWatchGateEnabled: (value: boolean) => void
}) {
  return (
    <div className="settings">
      <header className="pane-header settings__bar">
        <div className="pane-header__main">
          <strong>App settings</strong>
          <p className="muted">Preferences for this Isovane install (not per workspace).</p>
        </div>
      </header>

      <section className="card form">
        <h2>Features</h2>
        <p className="muted">
          Toggle product areas in the workspace nav. Changes apply immediately on this browser.
        </p>
        <div className="form__row">
          <div>
            <strong>Watch → gate</strong>
            <p className="muted">Show Watch and Gate fix in the sidebar.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={watchGateEnabled}
              onChange={(event) => onWatchGateEnabled(event.target.checked)}
              aria-label="Enable Watch → gate"
            />
            <span />
          </label>
        </div>
      </section>
    </div>
  )
}
