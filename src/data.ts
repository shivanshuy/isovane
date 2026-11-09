export type WorkspaceIcon = 'n' | 'drop' | 'bolt' | 's'

export type Workspace = {
  id: string
  name: string
  description: string
  folder: string
  stack: string
  branch: string
  icon: WorkspaceIcon
  url: string
  uptime: string
  since: string
  cpu: number
  cpuPeak: string
  memory: string
  memoryOf: string
  energy: string
  energyNote: string
  ports: { label: string; port: string }[]
}

export type AgentRow = {
  id: string
  title: string
  meta: string
  tone: 'orange' | 'blue' | 'idle'
  width: string
}

export type ServiceRow = {
  name: string
  command: string
}

export type LogLine = {
  time: string
  source: 'web' | 'emails'
  text: string
  kind?: 'ok' | 'warn'
}

export const workspaces: Workspace[] = [
  {
    id: 'checkout-agent',
    name: 'checkout-agent',
    description: 'Checkout and refund agent under policy gate.',
    folder: '~/agents/checkout-agent',
    stack: 'LangGraph · Python',
    branch: 'main',
    icon: 'drop',
    url: 'checkout-agent.localhost',
    uptime: '42 m',
    since: '10:14',
    cpu: 12,
    cpuPeak: 'Peak 38% · 5 min',
    memory: '412 MB',
    memoryOf: 'of 48 GB',
    energy: '3.1 W',
    energyNote: 'Low · average',
    ports: [
      { label: 'gate', port: '8092' },
      { label: 'agent', port: '2026' },
    ],
  },
  {
    id: 'support-bot',
    name: 'support-bot',
    description: 'Customer support bot with tool egress controls.',
    folder: '~/agents/support-bot',
    stack: 'LangChain · TS',
    branch: 'main',
    icon: 'n',
    url: 'support-bot.localhost',
    uptime: '3 h',
    since: '07:02',
    cpu: 6,
    cpuPeak: 'Peak 22% · 5 min',
    memory: '188 MB',
    memoryOf: 'of 48 GB',
    energy: '1.4 W',
    energyNote: 'Low · average',
    ports: [{ label: 'tools', port: '4000' }],
  },
  {
    id: 'ops-runner',
    name: 'ops-runner',
    description: 'Ops MCP runner for privileged tooling.',
    folder: '~/agents/ops-runner',
    stack: 'MCP · Python',
    branch: 'secure',
    icon: 'bolt',
    url: 'ops-runner.localhost',
    uptime: '18 m',
    since: '10:38',
    cpu: 21,
    cpuPeak: 'Peak 44% · 5 min',
    memory: '640 MB',
    memoryOf: 'of 48 GB',
    energy: '4.6 W',
    energyNote: 'Low · average',
    ports: [{ label: 'mcp', port: '3100' }],
  },
  {
    id: 'research-agent',
    name: 'research-agent',
    description: 'Research agent with browsing and synthesis tools.',
    folder: '~/agents/research-agent',
    stack: 'OpenAI tools',
    branch: 'main',
    icon: 's',
    url: 'research-agent.localhost',
    uptime: '1 h',
    since: '09:20',
    cpu: 4,
    cpuPeak: 'Peak 11% · 5 min',
    memory: '96 MB',
    memoryOf: 'of 48 GB',
    energy: '0.8 W',
    energyNote: 'Low · average',
    ports: [{ label: 'api', port: '8080' }],
  },
]

export const agents: AgentRow[] = [
  {
    id: 'refund',
    title: 'Refund tool gated',
    meta: 'Policy · require confirm',
    tone: 'orange',
    width: '72%',
  },
  {
    id: 'send',
    title: 'Send blocked from email',
    meta: 'Watch · 3 denies',
    tone: 'blue',
    width: '38%',
  },
  {
    id: 'scan',
    title: 'Last analyze clean',
    meta: 'Analyze · idle',
    tone: 'idle',
    width: '14%',
  },
]

export const services: ServiceRow[] = [
  { name: 'gate', command: 'poetry run isovane-serve' },
  { name: 'app', command: 'npm run dev' },
]

export const logs: LogLine[] = [
  { time: '10:56:02', source: 'web', text: 'POST /gates DENY send · untrusted email', kind: 'ok' },
  { time: '10:56:04', source: 'web', text: 'POST /analyze job_ab12 done · 4 findings' },
  { time: '10:56:09', source: 'emails', text: 'hunt poison_email_send · DENY', kind: 'ok' },
  { time: '10:56:10', source: 'web', text: 'GET /findings?status=open 200', kind: 'ok' },
  { time: '10:56:21', source: 'web', text: 'POST /fixes/fnd_… copy patch ready', kind: 'ok' },
]

export const cpuBars = [18, 22, 19, 28, 24, 31, 27, 35, 30, 26, 22, 18]
export const memoryBars = [40, 42, 44, 43, 48, 52, 50, 55, 53, 49, 46, 44]
