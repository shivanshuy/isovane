/** Workspace shape used by the shell (API payloads are adapted into this). */

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
