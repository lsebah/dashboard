'use client'

import { useEffect, useState } from 'react'
import { loadSlot, saveSlot } from './commissions-sync'

// Surcharges locales des commissions : UF / Rétro saisis à la main (en %,
// décimal) et marquage « facturé » manuel (si la facture a été envoyée par un
// autre canal). Clé = identifiant stable d'une ligne. Persistées côté serveur
// (KV) quand il est configuré → mémorisées sur tous les appareils ; sinon dans
// le navigateur uniquement. localStorage sert de cache instantané dans les deux
// cas.
export interface CommissionOverride {
  uf?: number // upfront total (décimal, 0.06 = 6 %)
  retro?: number // rétrocession (décimal)
  fait?: boolean // facturé/envoyé manuellement (autre canal)
  facture?: string | null // n° de facture saisi à la main ; null = effacé (surcharge)
  credited?: string | null // date d'encaissement (ISO) ; null = paiement annulé (surcharge)
}

const KEY = 'cmf.commissions.ov.v1'
// Copie de sûreté écrite AVANT toute réinitialisation. « Réinitialiser mes
// saisies » effaçait le navigateur ET le serveur, sans filet : un clic de trop
// et le travail de saisie était perdu, sans rien à restaurer. La copie survit
// à la réinitialisation et alimente le bouton « Annuler ».
const KEY_BACKUP = 'cmf.commissions.ov.backup.v1'

export function useCommissionsStore() {
  const [ov, setOv] = useState<Record<string, CommissionOverride>>({})
  // Saisies effacées par la dernière réinitialisation, restaurables.
  const [backup, setBackup] = useState<Record<string, CommissionOverride>>({})
  // null = inconnu, true = sauvegarde serveur active, false = navigateur seul.
  const [serverSync, setServerSync] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    // 1) Hydrate immédiatement depuis le cache navigateur (instantané).
    let local: Record<string, CommissionOverride> = {}
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) local = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    if (Object.keys(local).length) setOv(local)
    try {
      const rawB = localStorage.getItem(KEY_BACKUP)
      if (rawB) setBackup(JSON.parse(rawB))
    } catch {
      /* ignore */
    }
    // 2) Le serveur fait foi s'il est configuré — MAIS sans écraser les saisies
    //    locales récentes (qui peuvent ne pas encore avoir été remontées). On
    //    fusionne : le serveur apporte les modifs des autres appareils, le
    //    navigateur conserve les siennes (qui priment en cas de conflit), puis on
    //    repousse la fusion au serveur pour qu'elle soit mémorisée partout.
    loadSlot<Record<string, CommissionOverride>>('ov').then(({ configured, value }) => {
      if (cancelled) return
      setServerSync(configured)
      if (!configured) return
      const server = value && typeof value === 'object' ? value : {}
      // Relire le localStorage au moment de la fusion (pas la capture initiale) :
      // l'utilisateur peut avoir saisi/payé entre le mount et la réponse KV.
      let currentLocal: Record<string, CommissionOverride> = {}
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) currentLocal = JSON.parse(raw)
      } catch {
        /* ignore */
      }
      const merged = { ...server, ...currentLocal }
      setOv(merged)
      try {
        localStorage.setItem(KEY, JSON.stringify(merged))
      } catch {
        /* ignore */
      }
      // Repousse au serveur uniquement si la fusion diffère (propage le local).
      if (JSON.stringify(merged) !== JSON.stringify(server)) void saveSlot('ov', merged)
    })
    // Copie de sûreté du serveur : permet d'annuler une réinitialisation faite
    // depuis un AUTRE poste (ou après avoir vidé le cache du navigateur).
    void loadSlot<Record<string, CommissionOverride>>('ov-backup').then(({ configured, value }) => {
      if (cancelled || !configured) return
      const b = value && typeof value === 'object' ? value : {}
      if (Object.keys(b).length) setBackup((cur) => (Object.keys(cur).length ? cur : b))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = (next: Record<string, CommissionOverride>) => {
    setOv(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    void saveSlot('ov', next) // serveur (fire-and-forget)
  }

  const patch = (key: string, p: Partial<CommissionOverride>) => {
    const cur = { ...(ov[key] ?? {}), ...p }
    // nettoie les clés undefined
    for (const k of Object.keys(cur) as (keyof CommissionOverride)[])
      if (cur[k] === undefined) delete cur[k]
    const next = { ...ov, [key]: cur }
    if (Object.keys(cur).length === 0) delete next[key]
    persist(next)
  }

  /**
   * Efface toutes les saisies — mais en garde une copie d'abord.
   * La copie vit dans le navigateur ET sur le serveur : une réinitialisation
   * faite depuis un poste doit pouvoir s'annuler depuis ce poste, même après
   * un rechargement.
   */
  const reset = () => {
    const avant = ov
    setBackup(avant)
    try {
      localStorage.setItem(KEY_BACKUP, JSON.stringify(avant))
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    void saveSlot('ov-backup', avant)
    setOv({})
    void saveSlot('ov', {})
  }

  /** Annule la dernière réinitialisation : remet les saisies sauvegardées. */
  const restore = () => {
    if (Object.keys(backup).length === 0) return
    persist(backup)
    setBackup({})
    try {
      localStorage.removeItem(KEY_BACKUP)
    } catch {
      /* ignore */
    }
    void saveSlot('ov-backup', {})
  }

  return { ov, patch, reset, restore, backup, serverSync }
}
