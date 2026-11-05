import type { Commit, Ref, RefKind } from '../types'

export type Run = { text: string; lane: number }

type Lane = { hash: string; color: number } | null
type Cell = { ch: string; color: number }

const BLANK: Cell = { ch: ' ', color: -1 }
const REF_PREFIXES: [string, RefKind][] = [
  ['HEAD -> refs/heads/', 'head'],
  ['refs/heads/', 'local'],
  ['refs/remotes/', 'remote'],
  ['tag: refs/tags/', 'tag'],
]

// git refuses NUL in a commit and keeps newlines out of %an and %s, so no author or subject can split a field or a commit.
export const LOG_FORMAT = '%H%x00%P%x00%D%x00%an%x00%ad%x00%s'

export function parseLog(stdout: string): Commit[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash = '', parents = '', decorations = '', author = '', date = '', subject = ''] = line.split('\0')
      const [day = '', time = ''] = date.split(' ')
      return {
        hash,
        parents: parents.split(' ').filter(Boolean),
        refs: parseRefs(decorations),
        author: printable(author),
        day,
        time,
        subject: printable(subject),
      }
    })
}

// One control character in a commit, such as colour codes pasted from a terminal, makes the engine refuse the whole pane.
export function printable(text: string): string {
  return text.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
}

function parseRefs(text: string): Ref[] {
  return text
    .split(', ')
    .filter(Boolean)
    .flatMap((part): Ref[] => {
      if (part === 'HEAD') return [{ name: 'HEAD', kind: 'head' }]
      const match = REF_PREFIXES.find(([prefix]) => part.startsWith(prefix))
      if (!match) return []
      const [prefix, kind] = match
      const name = printable(part.slice(prefix.length))
      // A remote's HEAD only points at its default branch, which carries its own label.
      if (kind === 'remote' && /^[^/]+\/HEAD$/.test(name)) return []
      return [{ name, kind }]
    })
}

// A local branch and its remote twin on the same commit share one label: "origin & main".
export function labels(refs: readonly Ref[]): Ref[] {
  const isLocal = (ref: Ref) => ref.kind === 'head' || ref.kind === 'local'
  const branchOf = (ref: Ref) => ref.name.slice(ref.name.indexOf('/') + 1)
  const locals = new Set(refs.filter(isLocal).map(ref => ref.name))
  const twins = refs.filter(ref => ref.kind === 'remote' && locals.has(branchOf(ref)))

  return refs.flatMap(ref => {
    if (twins.includes(ref)) return []
    if (!isLocal(ref)) return [ref]
    const remotes = twins.filter(twin => branchOf(twin) === ref.name).map(twin => twin.name.split('/')[0])
    return [{ ...ref, name: [...remotes, ref.name].join(' & ') }]
  })
}

// shortcut: lanes freed mid-graph leave a gap instead of shifting the lanes to their right left; add compaction if wide histories get unreadable.
export function graphRows(commits: readonly Pick<Commit, 'hash' | 'parents'>[]): Run[][] {
  const lanes: Lane[] = []
  let nextColor = 0

  return commits.map(commit => {
    let col = lanes.findIndex(lane => lane?.hash === commit.hash)
    if (col < 0) {
      col = firstFree(lanes, 0, [])
      lanes[col] = { hash: commit.hash, color: nextColor++ }
    }
    const color = lanes[col]?.color ?? 0
    const cells: Cell[] = lanes.map(lane => (lane ? { ch: '│', color: lane.color } : BLANK))
    cells[col] = { ch: '●', color }
    const ends: number[] = []

    lanes.forEach((lane, i) => {
      if (i === col || !lane || lane.hash !== commit.hash) return
      cells[i] = { ch: i > col ? '╯' : '╰', color: lane.color }
      lanes[i] = null
      ends.push(i)
    })

    const [first, ...others] = commit.parents
    lanes[col] = first ? { hash: first, color } : null
    for (const parent of others) {
      const k = firstFree(lanes, col + 1, cells)
      lanes[k] = { hash: parent, color: nextColor }
      cells[k] = { ch: '╮', color: nextColor++ }
      ends.push(k)
    }
    while (lanes.length > 0 && !lanes[lanes.length - 1]) lanes.pop()

    return toRuns(connect(cells, col, ends))
  })
}

function firstFree(lanes: readonly Lane[], from: number, cells: readonly Cell[]): number {
  for (let i = from; i < lanes.length; i++) if (!lanes[i] && (cells[i] ?? BLANK) === BLANK) return i
  return Math.max(lanes.length, cells.length, from)
}

function connect(cells: Cell[], col: number, ends: readonly number[]): Cell[] {
  const chars = Array.from({ length: cells.length * 2 }, (_, p) => (p % 2 === 0 ? (cells[p / 2] ?? BLANK) : BLANK))

  for (const end of ends) {
    const color = cells[end]?.color ?? -1
    const [from, to] = end > col ? [col, end] : [end, col]
    for (let p = from * 2 + 1; p < to * 2; p++) {
      const ch = chars[p]?.ch ?? ' '
      if (ch === '│') continue
      chars[p] = { ch: crossed(ch), color: ch === ' ' || ch === '─' ? color : (chars[p]?.color ?? color) }
    }
  }
  while (chars.length > 0 && chars[chars.length - 1]?.ch === ' ') chars.pop()

  return chars
}

function crossed(ch: string): string {
  if (ch === '╯' || ch === '╰') return '┴'
  if (ch === '╮' || ch === '╭') return '┬'
  if (ch === ' ') return '─'
  return ch
}

function toRuns(chars: readonly Cell[]): Run[] {
  const runs: Run[] = []
  for (const { ch, color } of chars) {
    const last = runs[runs.length - 1]
    if (last && last.lane === color) last.text += ch
    else runs.push({ text: ch, lane: color })
  }
  return runs
}
