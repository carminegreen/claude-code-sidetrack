import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Commit, Graph, RefKind } from '../types'
import { graphRows, labels, LOG_FORMAT, parseLog, printable } from './graph'
import type { Run } from './graph'

const PANE = 'sidetrack'
const TITLE = 'Graph'
const LIMIT = 250
const POLL_MS = 3000
const FILETREE_PANE = 'filetree'
const START_FALLBACK_MS = 2500

// A flag or a skin-toned emoji is several code points, so the author is cut between graphemes.
const GRAPHEMES = new Intl.Segmenter()

const LANE_COLORS = ['#4c9ee8', '#e8a33d', '#5fb760', '#c96fd8', '#e0605a', '#3fbfb0', '#d8c14a', '#8b8fea']
// Theme keys, picked by hue (gold, green, purple, teal), so labels stay readable on a light or colour-blind theme.
const REF_COLORS: Record<RefKind, string> = { head: 'warning', local: 'success', remote: 'merged', tag: 'planMode' }

const graph = atom({ plugin: 'sidetrack', key: 'graph' } as const, { branch: '', today: '', commits: [] } as Graph, {
  shape: 'graph-1',
})

let isOpenedAtStart = false
let isPolling = false

// No `focus`: at start the pane must not take the keys or another mod's front tab.
async function openOnce($: EngineInterface) {
  if (isOpenedAtStart) return
  isOpenedAtStart = true
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  // Undrawn, under 144 columns or in a -p run, the pane is filled by the first poll that finds it shown.
  if (opened.isPlaced) await refresh($, true)
}

// The engine refuses a whole tree past 20,000 nodes, each element and each string one: the header takes 7, a row 9,
// two more a lane run and three a label. A wide history or a pile of tags drops its oldest rows instead.
function rowsThatFit(commits: readonly Commit[], rows: readonly Run[][]): number {
  let nodes = 7
  for (const [i, commit] of commits.entries()) {
    nodes += 9 + 2 * (rows[i]?.length ?? 0) + 3 * commit.refs.length
    if (nodes > 20000) return i
  }
  return commits.length
}

async function paneOf($: EngineInterface) {
  return (await $.ui.panes()).find(pane => pane.id === PANE)
}

// A command that cannot start, such as git or date not installed, reads as a failed run instead of throwing.
function run($: EngineInterface, argv: string[]) {
  return $.process.run(argv).catch((error: unknown) => ({
    exitCode: -1,
    stdout: '',
    stderr: `${argv[0]}: ${error instanceof Error ? error.message : String(error)}`,
  }))
}

