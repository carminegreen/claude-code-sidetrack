import { expect, test } from 'claude-code/testing'

import { graphRows, labels, parseLog } from '../hooks/graph'

const text = (rows: ReturnType<typeof graphRows>) => rows.map(runs => runs.map(run => run.text).join(''))

const record = (hash: string, parents: string, refs: string, subject: string) =>
  [hash, parents, refs, 'Ada Lovelace', '04/11/26 10:30', subject].join('\x1f') + '\x1e'

const LOG = [
  record('m', 'b c', 'HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD', 'Merge feature'),
  record('c', 'a', 'refs/heads/feature', 'Add feature'),
  record('b', 'a', 'tag: refs/tags/v1', 'Fix bug'),
  record('a', '', '', 'Initial commit'),
].join('\n')

const OPEN = {
  command: 'sidetrack',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 200 },
} as const

const PANE = {
  plugin: 'sidetrack',
  component: 'Pane',
  requestId: 'sidetrack',
  props: {
    title: 'Sidetrack',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('a merge forks right and joins back', async () => {
  expect(text(graphRows(parseLog(LOG)))).toEqual(['●─╮', '│ ●', '● │', '●─╯'])
})

test('an octopus merge crosses its own fork', async () => {
  const rows = graphRows([
    { hash: 'm', parents: ['a', 'b', 'c'] },
    { hash: 'c', parents: ['a'] },
    { hash: 'b', parents: ['a'] },
    { hash: 'a', parents: [] },
  ])
  expect(text(rows)).toEqual(['●─┬─╮', '│ │ ●', '│ ● │', '●─┴─╯'])
})

test('decorations become labels', async () => {
  const [merge, feature, fix] = parseLog(LOG)
  expect(labels(merge?.refs ?? [])).toEqual([{ name: 'origin & main', kind: 'head' }])
  expect(feature?.refs).toEqual([{ name: 'feature', kind: 'local' }])
  expect(fix?.refs).toEqual([{ name: 'v1', kind: 'tag' }])
})

test('the pane draws the graph on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'sidetrack' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', (_, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv[0] === 'date' ? '04/11/26\n' : LOG,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(OPEN)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Merge feature/ }))?.text).toBe('●─╮ origin & main Merge feature')
    expect((await ui.find({ type: 'Text', text: /⎇/ }))?.text).toBe('⎇ main')
    await ui.unmount()
  }
})

test('outside a repository the pane says why', async ($, on) => {
  on('command.register', () => ({ value: { command: 'sidetrack' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => ({
    value: {
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository\n',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(OPEN)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: not a git repository')
  await ui.unmount()
})
