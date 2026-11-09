import { useState } from 'react'

function guessLanguage(path?: string | null, label?: string) {
  const source = `${path || ''} ${label || ''}`.toLowerCase()
  if (source.includes('.py') || source.includes('python')) return 'python'
  if (source.includes('.ts') || source.includes('typescript')) return 'typescript'
  if (source.includes('.tsx')) return 'tsx'
  if (source.includes('.js') || source.includes('javascript')) return 'javascript'
  if (source.includes('.diff') || source.includes('patch')) return 'diff'
  if (source.includes('.yml') || source.includes('.yaml')) return 'yaml'
  if (source.includes('.json')) return 'json'
  return 'text'
}

export function CodeEditor({
  code,
  path,
  label,
  startLine = 1,
  showLines = true,
}: {
  code: string
  path?: string | null
  label?: string
  startLine?: number | null
  showLines?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/\n$/, '').split('\n')
  const language = guessLanguage(path, label)
  const title = path || label || 'snippet'
  const baseLine = startLine && startLine > 0 ? startLine : 1

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-editor">
      <div className="code-editor__chrome">
        <div className="code-editor__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="code-editor__meta">
          <span className="code-editor__title" title={title}>
            {title}
          </span>
          <span className="code-editor__lang">{language}</span>
        </div>
        <button type="button" className="code-editor__copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-editor__body">
        {showLines ? (
          <div className="code-editor__gutter" aria-hidden="true">
            {lines.map((_, index) => (
              <span key={`ln-${baseLine + index}`}>{baseLine + index}</span>
            ))}
          </div>
        ) : null}
        <pre className="code-editor__code">
          <code>
            {lines.map((line, index) => (
              <span key={`code-${baseLine + index}`} className="code-editor__line">
                {line || ' '}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
