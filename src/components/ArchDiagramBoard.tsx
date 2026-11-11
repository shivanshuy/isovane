import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ArchBoardEdge, ArchBoardNode, ArchitectureGraph } from '../api'

const NODE_W = 148
const NODE_H = 64
const PALETTE: { kind: string; label: string }[] = [
  { kind: 'ui', label: 'UI / Chat' },
  { kind: 'agent', label: 'Agent' },
  { kind: 'mcp', label: 'MCP' },
  { kind: 'tool', label: 'Tool' },
  { kind: 'llm', label: 'LLM cloud' },
  { kind: 'data', label: 'Data / DB' },
  { kind: 'hitl', label: 'HITL' },
]

const KIND_C4: Record<string, { c4: string; tag: string }> = {
  ui: { c4: 'Software System', tag: 'ui' },
  hitl: { c4: 'Person', tag: 'hitl' },
  agent: { c4: 'Software System', tag: 'agent' },
  mcp: { c4: 'Software System', tag: 'mcp' },
  tool: { c4: 'Software System', tag: 'tool' },
  llm: { c4: 'Software System', tag: 'llm' },
  data: { c4: 'Software System', tag: 'data' },
  unknown: { c4: 'Software System', tag: 'unknown' },
}

type Spot = ArchBoardNode & { id: string; x: number; y: number; label: string; kind: string }
type Link = { from: string; to: string; kind?: string }

function asSpots(nodes: ArchBoardNode[] | undefined): Spot[] {
  return (nodes || []).map((node, index) => {
    const id = String(node.id || `n${index}`)
    return {
      ...node,
      id,
      label: String(node.label || id),
      kind: String(node.kind || 'unknown'),
      x: typeof node.x === 'number' ? node.x : 36 + (index % 4) * 180,
      y: typeof node.y === 'number' ? node.y : 36 + Math.floor(index / 4) * 96,
    }
  })
}

function asLinks(edges: ArchBoardEdge[] | undefined, spots: Spot[]): Link[] {
  const ids = new Set(spots.map((s) => s.id))
  return (edges || [])
    .map((edge) => ({
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      kind: edge.kind,
    }))
    .filter((edge) => edge.from && edge.to && ids.has(edge.from) && ids.has(edge.to))
}

