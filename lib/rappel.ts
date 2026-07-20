// ─────────────────────────────────────────────────────────────────────────
//  Notification de rappel (autocall déclenché) — construit le message envoyé à
//  L.sebah@cmf.finance : ISIN, payoff (caractéristiques + mécanique), client(s).
//  Fonctions PURES → réutilisées par le cron (détection quotidienne) et par
//  l'endpoint appelé au clic « Marquer rappelé ». Aucune valeur inventée : on
//  ne fait que reformuler les termes décodés du produit.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'

/** Résumé « payoff » lisible d'un produit (termes décodés, rien d'inventé). */
export function resumePayoff(product: Product): string {
  const p = product
  const l: string[] = []
  l.push(`Produit : ${p.nom}`)
  if (p.emetteur) l.push(`Émetteur : ${p.emetteur}${p.garant ? ` (garant ${p.garant})` : ''}`)
  if (p.productType) l.push(`Type : ${p.productType}`)
  const sj = (p.sousJacents ?? []).map((u) => u.nom).filter(Boolean)
  if (sj.length) l.push(`Sous-jacents : ${sj.join(', ')} (${p.basket})`)
  l.push(
    `Nominal : ${p.nominal.toLocaleString('fr-FR')} ${p.devise}` +
      (p.dateEmission ? ` · émis le ${p.dateEmission}` : '') +
      (p.dateEcheance ? ` · échéance ${p.dateEcheance}` : ''),
  )
  const t = p.terms
  if (t?.kind === 'autocall') {
    if (typeof t.couponPa === 'number') l.push(`Coupon p.a. : ${t.couponPa} %${t.effetMemoire ? ' (effet mémoire)' : ''}`)
    if (typeof t.barriereCouponPct === 'number') l.push(`Barrière coupon : ${t.barriereCouponPct} %`)
    if (typeof t.barriereRappelPct === 'number')
      l.push(`Barrière de rappel : ${t.barriereRappelPct} %${t.degressif ? ' (dégressive)' : ''}`)
    if (typeof t.protectionPct === 'number')
      l.push(`Protection : ${t.protectionPct} % KI ${t.protectionStyle === 'europeenne' ? 'européenne' : 'américaine'}${t.airbag ? ' · airbag' : ''}`)
  }
  if (p.description) l.push(`Description : ${p.description}`)
  return l.join('\n')
}

/** Sujet + corps de l'email de rappel. */
export function messageRappel(product: Product): { subject: string; text: string } {
  const clients = (product.clients ?? []).join(', ') || '—'
  return {
    subject: `CMF | Rappel autocall — ${product.isin} (${clients})`,
    text:
      `Un produit a été rappelé (autocall déclenché).\n\n` +
      `ISIN : ${product.isin}\n` +
      `Client(s) : ${clients}\n\n` +
      `${resumePayoff(product)}\n\n` +
      `— Notification automatique CMF`,
  }
}
