import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import { SECTIONS, estActif, sectionActive, routesNav } from './lifecycle-nav'

// ─────────────────────────────────────────────────────────────────────────
//  Une page livrée sans entrée de menu n'existe pas pour celui qui l'utilise :
//  elle ne se trouve qu'en tapant l'URL. Ce test lit les pages RÉELLES du
//  dossier app/lifecycle2 et refuse qu'une seule reste hors navigation — le
//  jour où quelqu'un ajoute un onglet et oublie le menu, il échoue.
// ─────────────────────────────────────────────────────────────────────────

const RACINE = new URL('../app/lifecycle2/', import.meta.url)

/** Routes réellement servies par l'app (un dossier + page.tsx = une page). */
function routesReelles(): string[] {
  const out: string[] = []
  if (existsSync(new URL('page.tsx', RACINE))) out.push('/lifecycle2')
  for (const e of readdirSync(RACINE, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'components') continue
    if (existsSync(new URL(`${e.name}/page.tsx`, RACINE))) out.push(`/lifecycle2/${e.name}`)
  }
  return out.sort()
}

test('aucune page de Lifecycle n’est orpheline de la navigation', () => {
  const dansLaNav = new Set(routesNav())
  const manquantes = routesReelles().filter((r) => !dansLaNav.has(r))
  assert.deepEqual(manquantes, [], `pages sans entrée de menu : ${manquantes.join(', ')}`)
})

test('la navigation ne pointe vers aucune page inexistante', () => {
  const reelles = new Set(routesReelles())
  const mortes = routesNav().filter((r) => !reelles.has(r))
  assert.deepEqual(mortes, [], `entrées de menu sans page : ${mortes.join(', ')}`)
})

test('la Synthèse n’est active que sur la racine', () => {
  // `startsWith` la rendrait active partout : c'est le piège classique.
  assert.equal(estActif('/lifecycle2', '/lifecycle2'), true)
  assert.equal(estActif('/lifecycle2', '/lifecycle2/portefeuille'), false)
  assert.equal(estActif('/lifecycle2/portefeuille', '/lifecycle2/portefeuille'), true)
})

test('un lien externe n’est jamais « actif »', () => {
  assert.equal(estActif('https://cmf-extranet.com/dashboard/risk-analytics', '/lifecycle2'), false)
})

test('chaque page ouvre la section qui la contient', () => {
  assert.equal(sectionActive('/lifecycle2').cle, 'cmf')
  assert.equal(sectionActive('/lifecycle2/commissions').cle, 'cmf')
  assert.equal(sectionActive('/lifecycle2/volatilite').cle, 'runs')
  assert.equal(sectionActive('/lifecycle2/frn').cle, 'runs')
  assert.equal(sectionActive('/lifecycle2/maintenance').cle, 'outils')
  // Une URL inconnue retombe sur CMF plutôt que sur une barre vide.
  assert.equal(sectionActive('/lifecycle2/inconnu').cle, 'cmf')
})

test('aucun onglet n’apparaît dans deux sections', () => {
  const vus = new Set<string>()
  for (const s of SECTIONS)
    for (const o of s.onglets) {
      assert.equal(vus.has(o.href), false, `${o.href} figure deux fois`)
      vus.add(o.href)
    }
})
