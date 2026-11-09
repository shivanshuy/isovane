/** Split gloss-then-punch fix copy from the API into readable parts. */

export function FixSummary({ text }: { text: string }) {
  const trimmed = text.trim()
  if (!trimmed) return <p>Accept into Fix queue.</p>

  const parts = trimmed.split('\n').map((line) => line.trim()).filter(Boolean)
  if (parts.length < 2) {
    return <p className="fix-summary">{trimmed}</p>
  }

  const punch = parts[parts.length - 1]
  const gloss = parts.slice(0, -1).join(' ')
  return (
    <div className="fix-summary">
      <p className="fix-summary__gloss">{gloss}</p>
      <p className="fix-summary__punch">{punch}</p>
    </div>
  )
}
