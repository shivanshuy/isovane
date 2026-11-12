import type { Finding } from '../api'

export type ExploitNode = {
  id: string
  label: string
  detail: string
}

export type ExploitPreset = {
  id: string
  title: string
  nodes: ExploitNode[]
}

const PRESETS: Record<string, ExploitPreset> = {
  bind: {
    id: 'bind',
    title: 'Open bind → remote reach',
    nodes: [
      { id: 'attacker', label: 'Attacker', detail: 'Same Wi-Fi or public net' },
      { id: 'ip', label: 'Host IP', detail: 'Service on 0.0.0.0' },
      { id: 'api', label: 'Agent API', detail: 'No auth assumed' },
      { id: 'impact', label: 'Impact', detail: 'Tools / data exposed' },
    ],
  },
  shell: {
    id: 'shell',
    title: 'Injection → shell',
    nodes: [
      { id: 'input', label: 'Hostile input', detail: 'Chat / email / RAG' },
      { id: 'wrap', label: 'Tool wrapper', detail: 'shell=True path' },
      { id: 'os', label: 'OS shell', detail: 'Commands run' },
      { id: 'impact', label: 'Impact', detail: 'Exfil / RCE' },
    ],
  },
  secret: {
    id: 'secret',
    title: 'Leak → credential theft',
    nodes: [
      { id: 'repo', label: 'Source / zip', detail: 'Key in plain text' },
      { id: 'scan', label: 'Attacker finds it', detail: 'Git scrape / zip' },
      { id: 'reuse', label: 'Reuse key', detail: 'Calls your APIs' },
      { id: 'impact', label: 'Impact', detail: 'Quota / data / cloud' },
    ],
  },
  prompt: {
    id: 'prompt',
    title: 'Prompt → tool abuse',
    nodes: [
      { id: 'poison', label: 'Poisoned text', detail: 'Chat or document' },
      { id: 'model', label: 'Model', detail: 'Follows fake rules' },
      { id: 'tool', label: 'Tool call', detail: 'Send / pay / shell' },
      { id: 'impact', label: 'Impact', detail: 'Real-world action' },
    ],
  },
  ssrf: {
    id: 'ssrf',
    title: 'URL → server fetch → internal hit',
    nodes: [
      { id: 'input', label: 'Hostile URL', detail: 'Chat / tool arg' },
      { id: 'fetch', label: 'urlopen', detail: 'Server fetches it' },
      { id: 'target', label: 'Internal target', detail: 'Metadata / localhost' },
      { id: 'impact', label: 'Impact', detail: 'Creds / side effects' },
    ],
  },
  egress: {
    id: 'egress',
    title: 'Org data → vendor cloud',
    nodes: [
      { id: 'store', label: 'Org / PII data', detail: 'CRM, DB, chat' },
      { id: 'agent', label: 'App / agent', detail: 'Builds the prompt' },
      { id: 'vendor', label: 'LLM vendor', detail: 'Leaves your VPC' },
      { id: 'impact', label: 'Impact', detail: 'Residency / DPA risk' },
    ],
  },
  multicloud: {
    id: 'multicloud',
    title: 'One prompt → many vendors',
    nodes: [
      { id: 'data', label: 'Sensitive prompt', detail: 'Same payload' },
      { id: 'router', label: 'Agent router', detail: 'Fan-out path' },
      { id: 'vendors', label: 'Vendor A + B', detail: 'Separate processors' },
      { id: 'impact', label: 'Impact', detail: 'Multiplied breach surface' },
    ],
  },
  dlp: {
    id: 'dlp',
    title: 'PII → LLM with no filter',
    nodes: [
      { id: 'pii', label: 'Customer PII', detail: 'Raw identifiers' },
      { id: 'gap', label: 'Missing DLP', detail: 'No redact step' },
      { id: 'llm', label: 'Cloud LLM', detail: 'Sees cleartext' },
      { id: 'impact', label: 'Impact', detail: 'Regulated data egress' },
    ],
  },
  zdr: {
    id: 'zdr',
    title: 'Prompt → retention gap',
    nodes: [
      { id: 'prompt', label: 'Business prompt', detail: 'May hold secrets' },
      { id: 'api', label: 'Vendor API', detail: 'Default SaaS terms' },
      { id: 'retain', label: 'No ZDR marker', detail: 'Training / logs possible' },
      { id: 'impact', label: 'Impact', detail: 'Policy / contract miss' },
    ],
  },
  logging: {
    id: 'logging',
    title: 'Prompt → trace sink',
    nodes: [
      { id: 'session', label: 'LLM session', detail: 'Prompt + completion' },
      { id: 'span', label: 'Observability', detail: 'Full trace capture' },
      { id: 'sink', label: 'APM / LangSmith', detail: 'Second egress' },
      { id: 'impact', label: 'Impact', detail: 'Duplicate data leave' },
    ],
  },
  saas: {
    id: 'saas',
    title: 'SaaS store → LLM hop',
    nodes: [
      { id: 'saas', label: 'SaaS datastore', detail: 'Salesforce / CRM' },
      { id: 'app', label: 'Your app', detail: 'Pulls fields' },
      { id: 'llm', label: 'LLM vendor', detail: 'Second processor' },
      { id: 'impact', label: 'Impact', detail: 'Two-cloud transfer' },
    ],
  },
  hitl: {
    id: 'hitl',
    title: 'Chat → agent → action (no HITL)',
    nodes: [
      { id: 'user', label: 'User / RAG', detail: 'Steers the session' },
      { id: 'agent', label: 'Agent', detail: 'No confirm gate' },
      { id: 'tool', label: 'Consequential tool', detail: 'Pay / send / shell' },
      { id: 'impact', label: 'Impact', detail: 'Confused-deputy act' },
    ],
  },
  mcp: {
    id: 'mcp',
    title: 'Agent → MCP → blast radius',
    nodes: [
      { id: 'agent', label: 'Agent', detail: 'Inherits privileges' },
      { id: 'mcp', label: 'MCP server', detail: 'Unpinned / broad tools' },
      { id: 'tool', label: 'Tool invoke', detail: 'Poisoned description' },
      { id: 'impact', label: 'Impact', detail: 'Supply-chain agency' },
    ],
  },
  a2a: {
    id: 'a2a',
    title: 'Agent → agent without auth',
    nodes: [
      { id: 'a', label: 'Agent A', detail: 'Handoff peer' },
      { id: 'edge', label: 'A2A edge', detail: 'No mTLS / identity' },
      { id: 'b', label: 'Agent B', detail: 'Trusts network only' },
      { id: 'impact', label: 'Impact', detail: 'Spoofed peer actions' },
    ],
  },
  trust: {
    id: 'trust',
    title: 'Untrusted UI → agent',
    nodes: [
      { id: 'ui', label: 'Chat / UI', detail: 'Attacker-shaped text' },
      { id: 'edge', label: 'Unmarked edge', detail: 'No trust label' },
      { id: 'agent', label: 'Agent', detail: 'Treats as trusted' },
      { id: 'impact', label: 'Impact', detail: 'Injection ingress' },
    ],
  },
  agency: {
    id: 'agency',
    title: 'Wildcard tools → overreach',
    nodes: [
      { id: 'chat', label: 'Hostile steer', detail: 'Chat or RAG' },
      { id: 'agent', label: 'Agent', detail: 'tools = *' },
      { id: 'any', label: 'Any tool', detail: 'No allow-list' },
      { id: 'impact', label: 'Impact', detail: 'Max blast radius' },
    ],
  },
  default: {
    id: 'default',
    title: 'Input → sink → impact',
    nodes: [
      { id: 'input', label: 'Attacker input', detail: 'Nearest user control' },
      { id: 'path', label: 'Code path', detail: 'Reaches the finding' },
      { id: 'sink', label: 'Sensitive sink', detail: 'Flagged line' },
      { id: 'impact', label: 'Impact', detail: 'Security boundary breaks' },
    ],
  },
}

