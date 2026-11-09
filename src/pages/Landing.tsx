import { LandingPlexusScene } from '../viz/LandingPlexusScene'

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing landing--plexus">
      <div className="landing__stage">
        <LandingPlexusScene />

        <section className="landing__hero landing__hero--plexus">
          <div className="landing__copy">
            <p className="landing__kicker story-rise">Agent security</p>
            <h1 className="landing__brand story-rise story-rise--2">Isovane</h1>
            <p className="landing__line story-rise story-rise--3">
              Security you can actually read
            </p>
            <p className="landing__lede story-rise story-rise--3">
              Find risky agent code before ship, gate tools at runtime, and fix with stories that
              hold up for both novices and security engineers.
            </p>
            <div className="landing__cta story-rise story-rise--4">
              <button type="button" className="btn btn--primary" onClick={onEnter}>
                Open workspaces
              </button>
            </div>
          </div>
        </section>

        <nav className="landing__loop" aria-label="Product loop">
          <div className="landing__loop-item story-rise">
            <span className="landing__loop-num">01</span>
            <strong>Analyze</strong>
            <span>Find before ship</span>
          </div>
          <div className="landing__loop-item story-rise story-rise--2">
            <span className="landing__loop-num">02</span>
            <strong>Watch</strong>
            <span>Gate at runtime</span>
          </div>
          <div className="landing__loop-item story-rise story-rise--3">
            <span className="landing__loop-num">03</span>
            <strong>Fix</strong>
            <span>Patch with a story</span>
          </div>
        </nav>
      </div>
    </div>
  )
}
