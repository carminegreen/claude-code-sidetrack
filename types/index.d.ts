export type RefKind = 'head' | 'local' | 'remote' | 'tag'

export type Ref = { name: string; kind: RefKind }

export type Commit = {
  hash: string
  parents: string[]
  refs: Ref[]
  author: string
  day: string
  time: string
  subject: string
}

export type Graph = {
  branch: string
  today: string
  commits: Commit[]
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'sidetrack': { graph: Shaped<Graph> }
  }
}
