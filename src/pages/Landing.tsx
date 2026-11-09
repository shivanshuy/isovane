import { LandingPlexusScene } from '../viz/LandingPlexusScene'

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing landing--plexus">
      <LandingPlexusScene />

      <section className="landing__hero landing__hero--plexus">
        <div className="landing__copy">
          <p className="landing__eyebrow">Isovane</p>
          <h1>Agent security you can actually read</h1>
          <p className="landing__lede">
            Find risky agent code and architecture before ship, watch tools at runtime, and fix with
            plain-English stories — plus the sharp jargon when you want it.
          </p>
          <div className="landing__cta">
            <button type="button" className="btn btn--primary" onClick={onEnter}>
              Open workspaces
            </button>
            <span className="muted">Analyze · Watch · Fix</span>
          </div>
        </div>
      </section>

      <section className="landing__grid">
        <article className="landing__card story-rise">
          <p className="landing__eyebrow">Analyze</p>
          <h2>Find before ship</h2>
          <p>
            Upload a zip or paste architecture. Novices get “what’s wrong”; pros get evidence, OWASP
            tags, and patches.
          </p>
          <p className="landing__aside">
            For security engineers: Semgrep, Bandit, secrets, prompt lint — tagged General vs LLM.
          </p>
        </article>
        <article className="landing__card story-rise story-rise--2">
          <p className="landing__eyebrow">Watch</p>
          <h2>Gate outside the model</h2>
          <p>
            Runtime denies live next to the agent. Policy sits in a sidecar — not only in the
            prompt.
          </p>
          <p className="landing__aside">
            For security engineers: tool allow-lists, HITL, deny traces you can re-run in CI.
          </p>
        </article>
        <article className="landing__card story-rise story-rise--3">
          <p className="landing__eyebrow">Fix</p>
          <h2>Patch with a story</h2>
          <p>
            Each finding explains the exploit path, real-world parallels, and concrete fix steps —
            then a copyable Dev fix.
          </p>
          <p className="landing__aside">
            For security engineers: keep Bandit / Semgrep jargon; we gloss it first.
          </p>
        </article>
      </section>
    </div>
  )
}
