import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'history',
  component: 'Pane',
  requestId: 'history',
  props: {
    title: 'Prompt history',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const LINES = [
  { display: 'old prompt here', timestamp: 1, project: '/proj' },
  { display: 'fix the login bug', timestamp: 2, project: '/proj' },
  { display: 'elsewhere prompt', timestamp: 3, project: '/other' },
].map(row => JSON.stringify(row)).join('\n')

test('/history lists this project\'s prompts, newest first, and fills the prompt', async ($, on) => {
  let filled = ''
  on('command.register', () => ({ value: { command: 'history' } }))
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.read', () => ({ value: LINES }))
  on('session.cwd', () => ({ value: '/proj' }))
  let columns: number | undefined
  on('ui.open', (_, e) => ((columns = e.columns), { value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('prompt.fill', (_, e) => ((filled = e.text), { isFilled: true }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  await $.command.run({
    command: 'history',
    args: 'login',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

  expect(columns).toBe(120)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', text: /login bug/ })
  expect(row).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: /old prompt/ })).toBeFalsy()
  expect(await ui.find({ type: 'Button', text: /elsewhere/ })).toBeFalsy()
  await ui.press({ key: row!.key! })
  expect(filled).toBe('fix the login bug')
  await ui.unmount()
})