function boardToMermaid(nodes: Spot[], edges: Link[]): string {
  const lines = ['flowchart LR']
  for (const node of nodes) {
    const safe = node.id.replace(/[^\w]/g, '_')
    const label = node.label.replace(/"/g, "'")
    lines.push(`  ${safe}["${label}"]`)
  }
  for (const edge of edges) {
    const a = edge.from.replace(/[^\w]/g, '_')
    const b = edge.to.replace(/[^\w]/g, '_')
    lines.push(`  ${a} --> ${b}`)
  }
  return lines.join('\n')
}

/** Canonical Structurizr workspace — board + LLM share this object. */
function boardToArchitectureGraph(
  nodes: Spot[],
  edges: Link[],
  meta?: ArchitectureGraph['meta'],
): ArchitectureGraph {
  const people: NonNullable<ArchitectureGraph['model']['people']> = []
  const softwareSystems: NonNullable<ArchitectureGraph['model']['softwareSystems']> = []
  const relationships: NonNullable<ArchitectureGraph['model']['relationships']> = []
  const viewElements: Array<{ id: string; x: number; y: number }> = []
  const viewRels: Array<{ id: string }> = []
  const idMap = new Map<string, string>()

  nodes.forEach((node, index) => {
    const sid = String(index + 1)
    idMap.set(node.id, sid)
    const kind = node.kind || 'unknown'
    const { c4, tag } = KIND_C4[kind] || KIND_C4.unknown
    const element = {
      id: sid,
      name: node.label,
      description: `Isovane kind: ${kind}`,
      tags: `Element,${c4},${tag}`,
      properties: {
        kind,
        x: String(Math.round(node.x)),
        y: String(Math.round(node.y)),
        ...(node.path ? { path: node.path } : {}),
      },
    }
    if (c4 === 'Person') people.push(element)
    else softwareSystems.push(element)
    viewElements.push({ id: sid, x: Math.round(node.x), y: Math.round(node.y) })
  })

  edges.forEach((edge, index) => {
    const sourceId = idMap.get(edge.from)
    const destinationId = idMap.get(edge.to)
    if (!sourceId || !destinationId) return
    const rid = String(nodes.length + index + 1)
    relationships.push({
      id: rid,
      sourceId,
      destinationId,
      description: edge.kind || 'link',
      tags: 'Relationship',
      properties: { kind: edge.kind || 'link' },
    })
    viewRels.push({ id: rid })
  })

  return {
    id: 1,
    name: 'Architecture',
    description: 'Isovane architecture playground (C4 / Structurizr)',
    model: { people, softwareSystems, relationships },
    views: {
      systemLandscapeViews: [
        {
          key: 'playground',
          elements: viewElements,
          relationships: viewRels,
        },
      ],
    },
    properties: {
      'isovane.source': 'board',
      ...(meta?.filename ? { 'isovane.filename': String(meta.filename) } : {}),
    },
  }
}

export function ArchDiagramBoard({
  nodes,
  edges,
  visionNote,
  issueCount,
  remediationHints,
  onReanalyze,
  busy,
}: {
  nodes?: ArchBoardNode[]
  edges?: ArchBoardEdge[]
  visionNote?: string | null
  /** Open architecture findings — board is the fix playground for these. */
  issueCount?: number
  /** Optional titles from analyze — additive hints, same layout. */
  remediationHints?: Array<{ title?: string; summary?: string; region?: string | null }>
  onReanalyze?: (
    graph: ArchitectureGraph,
    board: { nodes: Spot[]; edges: Link[]; mermaid: string },
  ) => void
  busy?: boolean
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [spots, setSpots] = useState<Spot[]>(() => asSpots(nodes))
  const [links, setLinks] = useState<Link[]>(() => asLinks(edges, asSpots(nodes)))
  const [draft, setDraft] = useState<{
    from: string
    side: 'left' | 'right'
    x: number
    y: number
  } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const nextSpots = asSpots(nodes)
    setSpots(nextSpots)
    setLinks(asLinks(edges, nextSpots))
  }, [nodes, edges])

  const sheetSize = useMemo(() => {
    const width = spots.reduce((max, spot) => Math.max(max, spot.x + NODE_W + 48), 640)
    const height = spots.reduce((max, spot) => Math.max(max, spot.y + NODE_H + 72), 420)
    return { width, height }
  }, [spots])

  const portPoint = (spot: Spot, side: 'left' | 'right') => ({
    x: side === 'left' ? spot.x : spot.x + NODE_W,
    y: spot.y + NODE_H / 2,
  })

  /** Wire attaches to left/right ports (not box centers) so arrowheads stay visible. */
  const linkPorts = (fromId: string, toId: string) => {
    const from = spots.find((item) => item.id === fromId)
    const to = spots.find((item) => item.id === toId)
    if (!from || !to) return { x1: 0, y1: 0, x2: 0, y2: 0 }
    const fromCx = from.x + NODE_W / 2
    const toCx = to.x + NODE_W / 2
    if (toCx >= fromCx) {
      const a = portPoint(from, 'right')
      const b = portPoint(to, 'left')
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    }
    const a = portPoint(from, 'left')
    const b = portPoint(to, 'right')
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  }

  const nodeAt = (clientX: number, clientY: number) => {
    const sheet = sheetRef.current
    if (!sheet) return null
    const rect = sheet.getBoundingClientRect()
    const x = clientX - rect.left + sheet.scrollLeft
    const y = clientY - rect.top + sheet.scrollTop
    const hit = [...spots]
      .reverse()
      .find(
        (spot) =>
          x >= spot.x - 10 &&
          x <= spot.x + NODE_W + 10 &&
          y >= spot.y &&
          y <= spot.y + NODE_H,
      )
    return hit ? hit.id : null
  }

  const onPortPointerDown = (
    id: string,
    side: 'left' | 'right',
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const sheet = sheetRef.current
    const spot = spots.find((item) => item.id === id)
    if (!sheet || !spot) return
    const start = portPoint(spot, side)
    setDraft({ from: id, side, x: start.x, y: start.y })
    const move = (ev: PointerEvent) => {
      const rect = sheet.getBoundingClientRect()
      setDraft({
        from: id,
        side,
        x: ev.clientX - rect.left + sheet.scrollLeft,
        y: ev.clientY - rect.top + sheet.scrollTop,
      })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const target = nodeAt(ev.clientX, ev.clientY)
      setDraft(null)
      if (!target || target === id) return
      setLinks((current) => {
        const rest = current.filter(
          (link) =>
            !((link.from === id && link.to === target) || (link.from === target && link.to === id)),
        )
        return [...rest, { from: id, to: target, kind: 'link' }]
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onNodePointerDown = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    const spot = spots.find((item) => item.id === id)
    const sheet = sheetRef.current
    if (!spot || !sheet) return
    setSelectedId(id)
    const rect = sheet.getBoundingClientRect()
    const offsetX = event.clientX - rect.left + sheet.scrollLeft - spot.x
    const offsetY = event.clientY - rect.top + sheet.scrollTop - spot.y
    setDragId(id)
    const move = (ev: PointerEvent) => {
      const nextRect = sheet.getBoundingClientRect()
      const x = Math.max(8, ev.clientX - nextRect.left + sheet.scrollLeft - offsetX)
      const y = Math.max(8, ev.clientY - nextRect.top + sheet.scrollTop - offsetY)
      setSpots((current) => current.map((item) => (item.id === id ? { ...item, x, y } : item)))
    }
    const up = () => {
      setDragId(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const addNode = (kind: string, label: string) => {
    const n = spots.length
    const id = `${kind}_${Date.now().toString(36)}`
    setSpots((current) => [
      ...current,
      {
        id,
        label,
        kind,
        x: 48 + (n % 3) * 40,
        y: 48 + n * 24,
      },
    ])
    setSelectedId(id)
  }

  const removeSelected = () => {
    if (!selectedId) return
    setSpots((current) => current.filter((spot) => spot.id !== selectedId))
    setLinks((current) =>
      current.filter((link) => link.from !== selectedId && link.to !== selectedId),
    )
    setSelectedId(null)
  }

  const renameSelected = () => {
    if (!selectedId) return
    const spot = spots.find((item) => item.id === selectedId)
    if (!spot) return
    const next = window.prompt('Node label', spot.label)
    if (!next || !next.trim()) return
    setSpots((current) =>
      current.map((item) => (item.id === selectedId ? { ...item, label: next.trim() } : item)),
    )
  }

  const draftFrom = draft ? spots.find((spot) => spot.id === draft.from) : null

  const issues =
    typeof issueCount === 'number' && issueCount > 0
      ? `${issueCount} open issue${issueCount === 1 ? '' : 's'} — fix them on this board (add HITL, drop risky edges, pin MCP…), then Analyze board.`
      : 'Correct the reconstruction if needed, then change the diagram to remediate risks and Analyze board.'

  return (
    <section className="card arch-board">
      <header className="pane-header arch-board__head">
        <div className="pane-header__main">
          <strong>Architecture playground</strong>
          <p className="muted">
            {visionNote ? `${visionNote} ` : ''}
            {issues}
          </p>
        </div>
        <div className="pane-header__actions">
          <button type="button" className="btn" disabled={!selectedId} onClick={renameSelected}>
            Rename
          </button>
          <button type="button" className="btn" disabled={!selectedId} onClick={removeSelected}>
            Delete
          </button>
          {onReanalyze ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || spots.length === 0}
              onClick={() => {
                const graph = boardToArchitectureGraph(spots, links)
                onReanalyze(graph, {
                  nodes: spots,
                  edges: links,
                  mermaid: boardToMermaid(spots, links),
                })
              }}
            >
              {busy ? 'Analyzing…' : 'Analyze board'}
            </button>
          ) : null}
        </div>
      </header>

      <ol className="arch-board__steps" aria-label="Board workflow">
        <li>Recreate from upload</li>
        <li>Correct extraction</li>
        <li>Fix issues in the diagram</li>
        <li>Analyze board</li>
      </ol>

      {remediationHints && remediationHints.length > 0 ? (
        <ul className="arch-board__hints muted" aria-label="Remediation hints">
          {remediationHints.slice(0, 5).map((hint) => (
            <li key={hint.title || hint.summary}>
              {hint.region ? `${hint.region}: ` : ''}
              {hint.title || hint.summary}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="arch-board__howto muted">
        Drag boxes · pull a left or right port to join arrows · click a wire to remove · palette adds
        missing pieces.
      </p>

      <div className="arch-board__layout">
        <aside className="arch-board__palette" aria-label="Add components">
          <p className="arch-board__kicker">Add / fix</p>
          {PALETTE.map((item) => (
            <button
              key={item.kind}
              type="button"
              className="arch-board__stamp"
              onClick={() => addNode(item.kind, item.label)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="arch-board__scroll">
          <div
            ref={sheetRef}
            className="arch-board__sheet"
            style={{ minWidth: sheetSize.width, minHeight: sheetSize.height }}
            aria-label="Architecture canvas"
          >
            <svg className="arch-board__wires" aria-hidden="true">
              <defs>
                <marker
                  id="arch-board-arrow"
                  viewBox="0 0 10 10"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="5"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path className="arch-board__arrow-head" d="M0,0 L10,5 L0,10 Z" />
                </marker>
              </defs>
              {links.map((link) => {
                const port = linkPorts(link.from, link.to)
                return (
                  <g key={`${link.from}->${link.to}`}>
                    <line
                      className="arch-board__wire-hit"
                      x1={port.x1}
                      y1={port.y1}
                      x2={port.x2}
                      y2={port.y2}
                      onClick={() =>
                        setLinks((current) =>
                          current.filter(
                            (item) => !(item.from === link.from && item.to === link.to),
                          ),
                        )
                      }
                    />
                    <line
                      className="arch-board__wire"
                      x1={port.x1}
                      y1={port.y1}
                      x2={port.x2}
                      y2={port.y2}
                      markerEnd="url(#arch-board-arrow)"
                    />
                  </g>
                )
              })}
              {draft && draftFrom ? (
                <line
                  className="arch-board__wire arch-board__wire--draft"
                  x1={portPoint(draftFrom, draft.side).x}
                  y1={portPoint(draftFrom, draft.side).y}
                  x2={draft.x}
                  y2={draft.y}
                  markerEnd="url(#arch-board-arrow)"
                />
              ) : null}
            </svg>

            {spots.map((spot) => (
              <div
                key={spot.id}
                className={
                  selectedId === spot.id
                    ? `arch-board__node arch-board__node--${spot.kind} arch-board__node--on`
                    : dragId === spot.id
                      ? `arch-board__node arch-board__node--${spot.kind} arch-board__node--drag`
                      : `arch-board__node arch-board__node--${spot.kind}`
                }
                style={{ left: spot.x, top: spot.y, width: NODE_W, height: NODE_H }}
                onPointerDown={(event) => onNodePointerDown(spot.id, event)}
              >
                <strong>{spot.label}</strong>
                <span>{spot.kind}</span>
                <button
                  type="button"
                  className="arch-board__port arch-board__port--left"
                  aria-label={`Connect from left of ${spot.label}`}
                  onPointerDown={(event) => onPortPointerDown(spot.id, 'left', event)}
                />
                <button
                  type="button"
                  className="arch-board__port arch-board__port--right"
                  aria-label={`Connect from right of ${spot.label}`}
                  onPointerDown={(event) => onPortPointerDown(spot.id, 'right', event)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
