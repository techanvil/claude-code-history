import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Scope } from '../types'

const PANE = 'history'
const LIMIT = 200
// The share of the terminal's width the docked pane asks for.
const WIDTH = 0.6

const query = atom({ plugin: 'history', key: 'query' } as const, '')
const scope = atom({ plugin: 'history', key: 'scope' } as const, 'project' as Scope)

type Entry = { text: string; timestamp: number; project: string }

// Read once per /history run; the module's variables start over on a reload.
let entries: Entry[] = []

const load = async ($: EngineInterface): Promise<Entry[]> => {
  const home = await $.env.get('HOME')
  const raw = await $.fs.read(`${home}/.claude/history.jsonl`).catch(() => '')
  const newest = new Map<string, Entry>()

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      const text = typeof row.display === 'string' ? row.display.trim() : ''
      if (!text || text.startsWith('/history')) continue
      const entry = { text, timestamp: Number(row.timestamp) || 0, project: String(row.project ?? '') }
      const key = `${entry.project}\n${text}`
      const seen = newest.get(key)
      if (!seen || seen.timestamp < entry.timestamp) newest.set(key, entry)
    } catch {
      // A torn line from a concurrent write: skip it.
    }
  }

  return [...newest.values()].sort((a, b) => b.timestamp - a.timestamp)
}

const age = (timestamp: number): string => {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 60) return `${Math.max(minutes, 0)}m`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`
  if (minutes < 60 * 24 * 30) return `${Math.floor(minutes / (60 * 24))}d`

  return `${Math.floor(minutes / (60 * 24 * 30))}mo`
}

// The shortest name that tells each project apart: its folder, or where several
// share one (many checkouts of one plugin), the first segment of its path that differs.
const projectLabels = (paths: string[]): Map<string, string> => {
  const split = new Map(paths.map(path => [path, path.split('/').filter(Boolean)]))
  const byLast = new Map<string, string[]>()
  for (const [path, parts] of split) {
    const last = parts[parts.length - 1] ?? path
    byLast.set(last, [...(byLast.get(last) ?? []), path])
  }

  const labels = new Map<string, string>()
  for (const [last, group] of byLast) {
    for (const path of group) {
      const parts = split.get(path) ?? []
      const differs = group.length === 1
        ? -1
        : parts.findIndex((part, i) => group.some(other => split.get(other)?.[i] !== part))
      labels.set(path, differs < 0 ? last : (parts[differs] ?? last))
    }
  }

  return labels
}

const open = async ($: EngineInterface, text: string, terminalColumns: number) => {
  entries = await load($)
  await update($, query, () => text)
  await $.ui.open({
    id: PANE,
    title: 'Prompt history',
    focus: true,
    closeOnEscape: true,
    columns: Math.max(60, Math.round(terminalColumns * WIDTH)),
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'history',
      description: 'Browse past prompts; pick one to put it back in the prompt box',
      argumentHint: '[search]',
    })

    return next(e)
  })

  on('command.run', { command: 'history' }, async ($, e) => {
    await open($, e.args.trim(), e.presentation.columns)

    return { text: `Prompt history opened (${entries.length} prompts).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // Mobile draws no text field: there `/history <search>` is the filter.
    const Input = 'Input' in elements ? elements.Input : undefined
    const typed = await read($, query)
    const text = typed.toLowerCase()
    const where = await read($, scope)
    const cwd = await $.session.cwd()
    // Each row is the age, padded to 4, a space, then the prompt on one line.
    const width = Math.max(20, (e.props.bodyColumns ?? 80) - 6)

    const matches = entries.filter(
      entry =>
        (where === 'all' || entry.project === cwd) &&
        (!text || entry.text.toLowerCase().includes(text)),
    )

    const shown = matches.slice(0, LIMIT)
    const labels = projectLabels([...new Set(entries.map(entry => entry.project))])

    const choose = async (entry: Entry) => {
      await $.prompt.fill({ text: entry.text })
      await $.ui.close({ id: PANE })
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Button
            key="scope"
            plain
            hotkey="s"
            label={where === 'project' ? 'This project' : 'All projects'}
            onPress={() => void update($, scope, s => (s === 'project' ? 'all' : 'project'))}
          />
          <Text dimColor>
            {matches.length} match{matches.length === 1 ? '' : 'es'}
            {matches.length > LIMIT ? `, newest ${LIMIT} shown` : ''} · ↓ to the list, then PgUp/PgDn · Enter puts it in the prompt · Esc closes
          </Text>
        </Box>
        {Input && (
          <Input
            key="search"
            label="Search"
            placeholder="type to filter"
            value={typed}
            submitLabel="pick first"
            autoFocus
            onInput={(value: string) => void update($, query, () => value)}
            onSubmit={() => matches[0] && void choose(matches[0])}
          />
        )}
        {matches.length === 0 && <Text dimColor>No prompts match.</Text>}
        {shown.map((entry, i) => {
          const line = entry.text.replace(/\s+/g, ' ')
          const cut = line.length > width ? `${line.slice(0, width - 1)}…` : line
          // In all projects, a header row names the project where it changes.
          const isNewProject = where === 'all' && entry.project !== shown[i - 1]?.project
          const label = labels.get(entry.project) ?? entry.project

          return (
            <Box key={`entry:${i}:${entry.timestamp}`} flexDirection="column">
              {isNewProject && (
                <Box marginTop={i === 0 ? 0 : 1}>
                  <Text color="cyan" bold>{label}</Text>
                  {entry.project === cwd && <Text dimColor> (this project)</Text>}
                </Box>
              )}
              <Button key={`row:${i}:${entry.timestamp}`} plain onPress={() => void choose(entry)}>
                <Text dimColor>{age(entry.timestamp).padStart(4)} </Text>
                {cut}
              </Button>
            </Box>
          )
        })}
      </Box>
    )
  })
}
