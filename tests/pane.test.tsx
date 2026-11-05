import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

const record = (hash: string, parents: string, refs: string, author: string, date: string, subject: string) =>
  [hash, parents, refs, author, date, subject].join('\0')

const LOG = [
  record('b', 'a', 'HEAD -> refs/heads/main', 'Ada Lovelace', '04/11/26 10:30', 'Second'),
  record('a', '', '', 'Charles Babbage', '01/11/26 09:00', 'First'),
].join('\n')

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

const COMMAND = {
  command: 'sidetrack',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 200 },
} as const

type Git = { exitCode: number; stdout: string; stderr: string }

function world(
  on: On,
  git: { log: Git; branch?: string; delayMs?: number; missing?: string; signed?: boolean },
  clock?: MockClock,
) {
  const seen = { opens: 0, closes: 0, logs: 0 }
  let pane: { isShown: boolean } | undefined

  on('command.register', () => ({ value: { command: 'sidetrack' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.panes', () => ({
    value: pane ? [{ id: 'sidetrack', title: 'Sidetrack', isShown: pane.isShown, isFocused: false, isPlaced: true }] : [],
  }))
  on('ui.open', () => {
    seen.opens++
    pane = { isShown: true }
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    seen.closes++
    pane = undefined
    return { value: undefined }
  })
  on('process.run', async (_, e) => {
    const [cmd, sub] = e.argv
    if (sub === 'log') seen.logs++
    if (git.delayMs) await clock?.sleep(git.delayMs)
    if (cmd === git.missing) return { deny: `spawn ${cmd} ENOENT` }
    const out: Git =
      cmd === 'date'
        ? { exitCode: 0, stdout: '04/11/26\n', stderr: '' }
        : sub === 'symbolic-ref'
          ? git.branch === undefined
            ? { exitCode: 1, stdout: '', stderr: '' }
            : { exitCode: 0, stdout: `${git.branch}\n`, stderr: '' }
          : git.log
    // As git does with log.showSignature=true: the verification text lands in stdout before each record.
    const stdout =
      sub === 'log' && git.signed && !e.argv.includes('--no-show-signature')
        ? out.stdout.replace(/^(?=.)/gm, 'Good "git" signature for ada@example.com\n')
        : out.stdout
    return { value: { ...out, stdout, isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return {
    seen,
    hide: () => {
      if (pane) pane.isShown = false
    },
    show: () => {
      if (pane) pane.isShown = true
    },
  }
}

const ok = (stdout: string): Git => ({ exitCode: 0, stdout, stderr: '' })

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const

test('the pane opens once at start, without filetree', async ($, on) => {
  const clock = mock.clock(on)
  const { seen } = world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  expect(seen.opens).toBe(0)
  await clock.advance(2500)
  expect(seen.opens).toBe(1)
  await clock.advance(10000)
  expect(seen.opens).toBe(1)
})

test('with open at start off, the pane waits for the command', { options: { openAtStart: 'off' } }, async ($, on) => {
  const clock = mock.clock(on)
  const { seen } = world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  await clock.advance(10000)
  expect(seen.opens).toBe(0)
  expect(seen.logs).toBe(0)
})

test('the command toggles the pane', async ($, on) => {
  mock.clock(on)
  const { seen } = world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  expect((await $.command.run(COMMAND)).text).toBe('Sidetrack pane opened.')
  expect((await $.command.run(COMMAND)).text).toBe('Sidetrack pane closed.')
  expect(seen).toEqual({ opens: 1, closes: 1, logs: 1 })
})

test('a pane closed before the open at start stays closed', async ($, on) => {
  const clock = mock.clock(on)
  const { seen } = world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  await $.command.run(COMMAND)
  await $.command.run(COMMAND)
  await clock.advance(10000)
  expect(seen).toEqual({ opens: 1, closes: 1, logs: 1 })
})

test('a hidden pane polls nothing, a shown one polls every 3 seconds', async ($, on) => {
  const clock = mock.clock(on)
  const { seen, hide, show } = world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  await $.command.run(COMMAND)
  expect(seen.logs).toBe(1)
  await clock.advance(3000)
  expect(seen.logs).toBe(2)
  hide()
  await clock.advance(9000)
  expect(seen.logs).toBe(2)
  show()
  await clock.advance(3000)
  expect(seen.logs).toBe(3)
})

test('a slow git log is not stacked by the next polls', async ($, on) => {
  const clock = mock.clock(on)
  const git = { log: ok(LOG), branch: 'main', delayMs: 0 }
  const { seen } = world(on, git, clock)

  await $.session.start(START)
  await $.command.run(COMMAND)
  git.delayMs = 7000
  await clock.advance(9000)
  expect(seen.logs).toBe(2)
  await clock.advance(3000)
  expect(seen.logs).toBe(3)
})

test('a new commit shows on the next poll, and an error clears once git recovers', async ($, on) => {
  const clock = mock.clock(on)
  const git = { log: ok(LOG), branch: 'main' }
  world(on, git)

  await $.session.start(START)
  await $.command.run(COMMAND)

  git.log = { exitCode: 128, stdout: '', stderr: 'fatal: something broke\n' }
  await clock.advance(3000)
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: something broke')
  await ui.unmount()

  git.log = ok(record('c', 'b', 'HEAD -> refs/heads/main', 'Ada Lovelace', '04/11/26 11:00', 'Third') + '\n' + LOG)
  await clock.advance(3000)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Third/ }))?.text).toBe('● main Third')
  await ui.unmount()
})

test('a repository with no commits says so', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(''), branch: 'main' })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('No commits yet')
  await ui.unmount()
})

