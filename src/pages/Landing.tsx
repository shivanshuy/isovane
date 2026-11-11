import { LandingPlexusScene } from '../viz/LandingPlexusScene'

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing landing--plexus">
      <div className="landing__stage">
        <svg className="landing__liquid-defs" aria-hidden="true" width="0" height="0">
          <defs>
            <filter
              id="isovane-liquid"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              filterUnits="objectBoundingBox"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.014 0.028"
                numOctaves="4"
                seed="7"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  dur="11s"
                  values="0.012 0.024;0.019 0.033;0.012 0.024"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="38"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            <filter id="isovane-frost-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 1
                        0 0 0 0 1
                        0 0 0 0 1
                        0 0 0 0.28 0"
              />
            </filter>
          </defs>
        </svg>

        <div className="landing__liquid">
          <LandingPlexusScene />
          <div className="landing__liquid-mist" aria-hidden="true" />
          <div className="landing__liquid-sheen" aria-hidden="true" />
        </div>
        <section className="landing__hero landing__hero--plexus">
          <div className="landing__copy">
            <p className="landing__kicker story-rise">Agent security</p>
            <h1 className="landing__brand story-rise story-rise--2">Isovane</h1>
            <p className="landing__line story-rise story-rise--3">
              Intelligence without incidents
            </p>
            <p className="landing__lede story-rise story-rise--3">
              Security for AI, LLMs, and agents — assess risk in code, enforce controls at runtime,
              and remediate before exposure reaches production.
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
            <span>Close the risk</span>
          </div>
        </nav>
      </div>
    </div>
  )
}
