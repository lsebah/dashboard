// ─────────────────────────────────────────────────────────────────────────
//  Audit hebdomadaire des termsheets.
//
//  POURQUOI CET AUDIT EXISTE — du 20/07 au 19/08/2026, lib/termsheets-index.json
//  est resté figé : les secrets GRAPH_* ayant disparu, la synchro quotidienne
//  se contentait de skipper proprement, run vert à l'appui. Or tous les
//  contrôles de cohérence lisent l'index et jamais le dossier : ils sont donc
//  restés au vert pendant un mois avec cinq termsheets non rattachées dans le
//  dossier. Une alerte qui se tait quand la source se tarit ne vaut rien.
//
//  D'où deux principes ici :
//   • l'audit tourne sur les données VERSIONNÉES — aucun secret, aucun appel
//     réseau — donc il parle même quand tout le reste est muet ;
//   • la fraîcheur de l'index est elle-même une anomalie. Un index qu'on ne
//     peut pas dater est réputé périmé : une fraîcheur non prouvée n'est pas
//     une fraîcheur.
//
//  Les filtres ne sont PAS réimplémentés ici : on importe `computeDataHealth`
//  et `produitsADecoder` de lib/data-health.ts, les mêmes que l'app et l'API.
//  Un audit qui recalcule à sa façon finit par diverger de ce qu'il contrôle.
//
//  Lancement : `npm run audit` (les drapeaux TypeScript sont dans package.json).
//  Sortie : rapport lisible sur stdout, Markdown dans $GITHUB_STEP_SUMMARY,
//  JSON structuré dans data/audit-termsheets.json, et une dernière ligne
//  `AUDIT_ANOMALIES=<n>` que le workflow lit pour ouvrir/fermer son ticket.
//  Le code de sortie est TOUJOURS 0 : un rapport ne doit jamais casser la CI.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { computeDataHealth, produitsADecoder, STATUTS_CLOS, INDEX_PERIME_JOURS } from '../lib/data-health.ts'
import { products } from '../lib/products.ts'

const lignes = []
const out = (s = '') => {
  lignes.push(s)
  console.log(s)
}

let anomalies = 1 // en cas de crash : on signale, on ne se tait pas
let resultat = null

try {
  const sante = computeDataHealth(products)
  const idx = sante.indexTermsheets
  const aDecoder = produitsADecoder(products)
  const sansProduit = sante.termsheetSansProduit
  const sansTS = sante.sansTS.filter((x) => !STATUTS_CLOS.has(x.statut ?? ''))

  out('═'.repeat(66))
  out('  AUDIT DES TERMSHEETS — données versionnées uniquement')
  out('  (aucun secret, aucun appel réseau)')
  out('═'.repeat(66))
  out()
  out(`Périmètre : ${sante.total} produits analysés.`)
  out()

  out(`A. FRAÎCHEUR DE L'INDEX (seuil : ${INDEX_PERIME_JOURS} jours)`)
  if (idx.perime) {
    out(`   ⚠ PÉRIMÉ — dernier alignement le ${idx.syncLe}, soit ${idx.ageJours} jour(s).`)
    out(`   Tant qu'il n'est pas réaligné, les sections B et C ne voient pas le`)
    out(`   dossier : leur silence ne prouve rien.`)
  } else {
    out(`   ✓ À jour — dernier alignement le ${idx.syncLe} (${idx.ageJours} j).`)
  }
  out()

  out(`B. TERMSHEETS SANS PRODUIT — ${sansProduit.length}`)
  out('   Déposées dans le dossier, jamais rattachées à un produit → à décoder.')
  for (const x of sansProduit) out(`   • ${x.isin} — ${x.nom} · ${x.type} · ${x.detail ?? ''}`)
  out()

  out(`C. PRODUITS VIVANTS SANS TERMSHEET — ${sansTS.length}`)
  out('   Position suivie, aucune TS résolvable → document à retrouver/déposer.')
  for (const x of sansTS) out(`   • ${x.isin} — ${x.nom} · ${x.type}`)
  out()

  out(`D. TERMSHEETS NON DÉCODÉES — ${aDecoder.length}`)
  out('   Produit vivant, TS disponible, mécanique incomplète → décodage immédiat.')
  for (const x of aDecoder) out(`   • ${x.isin} — ${x.nom} · ${x.raison}`)
  out()

  anomalies = sansProduit.length + sansTS.length + aDecoder.length + (idx.perime ? 1 : 0)

  out('─'.repeat(66))
  out(
    anomalies === 0
      ? '✓ Aucune anomalie.'
      : `⚠ ${anomalies} anomalie(s) (A : ${idx.perime ? 1 : 0} · B : ${sansProduit.length} · C : ${sansTS.length} · D : ${aDecoder.length}).`,
  )

  resultat = {
    genereLe: new Date().toISOString(),
    index: idx,
    sansProduit: sansProduit.map((x) => ({ isin: x.isin, nom: x.nom, emetteur: x.type })),
    sansTermsheet: sansTS.map((x) => ({ isin: x.isin, nom: x.nom })),
    nonDecodees: aDecoder,
    anomalies,
  }
} catch (err) {
  out(`⚠ AUDIT EN ERREUR — ${err?.message ?? err}`)
  out("L'audit lui-même est en panne : c'est une anomalie, pas un silence.")
  resultat = { genereLe: new Date().toISOString(), erreur: String(err?.message ?? err), anomalies: 1 }
}

try {
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../data/audit-termsheets.json', import.meta.url), JSON.stringify(resultat, null, 2) + '\n')
} catch {
  /* le rapport stdout reste la source : ne jamais échouer sur l'écriture */
}

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Audit des termsheets\n\n\`\`\`\n${lignes.join('\n')}\n\`\`\`\n`)
  } catch {
    /* idem */
  }
}

console.log(`AUDIT_ANOMALIES=${anomalies}`)
