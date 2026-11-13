export type Found = { path: string; rel: string; at: number[] }

export function fuzzyAt(query: string, text: string, from = 0): number[] | null {
  const at: number[] = []
  let j = from
  for (const ch of query) {
    j = text.indexOf(ch, j)
    if (j < 0) return null
    at.push(j++)
  }
  return at
}

const range = (start: number, length: number) => Array.from({ length }, (_, i) => start + i)

function score(q: string, rel: string): { tier: number; spread: number; at: number[] } | null {
  const cut = rel.lastIndexOf('/') + 1
  const name = rel.slice(cut)
  if (!q.includes('/')) {
    if (name === q) return { tier: 0, spread: 0, at: range(cut, q.length) }
    if (name.startsWith(q)) return { tier: 1, spread: 0, at: range(cut, q.length) }
    const sub = name.indexOf(q)
    if (sub >= 0) return { tier: 2, spread: 0, at: range(cut + sub, q.length) }
    const loose = fuzzyAt(q, name)
    if (loose) return { tier: 3, spread: (loose.at(-1) ?? 0) - (loose[0] ?? 0), at: loose.map(i => i + cut) }
  }
  const sub = rel.indexOf(q)
  if (sub >= 0) return { tier: 4, spread: 0, at: range(sub, q.length) }
  const loose = fuzzyAt(q, rel)
  return loose ? { tier: 5, spread: (loose.at(-1) ?? 0) - (loose[0] ?? 0), at: loose } : null
}

export function rankFound(paths: readonly string[], rels: readonly string[], query: string, cased: boolean, limit: number): Found[] {
  const q = (cased ? query : query.toLowerCase()).replace(/\s+/g, '')
  if (!q) return []
  const hits: (Found & { tier: number; spread: number })[] = []
  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i] ?? ''
    const s = score(q, cased ? rel : rel.toLowerCase())
    if (s) hits.push({ path: paths[i] ?? '', rel, ...s })
  }
  hits.sort((a, b) => a.tier - b.tier || a.spread - b.spread || a.rel.length - b.rel.length || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  return hits.slice(0, limit).map(({ path, rel, at }) => ({ path, rel, at }))
}
