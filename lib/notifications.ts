// ─────────────────────────────────────────────────────────────────────────
//  Notifications dérivées de l'état des produits : rappels (autocall / called),
//  maturités (atteintes ou proches), coupons payés, et trous de données.
//  Fonction pure → réutilisée par le centre de notifications, le badge de
//  navigation et l'envoi d'email. Les IDs sont STABLES (dédup garantie).
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { rappelConstate, suiviCoupons, formatDateFr } from './lifecycle'
import { productTypeLabel } from './classification'
import { computeDataHealth } from './data-health'

export type NotifType = 'rappel' | 'maturite' | 'maturite_proche' | 'coupon' | 'donnees'

export interface Notif {
  id: string // stable : `${type}:${isin}:${dateKey}`
  type: NotifType
  isin: string
  nom: string
  type_produit: string
  client?: string
  date: string // ISO de l'événement
  niveauPct?: number // niveau de rappel
  couponPct?: number // coupon versé
  montantPct?: number // montant remboursé (% nominal)
  sousJacents?: string
  statut?: string
  detail?: string
  lien: string // lien vers la fiche / page concernée
}

const JOUR = 86_400_000
const clientOf = (p: Product): string | undefined =>
  p.clients?.join(', ') || p.allocations?.map((a) => a.client).join(', ') || undefined
const sousJacentsOf = (p: Product): string | undefined =>
  p.sousJacents?.map((u) => u.nom || u.bloomberg || '').filter(Boolean).join(', ') || undefined
const ficheLien = (isin: string) => `/lifecycle?isin=${encodeURIComponent(isin)}`

/**
 * Dérive la liste des notifications à partir des produits + de la date du jour.
 * `windowJours` borne les coupons payés récents (par défaut 90 j) pour éviter
 * d'inonder l'historique.
 */
export function deriveNotifications(products: Product[], now: Date = new Date(), windowJours = 90): Notif[] {
  const out: Notif[] = []
  const today = now.toISOString().slice(0, 10)
  const tMs = now.getTime()

  for (const p of products) {
    const type_produit = productTypeLabel(p)
    const base = { isin: p.isin, nom: p.nom, type_produit, client: clientOf(p), sousJacents: sousJacentsOf(p) }

    // ── Rappel (autocall déclenché / statut rappelé) ──
    const r = rappelConstate(p)
    if (p.statut === 'rappele' || r) {
      const obs = r ? (p.observations ?? []).find((o) => o.n === r.n) : undefined
      // Date de rappel : observation déclenchée si dérivable, sinon dernière
      // observation passée, sinon émission — JAMAIS l'échéance future.
      const lastPast = (p.observations ?? [])
        .map((o) => o.dateObservation)
        .filter((d): d is string => !!d && d <= today)
        .sort()
        .pop()
      const date = r?.date ?? lastPast ?? p.dateEmission ?? p.dateEcheance
      out.push({
        ...base,
        id: `rappel:${p.isin}:${date}`,
        type: 'rappel',
        date,
        niveauPct: r?.niveauPct,
        montantPct: obs?.montantRemboursementPct,
        couponPct: obs?.couponPct,
        statut: 'Rappelé',
        lien: ficheLien(p.isin),
      })
    }

    // ── Maturité (atteinte / proche) — hors produits déjà rappelés ou vendus ──
    if (p.statut !== 'rappele' && p.statut !== 'vendu' && p.dateEcheance) {
      const ech = new Date(p.dateEcheance).getTime()
      if (!Number.isNaN(ech)) {
        const jours = Math.round((ech - tMs) / JOUR)
        if (p.dateEcheance <= today) {
          out.push({ ...base, id: `maturite:${p.isin}:${p.dateEcheance}`, type: 'maturite', date: p.dateEcheance, statut: 'Échéance atteinte', lien: ficheLien(p.isin) })
        } else if (jours <= 30) {
          out.push({ ...base, id: `maturite_proche:${p.isin}:${p.dateEcheance}`, type: 'maturite_proche', date: p.dateEcheance, statut: `Maturité dans ${jours} j`, lien: ficheLien(p.isin) })
        }
      }
    }

    // ── Coupons payés récents (fenêtre glissante) ──
    for (const l of suiviCoupons(p, now)) {
      if (l.statut !== 'paye' && l.statut !== 'rattrape') continue
      const d = l.datePaiement ?? l.date
      const ms = new Date(d).getTime()
      if (Number.isNaN(ms) || tMs - ms > windowJours * JOUR || ms > tMs) continue
      out.push({ ...base, id: `coupon:${p.isin}:${d}`, type: 'coupon', date: d, couponPct: l.couponPct, statut: 'Coupon payé', lien: ficheLien(p.isin) })
    }
  }

  // ── Trous de données : une notification de synthèse par catégorie ──
  const h = computeDataHealth(products)
  const dateKey = today
  const sante = (type_label: string, n: number, detail: string) => {
    if (n === 0) return
    out.push({
      id: `donnees:${type_label}:${dateKey}`,
      type: 'donnees',
      isin: '—',
      nom: `${n} produit(s) — ${detail}`,
      type_produit: 'Données',
      date: now.toISOString().slice(0, 10),
      statut: 'À compléter',
      detail,
      lien: '/lifecycle/sante',
    })
  }
  sante('coupon', h.sansCoupon.length, 'coupon manquant (à décoder)')
  sante('ts', h.sansTS.length, 'termsheet absente')
  sante('airbag', h.airbagSansNiveau.length, "niveau d'airbag non décodé")
  sante('devise', h.deviseSuspecte.length, 'devise incohérente')

  // Tri antéchronologique (plus récent en tête).
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

const TYPE_LABEL: Record<NotifType, string> = {
  rappel: 'Rappel produit',
  maturite: 'Maturité',
  maturite_proche: 'Maturité proche',
  coupon: 'Coupon payé',
  donnees: 'Données',
}
export const notifTypeLabel = (t: NotifType): string => TYPE_LABEL[t]

/** Objet + corps de l'email de rappel produit (destiné à L.sebah@cmf.finance). */
export function rappelEmail(n: Notif): { subject: string; body: string } {
  const L = (k: string, v?: string | number) => (v != null && v !== '' ? `${k} : ${v}` : null)
  const body = [
    'Notification automatique — rappel de produit.',
    '',
    L('Produit', n.nom),
    L('ISIN', n.isin),
    L('Client', n.client),
    L('Date de rappel', formatDateFr(n.date)),
    L('Niveau de rappel', n.niveauPct != null ? `${n.niveauPct}%` : undefined),
    L('Coupon versé', n.couponPct != null ? `${n.couponPct}%` : undefined),
    L('Montant remboursé', n.montantPct != null ? `${n.montantPct}%` : undefined),
    L('Sous-jacents', n.sousJacents),
  ]
    .filter(Boolean)
    .join('\n')
  return { subject: `[RAPPEL PRODUIT] ${n.nom}`, body }
}
