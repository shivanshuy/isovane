import type { WorkspaceIcon } from '../data'

export function Mark({ icon }: { icon: WorkspaceIcon }) {
  if (icon === 'drop') return <span className="mark mark--drop" aria-hidden="true" />
  if (icon === 'bolt') {
    return (
      <span className="mark mark--bolt" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
          <path d="M7.2 0.5 2 6.8h3.1L4.8 11.5 10 5.2H6.8L7.2 0.5Z" />
        </svg>
      </span>
    )
  }
  if (icon === 's') return <span className="mark mark--s" aria-hidden="true">S</span>
  return <span className="mark mark--n" aria-hidden="true">N</span>
}

export type NavIconKind =
  | 'analyze-code'
  | 'analyze-arch'
  | 'watch'
  | 'fix-dev'
  | 'fix-gate'
  | 'settings'
  | 'home'
  | 'playground'

export function NavIcon({ kind }: { kind: NavIconKind }) {
  if (kind === 'home') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M2.5 7.2 8 2.5l5.5 4.7V13a1 1 0 0 1-1 1H9.2V9.4H6.8V14H3.5a1 1 0 0 1-1-1V7.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'analyze-code') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.4 10.4 13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'analyze-arch') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5.75" y="9" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4.75 7v1.2M11.25 7v1.2M7 9.5H6.2M10 9.5h-.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'watch') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
      </span>
    )
  }
  if (kind === 'fix-dev') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M3 12.5h10M4.2 10.2 10.8 3.6l1.6 1.6-6.6 6.6H4.2v-1.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'fix-gate') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4 2.5h3v11H4V2.5Zm5 0h3v11H9V2.5Z" fill="currentColor" />
        </svg>
      </span>
    )
  }
  if (kind === 'playground') {
    return (
      <span className="nav__glyph" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M3 11.5 8 3.5l5 8H3Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="10" r="1.1" fill="currentColor" />
        </svg>
      </span>
    )
  }
  return (
    <span className="nav__glyph" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
