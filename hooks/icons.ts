import type { FileNode } from '../types'

const cp = (n: number) => String.fromCodePoint(n)

export const CHEVRON_OPEN = '▾'
export const CHEVRON_CLOSED = '▸'

export const BRAIN = { nerd: cp(0xf09d1), plain: '§' }
export const GUARD = { nerd: cp(0xea76), plain: '×' }
export const FILE_PLAIN = '•'

const MEMORY = new Set(['agents.md', 'claude.md', 'agents.local.md', 'claude.local.md'])

export function isMemory(n: FileNode): boolean {
  if (n.kind !== 'file') return false
  const lower = n.name.toLowerCase()
  return MEMORY.has(lower) || (lower.endsWith('.md') && n.id.replace(/\\/g, '/').includes('/.claude/rules/'))
}

export type Hue = 'blue' | 'cyan' | 'yellow' | 'green' | 'orange' | 'red' | 'purple' | 'pink' | 'slate' | 'grey'

export const HUES: Record<'dark' | 'light' | 'desk', Record<Hue, string>> = {
  dark: { blue: '#6cb0ff', cyan: '#5cd3d9', yellow: '#e8c55a', green: '#8fd16f', orange: '#f2a65a', red: '#f07878', purple: '#c49cf5', pink: '#f28fc6', slate: '#9fb3c8', grey: '#8b949e' },
  light: { blue: '#2563c9', cyan: '#0e7c86', yellow: '#8f6a00', green: '#2f7d32', orange: '#b45309', red: '#c2352b', purple: '#7445c7', pink: '#b4307a', slate: '#4b6380', grey: '#6b7280' },
  desk: { blue: '#4487e4', cyan: '#1294a5', yellow: '#ad7f00', green: '#339a3c', orange: '#d66718', red: '#e15b53', purple: '#9b6dea', pink: '#d559a2', slate: '#7488a3', grey: '#828790' },
}

export const TAG_INK = '#000000'

type Kind = readonly [glyph: number, hue: Hue, tag?: string]

const MARKDOWN: Kind = [0xf0354, 'slate', 'MD']
const LOCK: Kind = [0xf033e, 'grey']
const ENV: Kind = [0xf0306, 'yellow', 'ENV']
const DOCKER: Kind = [0xf0868, 'blue', 'DKR']
const MAKE: Kind = [0xf1064, 'orange', 'MK']
const GIT: Kind = [0xf02a2, 'orange', 'GIT']
const CONFIG: Kind = [0xf0493, 'grey', 'CFG']

const NAMED: Record<string, Kind> = {
  'changelog.md': MARKDOWN,
  'contributing.md': MARKDOWN,
  'todo.md': MARKDOWN,
  'readme.md': MARKDOWN,
  license: [0xe60a, 'yellow'],
  'license.md': [0xe60a, 'yellow'],
  'license.txt': [0xe60a, 'yellow'],
  copying: [0xe60a, 'yellow'],
  dockerfile: DOCKER,
  containerfile: DOCKER,
  '.dockerignore': DOCKER,
  'docker-compose.yml': DOCKER,
  'docker-compose.yaml': DOCKER,
  'compose.yml': DOCKER,
  'compose.yaml': DOCKER,
  makefile: MAKE,
  'cmakelists.txt': MAKE,
  justfile: [0xf05b7, 'orange', 'JST'],
  gemfile: [0xf0d2d, 'red', 'RB'],
  rakefile: [0xf0d2d, 'red', 'RB'],
  'cargo.toml': [0xe6b2, 'orange', 'RS'],
  'pyproject.toml': [0xe606, 'yellow', 'PY'],
  'requirements.txt': [0xf160e, 'yellow', 'PY'],
  'go.mod': [0xf0afa, 'cyan', 'GO'],
  'go.sum': LOCK,
  'package.json': [0xf0626, 'red', 'NPM'],
  'tsconfig.json': [0xe69d, 'blue', 'TS'],
  '.prettierrc': CONFIG,
  '.eslintrc': CONFIG,
  '.editorconfig': CONFIG,
  'cargo.lock': LOCK,
  'package-lock.json': LOCK,
  'pnpm-lock.yaml': LOCK,
  'yarn.lock': LOCK,
  'bun.lock': LOCK,
  'bun.lockb': LOCK,
  'uv.lock': LOCK,
  'poetry.lock': LOCK,
  '.gitignore': GIT,
  '.gitattributes': GIT,
  '.gitmodules': GIT,
  '.env': ENV,
}

