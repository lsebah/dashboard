// ─────────────────────────────────────────────────────────────────────────
//  Résolveur de modules pour `node --test` (npm test).
//
//  Le code applicatif est écrit pour le bundler Next (tsconfig
//  `moduleResolution: "bundler"`) : imports relatifs SANS extension
//  (`./coupons-ledger`), alias `@/…`, et imports JSON sans attribut.
//  Le résolveur ESM de Node, lui, exige l'extension exacte et
//  `with { type: 'json' }` — d'où des tests qui ne démarraient pas :
//
//    Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/lib/lifecycle'
//    TypeError [ERR_IMPORT_ATTRIBUTE_MISSING]: … coupons-ledger.json
//
//  Conséquence : 15 tests (lib/basket.test.ts + lib/coherence.test.ts) ne
//  s'exécutaient jamais — dont ceux couvrant `aggregateBasket`, au cœur du
//  calcul de panier. Ce hook aligne Node sur la résolution du bundler, sans
//  modifier une seule ligne de code applicatif.
// ─────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']

export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  // Alias « @/… » du tsconfig → chemin absolu depuis la racine du projet.
  if (spec.startsWith('@/')) spec = pathToFileURL(resolvePath(ROOT, spec.slice(2))).href

  let url
  try {
    url = new URL(spec, context.parentURL).href
  } catch {
    return nextResolve(specifier, context)
  }

  // Import relatif sans extension → on essaie les extensions du bundler.
  if (url.startsWith('file:') && !/\.[a-z]+$/i.test(url)) {
    for (const ext of EXTENSIONS) {
      if (existsSync(fileURLToPath(url + ext))) {
        url += ext
        break
      }
    }
  }

  // JSON : Node exige l'attribut d'import, que le bundler n'impose pas.
  if (url.endsWith('.json')) {
    return { url, format: 'json', shortCircuit: true, importAttributes: { type: 'json' } }
  }

  return nextResolve(url, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return { format: 'json', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true }
  }
  return nextLoad(url, context)
}
