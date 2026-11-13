import { expect, test } from 'claude-code/testing'
import { fuzzyAt, rankFound } from '../hooks/find'

const rank = (rels: string[], query: string, cased = false) => rankFound(rels.map(r => `/r/${r}`), rels, query, cased, 50).map(f => f.rel)

test('fuzzy matching takes the letters in order, apart or together', () => {
  expect(fuzzyAt('grts', 'graph.ts')).toEqual([0, 1, 6, 7])
  expect(fuzzyAt('tsg', 'graph.ts')).toBe(null)
})

test('names rank before paths: exact, prefix, inside, scattered, then the path, shorter first', () => {
  expect(rank(['hooks/graph.ts', 'tests/graph.test.tsx', 'hooks/register.tsx', 'docs/graph.md', 'graph/x.md'], 'grts')).toEqual(['hooks/graph.ts', 'hooks/register.tsx', 'tests/graph.test.tsx'])
  expect(rank(['src/tree.ts', 'docs/tree.md', 'hooks/treemap.ts', 'tree.ts', 'a/subtree.ts'], 'tree.ts')).toEqual(['tree.ts', 'src/tree.ts', 'a/subtree.ts', 'hooks/treemap.ts'])
  expect(rank(['hooks/a.ts', 'src/hooks.ts', 'tests/b.ts'], 'hooks/')).toEqual(['hooks/a.ts'])
})

test('case is ignored unless asked, and spaces in the query are skipped', () => {
  expect(rank(['readme.txt', 'README.md'], 'readme')).toEqual(['README.md', 'readme.txt'])
  expect(rank(['README.md', 'readme.txt'], 'README', true)).toEqual(['README.md'])
  expect(rank(['hooks/register.tsx'], 'reg tsx')).toEqual(['hooks/register.tsx'])
})

test('the matched letters are positions in the relative path', () => {
  expect(rankFound(['/r/hooks/graph.ts'], ['hooks/graph.ts'], 'grts', false, 5)[0]?.at).toEqual([6, 7, 12, 13])
  expect(rankFound(['/r/a/b.ts'], ['a/b.ts'], 'a/b', false, 5)[0]?.at).toEqual([0, 1, 2])
})