const kinds = (glyph: number, hue: Hue, tag: string | undefined, exts: string): [string, Kind][] => exts.split(' ').map(ext => [ext, tag ? [glyph, hue, tag] : [glyph, hue]])

const TYPES: Record<string, Kind> = Object.fromEntries([
  ...kinds(0xe628, 'blue', 'TS', 'ts mts cts'),
  ...kinds(0xe7ba, 'cyan', 'TSX', 'tsx'),
  ...kinds(0xe60c, 'yellow', 'JS', 'js mjs cjs'),
  ...kinds(0xe625, 'cyan', 'JSX', 'jsx'),
  ...kinds(0xe60b, 'yellow', '{}', 'json jsonc json5'),
  ...kinds(0xf0354, 'slate', 'MD', 'md markdown mdx'),
  ...kinds(0xe606, 'yellow', 'PY', 'py pyi'),
  ...kinds(0xe68b, 'orange', 'RS', 'rs'),
  ...kinds(0xe627, 'cyan', 'GO', 'go'),
  ...kinds(0xe791, 'red', 'RB', 'rb'),
  ...kinds(0xe608, 'purple', 'PHP', 'php'),
  ...kinds(0xe738, 'red', 'JV', 'java'),
  ...kinds(0xe634, 'purple', 'KT', 'kt kts'),
  ...kinds(0xe699, 'orange', 'SW', 'swift'),
  ...kinds(0xe64c, 'blue', 'DT', 'dart'),
  ...kinds(0xe61e, 'blue', 'C', 'c'),
  ...kinds(0xe61d, 'blue', 'C++', 'cpp cc cxx'),
  ...kinds(0xf0af5, 'purple', 'H', 'h hpp hh'),
  ...kinds(0xf031b, 'purple', 'C#', 'cs'),
  ...kinds(0xe6a9, 'orange', 'ZIG', 'zig'),
  ...kinds(0xf1105, 'blue', 'NIX', 'nix'),
  ...kinds(0xe69a, 'purple', 'TF', 'tf tfvars hcl'),
  ...kinds(0xe62d, 'purple', 'EX', 'ex exs'),
  ...kinds(0xe61f, 'purple', 'HS', 'hs'),
  ...kinds(0xe68e, 'red', 'SC', 'scala'),
  ...kinds(0xe68a, 'blue', 'R', 'r'),
  ...kinds(0xe624, 'purple', 'JL', 'jl'),
  ...kinds(0xe620, 'blue', 'LUA', 'lua'),
  ...kinds(0xe795, 'green', '>_', 'sh bash zsh fish'),
  ...kinds(0xf0a0a, 'blue', 'PS', 'ps1 psm1'),
  ...kinds(0xe736, 'orange', '<>', 'html htm'),
  ...kinds(0xe6b8, 'blue', 'CSS', 'css'),
  ...kinds(0xf031c, 'pink', 'SC', 'scss sass'),
  ...kinds(0xe6a0, 'green', 'VUE', 'vue'),
  ...kinds(0xe697, 'orange', 'SV', 'svelte'),
  ...kinds(0xf375, 'green', 'QML', 'qml'),
  ...kinds(0xf20e, 'pink', 'GQL', 'graphql gql'),
  ...kinds(0xf05c0, 'orange', 'XML', 'xml'),
  ...kinds(0xe6a8, 'pink', 'YML', 'yaml yml'),
  ...kinds(0xe6b2, 'grey', 'TML', 'toml'),
  ...kinds(0xf0bc2, 'grey', 'INI', 'ini cfg'),
  ...kinds(0xf0493, 'grey', 'CFG', 'conf'),
  ...kinds(0xf0306, 'yellow', 'ENV', 'env'),
  ...kinds(0xe706, 'pink', 'SQL', 'sql'),
  ...kinds(0xf01bc, 'pink', 'DB', 'db sqlite sqlite3'),
  ...kinds(0xe64a, 'green', 'CSV', 'csv tsv'),
  ...kinds(0xf021b, 'green', 'XLS', 'xls xlsx ods'),
  ...kinds(0xf022c, 'blue', 'DOC', 'doc docx odt rtf'),
  ...kinds(0xf0227, 'orange', 'PPT', 'ppt pptx odp'),
  ...kinds(0xeaeb, 'red', 'PDF', 'pdf'),
  ...kinds(0xf0721, 'orange', 'SVG', 'svg'),
  ...kinds(0xe60d, 'purple', 'IMG', 'png jpg jpeg webp bmp ico avif heic'),
  ...kinds(0xf0d78, 'purple', 'GIF', 'gif'),
  ...kinds(0xf022b, 'pink', 'VID', 'mp4 mkv mov webm avi'),
  ...kinds(0xf0223, 'pink', 'AUD', 'mp3 wav flac ogg m4a'),
  ...kinds(0xf05c4, 'grey', 'ZIP', 'zip gz xz tar tgz bz2 7z rar'),
  ...kinds(0xe6a1, 'purple', 'WSM', 'wasm'),
  ...kinds(0xe659, 'grey', undefined, 'ttf otf woff woff2'),
  ...kinds(0xf033e, 'grey', undefined, 'lock'),
  ...kinds(0xf09aa, 'grey', undefined, 'txt log'),
])