test('the header names the checked out branch even when its commit is not listed', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(record('z', '', 'refs/remotes/origin/busy', 'Ada Lovelace', '04/11/26 10:30', 'Busy')), branch: 'old' })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /⎇/ }))?.text).toBe('⎇ old')
  await ui.unmount()
})

test('a detached HEAD reads HEAD in the header', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(record('a', '', 'HEAD', 'Ada Lovelace', '04/11/26 10:30', 'First')) })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /⎇/ }))?.text).toBe('⎇ HEAD')
  await ui.unmount()
})

test('author and date step aside as the pane narrows', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(LOG), branch: 'main' })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const meta = async (bodyColumns: number) => {
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns }, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text', text: /10:30|01\/11\/26/ })).map(node => node.text)
    await ui.unmount()
    return texts
  }

  expect(await meta(80)).toEqual(['Ada Lovelace      10:30', 'Charles Babbag 01/11/26'])
  expect(await meta(50)).toEqual(['   10:30', '01/11/26'])
  expect(await meta(30)).toEqual([])
})

test('a control character in a commit leaves the pane drawn', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(record('a', '', 'HEAD -> refs/heads/main', 'Ev\x07e', '04/11/26 10:30', 'Paste \x1b[31mred')), branch: 'main' })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Paste/ }))?.text).toBe('● main Paste  [31mred')
  expect((await ui.find({ type: 'Text', text: /Ev/ }))?.text).toBe('Ev e              10:30')
  await ui.unmount()
})

test('signatures shown by the git config leave the graph whole', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(LOG), branch: 'main', signed: true })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /First/ }))?.text).toBe('● First')
  await ui.unmount()
})

test('without git the pane says why', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(LOG), branch: 'main', missing: 'git' })

  await $.session.start(START)
  expect((await $.command.run(COMMAND)).text).toBe('Sidetrack pane opened.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toMatch(/^git: .*spawn git ENOENT/)
  await ui.unmount()
})

test('without date the graph still draws, every commit dated in full', async ($, on) => {
  mock.clock(on)
  world(on, { log: ok(LOG), branch: 'main', missing: 'date' })

  await $.session.start(START)
  await $.command.run(COMMAND)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Ada/ }))?.text).toBe('Ada Lovelace   04/11/26')
  await ui.unmount()
})
