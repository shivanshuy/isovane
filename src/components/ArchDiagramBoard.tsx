import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  ArchBoardBoundary,
  ArchBoardEdge,
  ArchBoardNode,
  ArchitectureGraph,
} from '../api'

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
type PortSide = 'left' | 'right'
type Link = {
  from: string
  to: string
  kind?: string
  /** Port the user started from — sticky so the source does not jump. */
  fromSide?: PortSide
  toSide?: PortSide
}
type WireStyle = 'straight' | 'angular'
type BoundaryKind = 'cloud' | 'trust' | 'vpc' | 'zone'
type Boundary = {
  id: string
  label: string
  kind: BoundaryKind
  x: number
  y: number
  w: number
  h: number
  /** Lower = behind nodes; higher = in front of nodes. */
  z: number
}
type Selection =
  | { type: 'node'; id: string }
  | { type: 'boundary'; id: string }
  | null

const NODE_Z = 20
const BOUNDARY_PRESETS: { kind: BoundaryKind; label: string }[] = [
  { kind: 'cloud', label: 'Cloud' },
  { kind: 'trust', label: 'Trust zone' },
  { kind: 'vpc', label: 'VPC / network' },
  { kind: 'zone', label: 'Boundary' },
]

/** Orthogonal elbow path between two port points. */
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`
}

function wirePath(
  style: WireStyle,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  if (style === 'angular') return elbowPath(x1, y1, x2, y2)
  return `M ${x1} ${y1} L ${x2} ${y2}`
}

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

function nodeInsideBoundary(node: Spot, box: Boundary): boolean {
  const cx = node.x + NODE_W / 2
  const cy = node.y + NODE_H / 2
  return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h
}

function boundariesForExport(nodes: Spot[], boundaries: Boundary[]): ArchBoardBoundary[] {
  return boundaries.map((box) => {
    const contained = nodes.filter((node) => nodeInsideBoundary(node, box))
    return {
      id: box.id,
      label: box.label,
      kind: box.kind,
      x: Math.round(box.x),
      y: Math.round(box.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
      z: box.z,
      contains: contained.map((node) => node.id),
      contains_labels: contained.map((node) => node.label),
    }
  })
}

/** Canonical Structurizr workspace — board + LLM share this object. */
function boardToArchitectureGraph(
  nodes: Spot[],
  edges: Link[],
  boundaries: Boundary[] = [],
  meta?: ArchitectureGraph['meta'],
): ArchitectureGraph {
  const people: NonNullable<ArchitectureGraph['model']['people']> = []
  const softwareSystems: NonNullable<ArchitectureGraph['model']['softwareSystems']> = []
  const relationships: NonNullable<ArchitectureGraph['model']['relationships']> = []
  const deploymentNodes: NonNullable<ArchitectureGraph['model']['deploymentNodes']> = []
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

  const exported = boundariesForExport(nodes, boundaries)
  exported.forEach((box, index) => {
    const containedSids = (box.contains || [])
      .map((nid) => idMap.get(nid))
      .filter((sid): sid is string => Boolean(sid))
    deploymentNodes.push({
      id: `b${index + 1}`,
      name: String(box.label || box.kind || 'Boundary'),
      description: `Isovane boundary: ${box.kind || 'zone'}`,
      tags: `Deployment Node,Boundary,${box.kind || 'zone'}`,
      properties: {
        kind: String(box.kind || 'zone'),
        boundary: 'true',
        x: String(box.x ?? 0),
        y: String(box.y ?? 0),
        w: String(box.w ?? 0),
        h: String(box.h ?? 0),
        z: String(box.z ?? 0),
        contains: containedSids.join(','),
      },
    })
  })

  return {
    id: 1,
    name: 'Architecture',
    description: 'Isovane architecture playground (C4 / Structurizr)',
    model: { people, softwareSystems, relationships, deploymentNodes },
    views: {
      systemLandscapeViews: [
        {
          key: 'playground',
          elements: viewElements,
          relationships: viewRels,
        },
      ],
    },
    boundaries: exported,
    properties: {
      'isovane.source': 'board',
      ...(meta?.filename ? { 'isovane.filename': String(meta.filename) } : {}),
      ...(exported.length
        ? { 'isovane.boundaries': JSON.stringify(exported) }
        : {}),
    },
  }
}

function asBoundaries(raw: ArchBoardBoundary[] | undefined): Boundary[] {
  return (raw || [])
    .map((item, index) => {
      const kind = String(item.kind || 'zone') as BoundaryKind
      const safeKind: BoundaryKind = ['cloud', 'trust', 'vpc', 'zone'].includes(kind)
        ? kind
        : 'zone'
      const id = String(item.id || `bound_${index}`)
      const label = String(item.label || safeKind)
      const x = typeof item.x === 'number' ? item.x : 40
      const y = typeof item.y === 'number' ? item.y : 40
      const w = typeof item.w === 'number' ? item.w : 220
      const h = typeof item.h === 'number' ? item.h : 160
      const z = typeof item.z === 'number' ? item.z : 1
      return { id, label, kind: safeKind, x, y, w, h, z }
    })
    .filter((box) => box.w > 0 && box.h > 0)
}

export function ArchDiagramBoard({
  nodes,
  edges,
  boundaries: boundariesProp,
  visionNote,
  issueCount,
  remediationHints,
  onReanalyze,
  busy,
}: {
  nodes?: ArchBoardNode[]
  edges?: ArchBoardEdge[]
  boundaries?: ArchBoardBoundary[]
  visionNote?: string | null
  /** Open architecture findings — board is the fix playground for these. */
  issueCount?: number
  /** Optional titles from analyze — additive hints, same layout. */
  remediationHints?: Array<{ title?: string; summary?: string; region?: string | null }>
  onReanalyze?: (
    graph: ArchitectureGraph,
    board: {
      nodes: Spot[]
      edges: Link[]
      boundaries: ArchBoardBoundary[]
      mermaid: string
    },
  ) => void
  busy?: boolean
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [spots, setSpots] = useState<Spot[]>(() => asSpots(nodes))
  const [links, setLinks] = useState<Link[]>(() => asLinks(edges, asSpots(nodes)))
  const [boundaries, setBoundaries] = useState<Boundary[]>(() => asBoundaries(boundariesProp))
  const [draft, setDraft] = useState<{
    from: string
    side: PortSide
    x: number
    y: number
  } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection>(null)
  const [wireStyle, setWireStyle] = useState<WireStyle>('straight')
  const [drawKind, setDrawKind] = useState<BoundaryKind | null>(null)
  const [boundaryDraft, setBoundaryDraft] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  useEffect(() => {
    const nextSpots = asSpots(nodes)
    setSpots(nextSpots)
    setLinks(asLinks(edges, nextSpots))
  }, [nodes, edges])

  useEffect(() => {
    if (boundariesProp) setBoundaries(asBoundaries(boundariesProp))
  }, [boundariesProp])

  const sheetSize = useMemo(() => {
    let width = spots.reduce((max, spot) => Math.max(max, spot.x + NODE_W + 48), 640)
    let height = spots.reduce((max, spot) => Math.max(max, spot.y + NODE_H + 72), 420)
    for (const box of boundaries) {
      width = Math.max(width, box.x + box.w + 48)
      height = Math.max(height, box.y + box.h + 48)
    }
    if (boundaryDraft) {
      width = Math.max(width, boundaryDraft.x + boundaryDraft.w + 48)
      height = Math.max(height, boundaryDraft.y + boundaryDraft.h + 48)
    }
    return { width, height }
  }, [spots, boundaries, boundaryDraft])

  const sheetPoint = (clientX: number, clientY: number) => {
    const sheet = sheetRef.current
    if (!sheet) return { x: 0, y: 0 }
    const rect = sheet.getBoundingClientRect()
    return {
      x: clientX - rect.left + sheet.scrollLeft,
      y: clientY - rect.top + sheet.scrollTop,
    }
  }

  const portPoint = (spot: Spot, side: PortSide) => ({
    x: side === 'left' ? spot.x : spot.x + NODE_W,
    y: spot.y + NODE_H / 2,
  })

  /** Prefer the target port closer to the fixed source port. */
  const nearestToSide = (from: Spot, fromSide: PortSide, to: Spot): PortSide => {
    const src = portPoint(from, fromSide)
    const left = portPoint(to, 'left')
    const right = portPoint(to, 'right')
    const dLeft = (src.x - left.x) ** 2 + (src.y - left.y) ** 2
    const dRight = (src.x - right.x) ** 2 + (src.y - right.y) ** 2
    return dLeft <= dRight ? 'left' : 'right'
  }

  /**
   * Source port stays on the side the user started from (`fromSide`).
   * Target side adapts so the arrowhead still lands on the nearer port.
   */
  const linkPorts = (link: Link) => {
    const from = spots.find((item) => item.id === link.from)
    const to = spots.find((item) => item.id === link.to)
    if (!from || !to) return { x1: 0, y1: 0, x2: 0, y2: 0 }
    const fromSide =
      link.fromSide ||
      (to.x + NODE_W / 2 >= from.x + NODE_W / 2 ? 'right' : 'left')
    const toSide = nearestToSide(from, fromSide, to)
    const a = portPoint(from, fromSide)
    const b = portPoint(to, toSide)
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
    side: PortSide,
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
        const fromSpot = spots.find((item) => item.id === id)
        const toSpot = spots.find((item) => item.id === target)
        const toSide =
          fromSpot && toSpot ? nearestToSide(fromSpot, side, toSpot) : side === 'left' ? 'right' : 'left'
        const rest = current.filter(
          (link) =>
            !((link.from === id && link.to === target) || (link.from === target && link.to === id)),
        )
        return [
          ...rest,
          { from: id, to: target, kind: 'link', fromSide: side, toSide },
        ]
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onNodePointerDown = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (drawKind) return
    if ((event.target as HTMLElement).closest('button')) return
    const spot = spots.find((item) => item.id === id)
    const sheet = sheetRef.current
    if (!spot || !sheet) return
    setSelected({ type: 'node', id })
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

  const onBoundaryPointerDown = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (drawKind) return
    if ((event.target as HTMLElement).closest('[data-resize]')) return
    event.stopPropagation()
    const box = boundaries.find((item) => item.id === id)
    const sheet = sheetRef.current
    if (!box || !sheet) return
    setSelected({ type: 'boundary', id })
    const origin = sheetPoint(event.clientX, event.clientY)
    const offsetX = origin.x - box.x
    const offsetY = origin.y - box.y
    const move = (ev: PointerEvent) => {
      const point = sheetPoint(ev.clientX, ev.clientY)
      const x = Math.max(0, point.x - offsetX)
      const y = Math.max(0, point.y - offsetY)
      setBoundaries((current) =>
        current.map((item) => (item.id === id ? { ...item, x, y } : item)),
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onBoundaryResizeDown = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    const box = boundaries.find((item) => item.id === id)
    if (!box) return
    setSelected({ type: 'boundary', id })
    const start = sheetPoint(event.clientX, event.clientY)
    const origin = { x: box.x, y: box.y, w: box.w, h: box.h }
    const move = (ev: PointerEvent) => {
      const point = sheetPoint(ev.clientX, ev.clientY)
      const w = Math.max(80, origin.w + (point.x - start.x))
      const h = Math.max(64, origin.h + (point.y - start.y))
      setBoundaries((current) =>
        current.map((item) => (item.id === id ? { ...item, w, h } : item)),
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawKind) {
      if (event.target === sheetRef.current) setSelected(null)
      return
    }
    if ((event.target as HTMLElement).closest('.arch-board__node, .arch-board__port')) return
    event.preventDefault()
    const kind = drawKind
    const start = sheetPoint(event.clientX, event.clientY)
    let latest = { x: start.x, y: start.y, w: 0, h: 0 }
    setBoundaryDraft(latest)
    const move = (ev: PointerEvent) => {
      const point = sheetPoint(ev.clientX, ev.clientY)
      latest = {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      }
      setBoundaryDraft(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setBoundaryDraft(null)
      if (latest.w < 48 || latest.h < 40) return
      const preset = BOUNDARY_PRESETS.find((item) => item.kind === kind)
      const id = `bound_${Date.now().toString(36)}`
      setBoundaries((boxes) => {
        const nextZ = boxes.length
          ? Math.min(...boxes.map((item) => item.z), NODE_Z - 1)
          : 1
        return [
          ...boxes,
          {
            id,
            label: preset?.label || 'Boundary',
            kind,
            x: latest.x,
            y: latest.y,
            w: latest.w,
            h: latest.h,
            z: Number.isFinite(nextZ) ? nextZ : 1,
          },
        ]
      })
      setSelected({ type: 'boundary', id })
      setDrawKind(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const addNode = (kind: string, label: string) => {
    const n = spots.length
    const id = `${kind}_${Date.now().toString(36)}`
    setDrawKind(null)
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
    setSelected({ type: 'node', id })
  }

  const removeSelected = () => {
    if (!selected) return
    if (selected.type === 'node') {
      setSpots((current) => current.filter((spot) => spot.id !== selected.id))
      setLinks((current) =>
        current.filter((link) => link.from !== selected.id && link.to !== selected.id),
      )
    } else {
      setBoundaries((current) => current.filter((box) => box.id !== selected.id))
    }
    setSelected(null)
  }

  const renameSelected = () => {
    if (!selected) return
    if (selected.type === 'node') {
      const spot = spots.find((item) => item.id === selected.id)
      if (!spot) return
      const next = window.prompt('Node label', spot.label)
      if (!next || !next.trim()) return
      setSpots((current) =>
        current.map((item) => (item.id === selected.id ? { ...item, label: next.trim() } : item)),
      )
      return
    }
    const box = boundaries.find((item) => item.id === selected.id)
    if (!box) return
    const next = window.prompt('Boundary label', box.label)
    if (!next || !next.trim()) return
    setBoundaries((current) =>
      current.map((item) => (item.id === selected.id ? { ...item, label: next.trim() } : item)),
    )
  }

  const sendBoundaryBack = () => {
    if (!selected || selected.type !== 'boundary') return
    const minZ = boundaries.reduce((min, box) => Math.min(min, box.z), NODE_Z)
    setBoundaries((current) =>
      current.map((box) =>
        box.id === selected.id ? { ...box, z: Math.min(minZ, NODE_Z) - 1 } : box,
      ),
    )
  }

  const bringBoundaryFront = () => {
    if (!selected || selected.type !== 'boundary') return
    const maxZ = boundaries.reduce((max, box) => Math.max(max, box.z), NODE_Z)
    setBoundaries((current) =>
      current.map((box) =>
        box.id === selected.id ? { ...box, z: Math.max(maxZ, NODE_Z) + 1 } : box,
      ),
    )
  }

  const draftFrom = draft ? spots.find((spot) => spot.id === draft.from) : null
  const selectedBoundary =
    selected?.type === 'boundary'
      ? boundaries.find((box) => box.id === selected.id) || null
      : null
  const hasSelection = Boolean(selected)

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
          {onReanalyze ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || spots.length === 0}
              onClick={() => {
                const exportedBoundaries = boundariesForExport(spots, boundaries)
                const graph = boardToArchitectureGraph(spots, links, boundaries)
                onReanalyze(graph, {
                  nodes: spots,
                  edges: links,
                  boundaries: exportedBoundaries,
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
        Drag boxes · pull ports to join · draw Cloud / Trust / VPC boundaries · use Back / Front to
        layer clouds · Straight or Angular arrows · Rename / Delete the selection.
        {drawKind ? ` Drawing ${drawKind}: drag on the canvas to place.` : ''}
      </p>

      <div className="arch-board__layout">
        <aside className="arch-board__palette" aria-label="Playground tools">
          <p className="arch-board__kicker">Selection</p>
          <button
            type="button"
            className="arch-board__stamp"
            disabled={!hasSelection}
            onClick={renameSelected}
          >
            Rename
          </button>
          <button
            type="button"
            className="arch-board__stamp arch-board__stamp--danger"
            disabled={!hasSelection}
            onClick={removeSelected}
          >
            Delete
          </button>
          <button
            type="button"
            className="arch-board__stamp"
            disabled={!selectedBoundary}
            onClick={sendBoundaryBack}
          >
            Send back
          </button>
          <button
            type="button"
            className="arch-board__stamp"
            disabled={!selectedBoundary}
            onClick={bringBoundaryFront}
          >
            Bring front
          </button>

          <p className="arch-board__kicker arch-board__kicker--gap">Boundaries</p>
          {BOUNDARY_PRESETS.map((item) => (
            <button
              key={item.kind}
              type="button"
              className={
                drawKind === item.kind
                  ? 'arch-board__stamp arch-board__stamp--on'
                  : 'arch-board__stamp'
              }
              onClick={() => setDrawKind((current) => (current === item.kind ? null : item.kind))}
            >
              Draw {item.label}
            </button>
          ))}

          <p className="arch-board__kicker arch-board__kicker--gap">Arrows</p>
          <div className="arch-board__wire-toggle" role="group" aria-label="Arrow style">
            <button
              type="button"
              className={
                wireStyle === 'straight'
                  ? 'arch-board__wire-btn arch-board__wire-btn--on'
                  : 'arch-board__wire-btn'
              }
              onClick={() => setWireStyle('straight')}
            >
              Straight
            </button>
            <button
              type="button"
              className={
                wireStyle === 'angular'
                  ? 'arch-board__wire-btn arch-board__wire-btn--on'
                  : 'arch-board__wire-btn'
              }
              onClick={() => setWireStyle('angular')}
            >
              Angular
            </button>
          </div>

          <p className="arch-board__kicker arch-board__kicker--gap">Add / fix</p>
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
            className={
              drawKind ? 'arch-board__sheet arch-board__sheet--draw' : 'arch-board__sheet'
            }
            style={{ minWidth: sheetSize.width, minHeight: sheetSize.height }}
            aria-label="Architecture canvas"
            onPointerDown={onSheetPointerDown}
          >
            {[...boundaries]
              .sort((a, b) => a.z - b.z)
              .map((box) => (
                <div
                  key={box.id}
                  className={
                    selected?.type === 'boundary' && selected.id === box.id
                      ? `arch-board__bound arch-board__bound--${box.kind} arch-board__bound--on`
                      : `arch-board__bound arch-board__bound--${box.kind}`
                  }
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    zIndex: box.z,
                  }}
                  onPointerDown={(event) => onBoundaryPointerDown(box.id, event)}
                >
                  <span className="arch-board__bound-label">{box.label}</span>
                  <button
                    type="button"
                    data-resize="se"
                    className="arch-board__bound-resize"
                    aria-label={`Resize ${box.label}`}
                    onPointerDown={(event) => onBoundaryResizeDown(box.id, event)}
                  />
                </div>
              ))}
            {boundaryDraft ? (
              <div
                className="arch-board__bound arch-board__bound--draft"
                style={{
                  left: boundaryDraft.x,
                  top: boundaryDraft.y,
                  width: Math.max(boundaryDraft.w, 1),
                  height: Math.max(boundaryDraft.h, 1),
                  zIndex: NODE_Z - 1,
                }}
              />
            ) : null}

            <svg className="arch-board__wires" aria-hidden="true" style={{ zIndex: NODE_Z - 1 }}>
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
                const port = linkPorts(link)
                const d = wirePath(wireStyle, port.x1, port.y1, port.x2, port.y2)
                return (
                  <g key={`${link.from}->${link.to}`}>
                    <path
                      className="arch-board__wire-hit"
                      d={d}
                      onClick={() =>
                        setLinks((current) =>
                          current.filter(
                            (item) => !(item.from === link.from && item.to === link.to),
                          ),
                        )
                      }
                    />
                    <path
                      className="arch-board__wire"
                      d={d}
                      markerEnd="url(#arch-board-arrow)"
                    />
                  </g>
                )
              })}
              {draft && draftFrom ? (
                <path
                  className="arch-board__wire arch-board__wire--draft"
                  d={wirePath(
                    wireStyle,
                    portPoint(draftFrom, draft.side).x,
                    portPoint(draftFrom, draft.side).y,
                    draft.x,
                    draft.y,
                  )}
                  markerEnd="url(#arch-board-arrow)"
                />
              ) : null}
            </svg>

            {spots.map((spot) => (
              <div
                key={spot.id}
                className={
                  selected?.type === 'node' && selected.id === spot.id
                    ? `arch-board__node arch-board__node--${spot.kind} arch-board__node--on`
                    : dragId === spot.id
                      ? `arch-board__node arch-board__node--${spot.kind} arch-board__node--drag`
                      : `arch-board__node arch-board__node--${spot.kind}`
                }
                style={{
                  left: spot.x,
                  top: spot.y,
                  width: NODE_W,
                  height: NODE_H,
                  zIndex: NODE_Z,
                }}
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