function fileKind(n: FileNode): Kind | undefined {
  if (n.kind !== 'file') return undefined
  const lower = n.name.toLowerCase()
  const named = NAMED[lower] ?? (lower.startsWith('.env.') ? ENV : undefined)
  if (named) return named
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? TYPES[lower.slice(dot + 1)] : undefined
}

export function fileHue(n: FileNode): Hue | undefined {
  return isMemory(n) ? 'pink' : fileKind(n)?.[1]
}

export function fileTag(n: FileNode): string | undefined {
  return isMemory(n) ? undefined : fileKind(n)?.[2]
}

export type Emblem = 'docs' | 'tests' | 'media' | 'tools' | 'config' | 'github' | 'git' | 'npm'

const FOLDERS: Record<string, readonly [glyph: number, emblem: Emblem]> = Object.fromEntries(([
  [0xf0c82, 'docs', 'docs doc documentation'],
  [0xf197e, 'tests', 'test tests __tests__ spec specs e2e'],
  [0xf024f, 'media', 'media assets images img icons public static'],
  [0xf19fc, 'tools', 'scripts bin tools .githooks .husky'],
  [0xf107f, 'config', '.claude .config config .vscode .idea'],
  [0xe5fd, 'github', '.github'],
  [0xe5fb, 'git', '.git'],
  [0xe5fa, 'npm', 'node_modules'],
] as const).flatMap(([glyph, emblem, names]) => names.split(' ').map(name => [name, [glyph, emblem] as const])))

export function folderEmblem(n: FileNode): Emblem | undefined {
  return n.kind === 'dir' ? FOLDERS[n.name.toLowerCase()]?.[1] : undefined
}

export function fileIcon(n: FileNode, open: boolean, isRepo: boolean): string {
  if (n.kind === 'link') return cp(0xf481)
  if (n.kind === 'dir') return cp(isRepo ? 0xf02a2 : (FOLDERS[n.name.toLowerCase()]?.[0] ?? (open ? 0xe5fe : 0xe5ff)))
  if (isMemory(n)) return BRAIN.nerd
  return cp(fileKind(n)?.[0] ?? 0xf0214)
}

export const GIT_COLOR: Record<string, string> = {
  A: 'ansi256(2)',
  '?': 'ansi256(2)',
  R: 'ansi256(4)',
  C: 'ansi256(4)',
  M: 'ansi256(3)',
  T: 'ansi256(3)',
}

const PRIORITY = ['U', 'D', 'M', 'T', 'R', 'C', 'A', '?']

export function stronger(a: string | undefined, b: string): string {
  if (!a) return b
  return PRIORITY.indexOf(b) < PRIORITY.indexOf(a) ? b : a
}
