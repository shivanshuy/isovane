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

export function presetForFinding(finding: Finding | null | undefined): ExploitPreset {
  if (!finding) return PRESETS.default
  const blob = [
    finding.title,
    finding.summary,
    finding.exploit || '',
    finding.evidence.snippet || '',
    finding.evidence.path || '',
    ...(finding.tags || []),
    finding.category,
    finding.evidence.tool || '',
  ]
    .join(' ')
    .toLowerCase()

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
    blob.includes('exec(')
  ) {
    return PRESETS.shell
  }
  if (blob.includes('secret') || blob.includes('api_key') || blob.includes('credential') || blob.includes('token')) {
    return PRESETS.secret
  }
  if (
    blob.includes('prompt') ||
    blob.includes('jailbreak') ||
    blob.includes('rag') ||
    blob.includes('llm / agent') ||
    finding.category === 'prompt' ||
    finding.category === 'architecture'
  ) {
    return PRESETS.prompt
  }
  return PRESETS.default
}
