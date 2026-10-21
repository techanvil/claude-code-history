export type Scope = 'project' | 'all'

declare module 'claude-code' {
  interface PluginState {
    history: { query: string; scope: Scope }
  }
}
