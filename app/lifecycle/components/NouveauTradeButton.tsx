'use client'

import { useState } from 'react'
import NouveauTrade from './NouveauTrade'

// Bouton bleu « Nouveau trade » (en-tête du portefeuille) → ouvre la modale de
// saisie. Remplace l'ancien bouton « Nouveau produit ».
export default function NouveauTradeButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        + Nouveau trade
      </button>
      {open && <NouveauTrade onClose={() => setOpen(false)} />}
    </>
  )
}
