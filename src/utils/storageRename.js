// One-time move of this device's saved settings and drafts from the old "poso-" / "poso:" keys
// (before the rename to Zadatak) to the new ones. Imported first in main.jsx, so it runs before
// any module reads localStorage. Safe to run every start: once moved, there is nothing left to move.
try {
  const ls = window.localStorage
  for (const key of Object.keys(ls)) {
    const match = /^poso([-:])(.*)$/.exec(key)
    if (!match) continue
    const next = `zadatak${match[1]}${match[2]}`
    if (ls.getItem(next) === null) ls.setItem(next, ls.getItem(key))
    ls.removeItem(key)
  }
} catch { /* storage blocked (private mode) — nothing to move */ }
