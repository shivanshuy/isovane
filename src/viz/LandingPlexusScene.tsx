import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Network of dots (nodes + edges). Spiders jump node → node along edges,
 * spinning noisy silk to nearby nodes. Pointer biases the next hop.
 */

function rnd(x = 1, dx = 0) {
  return Math.random() * x + dx
}

function many<T>(n: number, f: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => f(i))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function noise(x: number, y: number, t = 101) {
  const { sin } = Math
  const w0 = sin(0.3 * x + 1.4 * t + 2.0 + 2.5 * sin(0.4 * y + -1.3 * t + 1.0))
  const w1 = sin(0.2 * y + 1.5 * t + 2.8 + 2.3 * sin(0.5 * x + -1.2 * t + 0.5))
  return w0 + w1
}

type NetNode = { x: number; y: number; neighbors: number[]; blocked: boolean }
type Edge = [number, number]
type BlockRect = { x0: number; y0: number; x1: number; y1: number }

type Network = {
  nodes: NetNode[]
  edges: Edge[]
}

const NOISE_STEPS = 36
const NODE_COUNT = 420
const LINK_K = 3
const BLOCK_PAD = 36
const RING_TIPS = 9
const RIM_DOTS = 12

function buildNetwork(w: number, h: number): Network {
  const nodes: NetNode[] = many(NODE_COUNT, () => ({
    x: rnd(w),
    y: rnd(h),
    neighbors: [],
    blocked: false,
  }))

  const edges: Edge[] = []
  const seen = new Set<string>()

  for (let i = 0; i < nodes.length; i++) {
    const dists: Array<{ j: number; d: number }> = []
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      dists.push({ j, d })
    }
    dists.sort((a, b) => a.d - b.d)
    for (const { j } of dists.slice(0, LINK_K)) {
      const a = Math.min(i, j)
      const b = Math.max(i, j)
      const key = `${a}-${b}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([a, b])
      nodes[i].neighbors.push(j)
      nodes[j].neighbors.push(i)
    }
  }

  return { nodes, edges }
}

function rescaleNetwork(net: Network, ow: number, oh: number, nw: number, nh: number) {
  const sx = nw / Math.max(ow, 1)
  const sy = nh / Math.max(oh, 1)
  for (const n of net.nodes) {
    n.x *= sx
    n.y *= sy
  }
}

function inRect(x: number, y: number, r: BlockRect) {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
}

/** UI content boxes (copy + cards) — spiders stay outside these. */
function readBlockers(host: HTMLElement): BlockRect[] {
  const root = host.closest('.landing') ?? host.parentElement
  if (!root) return []
  const hostRect = host.getBoundingClientRect()
  const els = root.querySelectorAll<HTMLElement>('.landing__copy, .landing__card')
  const rects: BlockRect[] = []
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    rects.push({
      x0: r.left - hostRect.left - BLOCK_PAD,
      y0: r.top - hostRect.top - BLOCK_PAD,
      x1: r.right - hostRect.left + BLOCK_PAD,
      y1: r.bottom - hostRect.top + BLOCK_PAD,
    })
  }
  return rects
}

function markBlocked(net: Network, rects: BlockRect[]) {
  for (const n of net.nodes) {
    n.blocked = rects.some((r) => inRect(n.x, n.y, r))
  }
}

function nearestFreeIndex(net: Network, x: number, y: number, prefer?: number) {
  let best = prefer != null && !net.nodes[prefer]?.blocked ? prefer : -1
  let bestD = best >= 0 ? 0 : Infinity
  for (let i = 0; i < net.nodes.length; i++) {
    const n = net.nodes[i]
    if (n.blocked) continue
    const d = Math.hypot(n.x - x, n.y - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function randomFreeIndex(net: Network) {
  const free: number[] = []
  for (let i = 0; i < net.nodes.length; i++) {
    if (!net.nodes[i].blocked) free.push(i)
  }
  if (!free.length) return Math.floor(rnd(net.nodes.length))
  return free[Math.floor(rnd(free.length))]
}

type HubDot = { x: number; y: number; size: number }

type Spider = {
  follow: (x: number, y: number) => void
  tick: (t: number, w: number, h: number) => void
  collectSilk: (
    w: number,
    h: number,
    linePos: Float32Array,
    lineCount: { n: number },
  ) => void
  hubs: () => HubDot[]
  headRadius: () => number
  stayInClear: () => void
  x: () => number
  y: () => number
}

function spawnSpider(net: Network): Spider {
  const pts2 = many(RING_TIPS, (i) => ({
    x: Math.cos((i / RING_TIPS) * Math.PI * 2),
    y: Math.sin((i / RING_TIPS) * Math.PI * 2),
  }))

  let cur = randomFreeIndex(net)
  let next = cur
  let progress = 1 // start settled on a node
  let dwell = rnd(0.4, 0.2)
  let pointerX = net.nodes[cur].x
  let pointerY = net.nodes[cur].y
  let ringR = 40
  const silkLen = new Float32Array(net.nodes.length)

  const pickNext = (from: number, w: number) => {
    const freeNbrs = net.nodes[from].neighbors.filter((j) => !net.nodes[j].blocked)
    const pool = freeNbrs.length ? freeNbrs : []
    if (!pool.length) {
      const leap = nearestFreeIndex(net, net.nodes[from].x, net.nodes[from].y, from)
      return leap >= 0 ? leap : from
    }

    let best = pool[0]
    let bestScore = Infinity
    for (const j of pool) {
      const n = net.nodes[j]
      const toPointer = Math.hypot(n.x - pointerX, n.y - pointerY)
      const score = toPointer + rnd(w * 0.04)
      if (score < bestScore) {
        bestScore = score
        best = j
      }
    }
    if (rnd() < 0.18) best = pool[Math.floor(rnd(pool.length))]
    return best
  }

  return {
    follow(px, py) {
      const i = nearestFreeIndex(net, px, py)
      if (i >= 0) {
        pointerX = net.nodes[i].x
        pointerY = net.nodes[i].y
      } else {
        pointerX = px
        pointerY = py
      }
    },

    stayInClear() {
      if (!net.nodes[cur]?.blocked && !net.nodes[next]?.blocked) return
      const i = nearestFreeIndex(net, this.x(), this.y())
      if (i < 0) return
      cur = i
      next = i
      progress = 1
      dwell = rnd(0.3, 0.15)
      pointerX = net.nodes[i].x
      pointerY = net.nodes[i].y
    },

    x: () => {
      const a = net.nodes[cur]
      const b = net.nodes[next]
      return lerp(a.x, b.x, progress)
    },
    y: () => {
      const a = net.nodes[cur]
      const b = net.nodes[next]
      return lerp(a.y, b.y, progress)
    },

    headRadius: () => Math.max(7, ringR),

    hubs() {
      const sx = this.x()
      const sy = this.y()
      const hr = Math.max(7, ringR)
      const dots: HubDot[] = [{ x: sx, y: sy, size: 1.6 }]
      // outermost rim as a ring of dots
      for (let i = 0; i < RIM_DOTS; i++) {
        const ang = (i / RIM_DOTS) * Math.PI * 2
        dots.push({
          x: sx + Math.cos(ang) * hr,
          y: sy + Math.sin(ang) * hr,
          size: 2.8,
        })
      }
      return dots
    },

    tick(t, w, h) {
      ringR = w / 140
      const dt = 1 / 60

      if (net.nodes[cur]?.blocked || net.nodes[next]?.blocked) {
        this.stayInClear()
      }

      if (progress < 1) {
        const dist = Math.hypot(
          net.nodes[next].x - net.nodes[cur].x,
          net.nodes[next].y - net.nodes[cur].y,
        )
        const speed = Math.max(120, w * 0.35)
        progress = Math.min(1, progress + (speed * dt) / Math.max(dist, 1))
        if (progress >= 1) {
          cur = next
          dwell = rnd(0.35, 0.25)
        }
      } else {
        dwell -= dt
        if (dwell <= 0) {
          next = pickNext(cur, w)
          if (next === cur) {
            dwell = 0.2
          } else {
            progress = 0
          }
        }
      }

      const sx = this.x()
      const sy = this.y()

      let attached = 0
      for (let i = 0; i < net.nodes.length; i++) {
        const n = net.nodes[i]
        const len = Math.hypot(n.x - sx, n.y - sy)
        const increasing =
          !n.blocked && len < w / 10 && attached < 8 && i !== cur && i !== next
        if (increasing) attached++
        const dir = increasing ? 0.12 : -0.1
        silkLen[i] = Math.max(0, Math.min(silkLen[i] + dir, 1))
      }
    },

    collectSilk(w, h, linePos, lineCount) {
      const mapY = (py: number) => h - py
      const sx = this.x()
      const sy = this.y()

      for (let i = 0; i < net.nodes.length; i++) {
        const sl = silkLen[i]
        if (sl <= 0) continue
        const n = net.nodes[i]
        const tLen = sl * sl

        let best = pts2[0]
        let bestD = Infinity
        for (const p2 of pts2) {
          const hx = sx + p2.x * ringR
          const hy = sy + p2.y * ringR
          const d = Math.hypot(n.x - hx, n.y - hy)
          if (d < bestD) {
            bestD = d
            best = p2
          }
        }

        const x1 = sx + best.x * ringR
        const y1 = sy + best.y * ringR
        const x0 = lerp(x1, n.x, tLen)
        const y0 = lerp(y1, n.y, tLen)

        let prevX = x0
        let prevY = y0
        for (let s = 1; s <= NOISE_STEPS; s++) {
          const u = s / NOISE_STEPS
          let lx = lerp(x0, x1, u)
          let ly = lerp(y0, y1, u)
          const k = noise(lx / 5 + x0, ly / 5 + y0) * 2
          lx += k
          ly += k

          const li = lineCount.n * 6
          if (li + 6 > linePos.length) return
          linePos[li] = prevX
          linePos[li + 1] = mapY(prevY)
          linePos[li + 2] = 0
          linePos[li + 3] = lx
          linePos[li + 4] = mapY(ly)
          linePos[li + 5] = 0
          lineCount.n++
          prevX = lx
          prevY = ly
        }
      }
    },
  }
}

function readPlexusTheme() {
  const styles = getComputedStyle(document.documentElement)
  const theme = document.documentElement.getAttribute('data-theme') || 'red-dwarf'
  const isDark = theme === 'black-hole'
  const bg = styles.getPropertyValue('--bg').trim() || (isDark ? '#2c2e33' : '#ffffff')
  const fg = styles.getPropertyValue('--fg').trim() || (isDark ? '#f4f5f7' : '#0a0a0a')
  const accent = styles.getPropertyValue('--accent').trim() || (isDark ? '#6ea2ff' : '#f35422')
  const muted = styles.getPropertyValue('--muted').trim() || (isDark ? '#a1a6b0' : '#525252')
  return { theme, isDark, bg, fg, accent, muted }
}

export function LandingPlexusScene() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
    })

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#ffffff')

    let w = Math.max(1, host.clientWidth)
    let h = Math.max(1, host.clientHeight)
    const camera = new THREE.OrthographicCamera(0, w, h, 0, -10, 10)
    camera.position.z = 1

    let net = buildNetwork(w, h)
    let netW = w
    let netH = h
    markBlocked(net, readBlockers(host))

    // ---- Static-ish network edges ----
    const netLinePos = new Float32Array(NODE_COUNT * LINK_K * 6)
    const netLineGeo = new THREE.BufferGeometry()
    const netLineAttr = new THREE.BufferAttribute(netLinePos, 3)
    netLineAttr.setUsage(THREE.DynamicDrawUsage)
    netLineGeo.setAttribute('position', netLineAttr)
    const netLineMat = new THREE.LineBasicMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.18,
      depthTest: false,
    })
    const netLines = new THREE.LineSegments(netLineGeo, netLineMat)
    scene.add(netLines)

    const writeNetEdges = () => {
      let n = 0
      const mapY = (py: number) => h - py
      for (const [a, b] of net.edges) {
        const i = n * 6
        if (i + 6 > netLinePos.length) break
        netLinePos[i] = net.nodes[a].x
        netLinePos[i + 1] = mapY(net.nodes[a].y)
        netLinePos[i + 2] = 0
        netLinePos[i + 3] = net.nodes[b].x
        netLinePos[i + 4] = mapY(net.nodes[b].y)
        netLinePos[i + 5] = 0
        n++
      }
      netLineAttr.needsUpdate = true
      netLineGeo.setDrawRange(0, n * 2)
    }
    writeNetEdges()

    // ---- Network nodes as dots ----
    const nodePos = new Float32Array(NODE_COUNT * 3)
    const nodeSize = new Float32Array(NODE_COUNT)
    const nodeGeo = new THREE.BufferGeometry()
    const nodeAttr = new THREE.BufferAttribute(nodePos, 3)
    const nodeSizeAttr = new THREE.BufferAttribute(nodeSize, 1)
    nodeAttr.setUsage(THREE.DynamicDrawUsage)
    nodeSizeAttr.setUsage(THREE.DynamicDrawUsage)
    nodeGeo.setAttribute('position', nodeAttr)
    nodeGeo.setAttribute('aSize', nodeSizeAttr)

    const dotsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uPixelRatio: { value: renderer.getPixelRatio() },
        uColor: { value: new THREE.Color('#0a0a0a') },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uPixelRatio;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          if (length(c) > 0.5) discard;
          gl_FragColor = vec4(uColor, 1.0);
        }
      `,
    })
    scene.add(new THREE.Points(nodeGeo, dotsMat))

    const writeNodes = () => {
      const mapY = (py: number) => h - py
      for (let i = 0; i < net.nodes.length; i++) {
        nodePos[i * 3] = net.nodes[i].x
        nodePos[i * 3 + 1] = mapY(net.nodes[i].y)
        nodePos[i * 3 + 2] = 0
        nodeSize[i] = 2.4
      }
      nodeAttr.needsUpdate = true
      nodeSizeAttr.needsUpdate = true
      nodeGeo.setDrawRange(0, net.nodes.length)
    }
    writeNodes()

    // ---- Spider silk (dynamic) ----
    const MAX_SEGS = 2 * 10 * (NOISE_STEPS + 2)
    const silkPos = new Float32Array(MAX_SEGS * 6)
    const silkGeo = new THREE.BufferGeometry()
    const silkAttr = new THREE.BufferAttribute(silkPos, 3)
    silkAttr.setUsage(THREE.DynamicDrawUsage)
    silkGeo.setAttribute('position', silkAttr)
    silkGeo.setDrawRange(0, 0)
    const silkMat = new THREE.LineBasicMaterial({
      color: 0xf35422,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    })
    const silk = new THREE.LineSegments(silkGeo, silkMat)
    scene.add(silk)

    // pupil + dotted outer rim
    const HUB_PER = 1 + RIM_DOTS
    const hubPos = new Float32Array(2 * HUB_PER * 3)
    const hubSize = new Float32Array(2 * HUB_PER)
    const hubGeo = new THREE.BufferGeometry()
    const hubAttr = new THREE.BufferAttribute(hubPos, 3)
    const hubSizeAttr = new THREE.BufferAttribute(hubSize, 1)
    hubAttr.setUsage(THREE.DynamicDrawUsage)
    hubSizeAttr.setUsage(THREE.DynamicDrawUsage)
    hubGeo.setAttribute('position', hubAttr)
    hubGeo.setAttribute('aSize', hubSizeAttr)
    const hubMat = dotsMat.clone()
    hubMat.uniforms.uPixelRatio = { value: renderer.getPixelRatio() }
    hubMat.uniforms.uColor = { value: new THREE.Color('#f35422') }
    scene.add(new THREE.Points(hubGeo, hubMat))

    // Soft filled head: light inner, darker mid band; outer rim = darker dots
    const headDiscGeo = new THREE.CircleGeometry(1, 64)
    const headInnerGeo = new THREE.RingGeometry(0.3, 0.38, 64)
    const headFadeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uCore: { value: new THREE.Color('#ffffff') },
        uBand: { value: new THREE.Color('#f35422') },
        uStrength: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uBand;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - vec2(0.5)) * 2.0;
          if (r > 1.0) discard;
          // pale peach core, soft coral mid (ref), soft edge under dots
          float innerMask = 1.0 - smoothstep(0.3, 0.4, r);
          float midMask = smoothstep(0.32, 0.45, r) * (1.0 - smoothstep(0.9, 1.0, r));
          float a = (innerMask * 0.32 + midMask * 0.62) * uStrength;
          vec3 col = mix(uCore, uBand, midMask);
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.85));
        }
      `,
    })
    const headInnerMat = new THREE.MeshBasicMaterial({
      color: 0xf5a88a,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      side: THREE.DoubleSide,
    })

    const spiders = many(2, () => spawnSpider(net))
    const headGroups = spiders.map(() => {
      const g = new THREE.Group()
      const fill = new THREE.Mesh(headDiscGeo, headFadeMat)
      const inner = new THREE.Mesh(headInnerGeo, headInnerMat)
      inner.position.z = 0.06
      g.add(fill)
      g.add(inner)
      scene.add(g)
      return g
    })
    spiders[0]?.follow(w * 0.82, h * 0.22)
    spiders[1]?.follow(w * 0.78, h * 0.48)

    const applyTheme = () => {
      const t = readPlexusTheme()
      const bg = new THREE.Color(t.bg)
      const ink = new THREE.Color(t.fg)
      const accent = new THREE.Color(t.accent)
      const edge = ink.clone().lerp(accent, t.isDark ? 0.35 : 0.2)
      // Ref palette: pale peach core, soft coral mid, saturated rim/silk
      const white = new THREE.Color('#ffffff')
      const core = accent.clone().lerp(white, t.isDark ? 0.62 : 0.72) // #fad5c4-ish
      const band = accent.clone().lerp(white, t.isDark ? 0.28 : 0.38) // #f5a88a-ish
      const rimDot = accent.clone() // saturated like #e85a30
      renderer.setClearColor(bg, 1)
      scene.background = bg
      netLineMat.color.copy(edge)
      netLineMat.opacity = t.isDark ? 0.24 : 0.16
      silkMat.color.copy(accent)
      silkMat.opacity = t.isDark ? 0.95 : 0.88
      ;(dotsMat.uniforms.uColor.value as THREE.Color).copy(ink)
      ;(hubMat.uniforms.uColor.value as THREE.Color).copy(rimDot)
      ;(headFadeMat.uniforms.uCore.value as THREE.Color).copy(core)
      ;(headFadeMat.uniforms.uBand.value as THREE.Color).copy(band)
      headFadeMat.uniforms.uStrength.value = t.isDark ? 0.95 : 1
      headInnerMat.color.copy(band.clone().lerp(core, 0.35))
      headInnerMat.opacity = t.isDark ? 0.55 : 0.5
    }
    applyTheme()

    const themeObs = new MutationObserver(() => applyTheme())
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const onPointer = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const px = ((e.clientX - rect.left) / rect.width) * w
      const py = ((e.clientY - rect.top) / rect.height) * h
      for (const sp of spiders) sp.follow(px, py)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    const refreshClearZones = () => {
      markBlocked(net, readBlockers(host))
      for (const sp of spiders) sp.stayInClear()
    }

    const resize = () => {
      const nw = Math.max(1, Math.floor(host.clientWidth))
      const nh = Math.max(1, Math.floor(host.clientHeight))
      rescaleNetwork(net, netW, netH, nw, nh)
      netW = nw
      netH = nh
      w = nw
      h = nh
      renderer.setSize(w, h, false)
      camera.left = 0
      camera.right = w
      camera.top = h
      camera.bottom = 0
      camera.updateProjectionMatrix()
      const pr = renderer.getPixelRatio()
      dotsMat.uniforms.uPixelRatio.value = pr
      hubMat.uniforms.uPixelRatio.value = pr
      writeNetEdges()
      writeNodes()
      refreshClearZones()
    }
    resize()
    // Cards may layout a frame later — re-read blockers
    requestAnimationFrame(() => requestAnimationFrame(refreshClearZones))
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    const landing = host.closest('.landing')
    if (landing) ro.observe(landing)

    let frame = 0
    const anim = (ms: number) => {
      frame = requestAnimationFrame(anim)
      const t = ms / 1000

      for (const sp of spiders) sp.tick(t, w, h)

      const silkCount = { n: 0 }
      for (const sp of spiders) sp.collectSilk(w, h, silkPos, silkCount)
      silkAttr.needsUpdate = true
      silkGeo.setDrawRange(0, silkCount.n * 2)

      const mapY = (py: number) => h - py
      let hi = 0
      spiders.forEach((sp, si) => {
        const sx = sp.x()
        const sy = sp.y()
        const hg = headGroups[si]
        if (hg) {
          hg.position.set(sx, mapY(sy), 0.25)
          // slightly larger than rim dots so the fade covers them
          hg.scale.setScalar(sp.headRadius() * 1.1)
        }
        for (const d of sp.hubs()) {
          hubPos[hi * 3] = d.x
          hubPos[hi * 3 + 1] = mapY(d.y)
          hubPos[hi * 3 + 2] = 0
          hubSize[hi] = d.size
          hi++
        }
      })
      hubAttr.needsUpdate = true
      hubSizeAttr.needsUpdate = true
      hubGeo.setDrawRange(0, hi)

      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(anim)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      themeObs.disconnect()
      window.removeEventListener('pointermove', onPointer)
      netLineGeo.dispose()
      netLineMat.dispose()
      nodeGeo.dispose()
      silkGeo.dispose()
      silkMat.dispose()
      hubGeo.dispose()
      hubMat.dispose()
      headDiscGeo.dispose()
      headInnerGeo.dispose()
      headFadeMat.dispose()
      headInnerMat.dispose()
      for (const g of headGroups) scene.remove(g)
      dotsMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    }
  }, [])

  return <div className="landing-plexus" ref={hostRef} aria-hidden="true" />
}
