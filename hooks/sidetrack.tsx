import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Graph, RefKind } from '../types'
import { graphRows, labels, LOG_FORMAT, parseLog } from './graph'

const PANE = 'sidetrack'
const TITLE = 'Sidetrack'
const LIMIT = 250
const POLL_MS = 3000
const FILETREE_PANE = 'filetree'
const START_FALLBACK_MS = 2500

const LANE_COLORS = ['#4c9ee8', '#e8a33d', '#5fb760', '#c96fd8', '#e0605a', '#3fbfb0', '#d8c14a', '#8b8fea']
const REF_COLORS: Record<RefKind, string> = { head: '#e5c07b', local: '#73c991', remote: '#b38ee0', tag: '#7fb4ca' }

const graph = atom({ plugin: 'sidetrack', key: 'graph' } as const, { branch: '', today: '', commits: [] } as Graph, {
  shape: 'graph-1',
})

let lastOutput = ''
let isOpenedAtStart = false

// No `focus`: at start the pane must not take the keys or another mod's front tab.
async function openOnce($: EngineInterface) {
  if (isOpenedAtStart) return
  isOpenedAtStart = true
  await $.ui.open({ id: PANE, title: TITLE })
  await refresh($, true)
}

async function paneOf($: EngineInterface) {
  return (await $.ui.panes()).find(pane => pane.id === PANE)
}

async function refresh($: EngineInterface, force = false) {
  if (!force && !(await paneOf($))?.isShown) return

  const [log, today] = await Promise.all([
    $.process.run([
      'git',
      'log',
      '--branches',
      '--remotes',
      '--tags',
      'HEAD',
      '--date-order',
      '--decorate=full',
      `-n${LIMIT}`,
      '--date=format-local:%d/%m/%y %H:%M',
      `--format=${LOG_FORMAT}`,
    ]),
    $.process.run(['date', '+%d/%m/%y']),
  ])
  const output = `${log.exitCode}\n${log.stdout}${log.stderr}${today.stdout}`
  if (!force && output === lastOutput) return
  lastOutput = output

  if (log.exitCode !== 0) {
    const error = log.stderr.trim().split('\n')[0] || `git log: exit ${log.exitCode}`
    await update($, graph, () => ({ branch: '', today: '', commits: [], error }))
    return
  }
  const commits = parseLog(log.stdout)
  const branch = commits.flatMap(commit => commit.refs).find(ref => ref.kind === 'head')?.name ?? 'HEAD'
  await update($, graph, () => ({ branch, today: today.stdout.trim(), commits }))
}

export const register: Register = (on, options) => {
  const openAtStart = options?.openAtStart !== 'off'

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sidetrack', description: 'Show or hide the git graph pane' })
    $.clock.every(POLL_MS, () => void refresh($).catch(() => {}))
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
    const { Box, Text } = $.ui.resolve(e)
    const { branch, today, commits, error } = await read($, graph)
    const width = e.props.bodyColumns

    if (error) return <Text dimColor>{error}</Text>
    if (commits.length === 0) return <Text dimColor>Loading git log…</Text>

    const rows = graphRows(commits)
    const showAuthor = width >= 64
    const showDate = width >= 40

    return (
      <Box flexDirection="column">
        <Text color={REF_COLORS.head} weight="bold" wrap="truncate-end">
          ⎇ {branch}
        </Text>
        {commits.map((commit, i) => {
          const isHead = commit.refs.some(ref => ref.kind === 'head')
          const when = commit.day === today ? commit.time : commit.day
          const meta = [showAuthor ? commit.author.slice(0, 14).padEnd(14) : '', showDate ? when.padStart(8) : '']
            .filter(Boolean)
            .join(' ')

          return (
            <Box flexDirection="row">
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="truncate-end">
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
                  <Text dimColor>{meta}</Text>
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>
    )
  })
}