async function refresh($: EngineInterface, force = false) {
  if (!force && !(await paneOf($))?.isShown) return

  // Without a commit-graph, as after a fresh clone, --date-order walks the whole history: 1.2 s on 300k commits.
  // So git log runs only once a ref, HEAD or the day changed.
  const [refs, head, today] = await Promise.all([
    run($, ['git', 'show-ref', '--head']),
    // Not --short: it answers heads/<name> when a tag shares the branch's name.
    run($, ['git', 'symbolic-ref', '-q', 'HEAD']),
    run($, ['date', '+%d/%m/%y']),
  ])
  const stamp = `${refs.stdout}${refs.stderr}${head.stdout}${today.stdout}`
  // Kept beside the graph, not in the module: a /clear starts the session's state over, and the graph must be read again.
  if (!force && stamp === (await read($, graph)).stamp) return

  const log = await run($, [
    'git',
    'log',
    '--branches',
    '--remotes',
    '--tags',
    // Must precede HEAD: skips it while unborn, in a new repository or on an orphan branch.
    '--ignore-missing',
    'HEAD',
    '--date-order',
    '--decorate=full',
    // log.showSignature in the person's config would print each verification into stdout.
    '--no-show-signature',
    // i18n.logOutputEncoding in the person's config would re-encode names and subjects that are read back as UTF-8.
    '--encoding=UTF-8',
    `-n${LIMIT}`,
    '--date=format-local:%d/%m/%y %H:%M',
    `--format=${LOG_FORMAT}`,
    '--',
  ])
  const commits = parseLog(log.stdout)
  if (log.exitCode !== 0 || commits.length === 0) {
    const error =
      log.exitCode === 0 ? 'No commits yet' : printable(log.stderr.trim().split('\n')[0] ?? '') || `git log: exit ${log.exitCode}`
    // A timeout or a killed git leaves the refs as they were, so a failed log keeps no stamp and is tried again on the next poll.
    await update($, graph, () => ({ branch: '', today: '', commits: [], error, stamp: log.exitCode === 0 ? stamp : undefined }))
    return
  }
  const branch = printable(head.stdout.trim().replace(/^refs\/heads\//, '')) || 'HEAD'
  await update($, graph, () => ({ branch, today: today.stdout.trim(), commits, stamp }))
}

export const register: Register = (on, options) => {
  const openAtStart = options?.openAtStart !== 'off'

  on('session.start', async ($, e, next) => {
    // Immediate: the graph is most worth watching while Claude works, so the toggle must not wait for the turn to end.
    await $.command.register({ name: 'sidetrack', description: 'Show or hide the git graph pane', immediate: true })
    // A git log slower than the period, as in a large history without a commit-graph, is not run twice at once.
    $.clock.every(POLL_MS, () => {
      if (isPolling) return
      isPolling = true
      void refresh($)
        .catch(() => {})
        .finally(() => (isPolling = false))
    })
    if (openAtStart) $.clock.after(START_FALLBACK_MS, () => void openOnce($).catch(() => {}))

    return next(e)
  })

  // Tabs follow open order: ours opens right after filetree's so filetree stays the first tab.
  on('ui.open', { id: FILETREE_PANE }, async ($, e, next) => {
    const opened = await next(e)
    if (openAtStart) $.clock.after(0, () => void openOnce($).catch(() => {}))

    return opened
  }).catch((_$, e, next) => next(e))

  on('command.run', { command: 'sidetrack' }, async $ => {
    // The person's own toggle wins over the open at start still pending.
    isOpenedAtStart = true
    const pane = await paneOf($)
    if (pane?.isShown) {
      await $.ui.close({ id: PANE })
      return { text: 'Sidetrack pane closed.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    await refresh($, true)

    return { text: 'Sidetrack pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const { branch, today, commits, error } = await read($, graph)
    const width = e.props.bodyColumns

    if (error) return <Text dimColor>{error}</Text>
    if (commits.length === 0) return <Text dimColor>Loading git log…</Text>

    const rows = graphRows(commits)
    const showAuthor = width >= 64
    const showDate = width >= 40

    // dir: a row reads by its first strong letter, so a Hebrew or Arabic subject would mirror the lanes.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1} flexShrink={1}>
            <Text color={REF_COLORS.head} weight="bold" wrap="truncate-end" dir="ltr">
              ⎇ {branch}
            </Text>
          </Box>
          <Button key="refresh" label="↻" plain dimColor hotkey="r" onPress={() => void refresh($, true).catch(() => {})} />
        </Box>
        {commits.slice(0, rowsThatFit(commits, rows)).map((commit, i) => {
          const isHead = commit.refs.some(ref => ref.kind === 'head')
          const when = commit.day === today ? commit.time : commit.day
          const author = Array.from(GRAPHEMES.segment(commit.author), part => part.segment)
            .slice(0, 14)
            .join('')
          const meta = [showAuthor ? author.padEnd(14) : '', showDate ? when.padStart(8) : '']
            .filter(Boolean)
            .join(' ')

          return (
            <Box flexDirection="row">
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="truncate-end" dir="ltr">
                  {(rows[i] ?? []).map(run => (
                    <Text color={run.lane < 0 ? undefined : LANE_COLORS[run.lane % LANE_COLORS.length]}>{run.text}</Text>
                  ))}{' '}
                  {labels(commit.refs).map(ref => (
                    <Text color={REF_COLORS[ref.kind]} weight={ref.kind === 'head' ? 'bold' : undefined}>
                      {ref.name}{' '}
                    </Text>
                  ))}
                  <Text weight={isHead ? 'bold' : undefined} dimColor={commit.parents.length > 1}>
                    {commit.subject}
                  </Text>
                </Text>
              </Box>
              {meta ? (
                <Box flexShrink={0} marginLeft={1}>
                  <Text dimColor dir="ltr">{meta}</Text>
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>
    )
  })
}