function findingBlob(finding: Finding): string {
  const args = finding.evidence.args || {}
  return [
    finding.title,
    finding.summary,
    finding.description || '',
    finding.exploit || '',
    finding.evidence.snippet || '',
    finding.evidence.path || '',
    finding.category,
    finding.evidence.tool || '',
    finding.evidence.source_channel || '',
    ...(finding.tags || []),
    ...(finding.owasp || []),
    typeof args.analysis_mode === 'string' ? args.analysis_mode : '',
    typeof args.diagram_region === 'string' ? args.diagram_region : '',
    typeof args.region === 'string' ? args.region : '',
  ]
    .join(' ')
    .toLowerCase()
}

export function presetForFinding(finding: Finding | null | undefined): ExploitPreset {
  if (!finding) return PRESETS.default
  const blob = findingBlob(finding)
  const tags = (finding.tags || []).map((t) => t.toLowerCase()).join(' ')
  const mode =
    typeof finding.evidence.args?.analysis_mode === 'string'
      ? finding.evidence.args.analysis_mode.toLowerCase()
      : ''

  if (
    blob.includes('0.0.0.0') ||
    blob.includes('bind_all') ||
    blob.includes('all interfaces') ||
    blob.includes('b104')
  ) {
    return PRESETS.bind
  }
  if (
    blob.includes('urlopen') ||
    blob.includes('urllib') ||
    blob.includes('url_fetch') ||
    blob.includes('ssrf') ||
    (blob.includes('fetch') && blob.includes('url'))
  ) {
    return PRESETS.ssrf
  }
  if (
    blob.includes('shell=true') ||
    blob.includes('subprocess') ||
    blob.includes('os.system') ||
    blob.includes('eval(') ||
    blob.includes('exec(') ||
    blob.includes('shell / code-execution') ||
    blob.includes('agent→shell')
  ) {
    return PRESETS.shell
  }
  if (
    (blob.includes('secret') ||
      blob.includes('api_key') ||
      blob.includes('credential') ||
      blob.includes('token')) &&
    finding.category !== 'architecture'
  ) {
    return PRESETS.secret
  }

  // Architecture / privacy / workflow — match the issue, not a single prompt cartoon
  if (
    blob.includes('hitl') ||
    blob.includes('without hitl') ||
    blob.includes('no human') ||
    blob.includes('approval') ||
    blob.includes('confirm gate') ||
    tags.includes('hitl')
  ) {
    return PRESETS.hitl
  }
  if (
    blob.includes('multi-cloud') ||
    blob.includes('multi cloud') ||
    blob.includes('fan-out') ||
    blob.includes('fanout') ||
    blob.includes('more than one model vendor') ||
    tags.includes('multi-cloud')
  ) {
    return PRESETS.multicloud
  }
  if (
    blob.includes('without redact') ||
    blob.includes('without dlp') ||
    blob.includes('no redact') ||
    blob.includes('pii path') ||
    blob.includes('customer/pii') ||
    tags.includes('pii')
  ) {
    return PRESETS.dlp
  }
  if (
    blob.includes('zero-data-retention') ||
    blob.includes('zero data retention') ||
    blob.includes('no-training') ||
    blob.includes('zdr') ||
    tags.includes('retention')
  ) {
    return PRESETS.zdr
  }
  if (
    blob.includes('observability') ||
    blob.includes('langsmith') ||
    blob.includes('trace') ||
    blob.includes('logging sink') ||
    tags.includes('logging')
  ) {
    return PRESETS.logging
  }
  if (
    blob.includes('saas data') ||
    blob.includes('salesforce') ||
    blob.includes('two processors') ||
    blob.includes('saas→llm')
  ) {
    return PRESETS.saas
  }
  if (blob.includes('mcp') || tags.includes('mcp')) {
    return PRESETS.mcp
  }
  if (
    blob.includes('agent-to-agent') ||
    blob.includes('a2a') ||
    blob.includes('handoff') ||
    tags.includes('a2a')
  ) {
    return PRESETS.a2a
  }
  if (
    blob.includes('trust-boundary') ||
    blob.includes('trust boundary') ||
    blob.includes('untrusted') ||
    tags.includes('trust boundary')
  ) {
    return PRESETS.trust
  }
  if (
    blob.includes('wildcard') ||
    blob.includes('unrestricted tools') ||
    blob.includes('tools=*') ||
    tags.includes('agency')
  ) {
    return PRESETS.agency
  }
  if (
    blob.includes('egress') ||
    blob.includes('residency') ||
    blob.includes('organizational data') ||
    blob.includes('vendor cloud') ||
    blob.includes('leaves the org') ||
    tags.includes('privacy & cloud') ||
    tags.includes('data residency')
  ) {
    return PRESETS.egress
  }

  if (
    blob.includes('jailbreak') ||
    blob.includes('prompt injection') ||
    blob.includes('indirect prompt') ||
    finding.category === 'prompt' ||
    (blob.includes('rag') && blob.includes('poison'))
  ) {
    return PRESETS.prompt
  }

  if (finding.category === 'architecture' || mode === 'privacy' || mode === 'workflow') {
    if (mode === 'workflow' || tags.includes('workflow graph')) return PRESETS.hitl
    if (mode === 'privacy' || tags.includes('privacy & cloud')) return PRESETS.egress
    return PRESETS.egress
  }

  if (blob.includes('prompt') || blob.includes('rag') || blob.includes('llm / agent')) {
    return PRESETS.prompt
  }

  return PRESETS.default
}
