# Lifecycle CMF — suivi des produits structurés

Application **dédiée** (indépendante du dashboard) pour suivre le cycle de vie
des produits structurés de Capital Management France : saisie depuis les
termsheets, listing du portefeuille, calendrier des observations, et — à terme —
prix mark-to-market, allocation par client et accès client.

> Cette app vit pour l'instant dans un sous-dossier du repo `dashboard` (création
> d'un repo séparé impossible au moment du démarrage). Elle est **autonome**
> (propre `package.json`, aucune dépendance au dashboard) et se sort telle quelle
> dans son propre repo le moment venu : `git subtree split -P lifecycle` ou simple
> copie du dossier.

## Démarrer

```bash
cd lifecycle
npm install
npm run dev   # http://localhost:3001
```

## Structure

```
lib/types.ts          Modèle de données multi-classes (equity / taux / crédit / FX / commo)
lib/lifecycle.ts      Dérivations : prochain événement, statut, situation, formats
lib/products.ts       4 produits décodés par termsheet (calendriers complets) + import
lib/portfolio-import.ts  Catalogue importé du fichier Excel "Lifecycle" (caractéristiques seules)
app/page.tsx          Portefeuille : Tableau (style Excel) + Synopsis (carte vizibility)
app/components/        Explorateur, carte synopsis, libellés partagés
app/calendrier         Calendrier transversal des observations
app/produits/nouveau   Masque de saisie d'un produit (v1)
```

## Import & confidentialité

`lib/portfolio-import.ts` reprend un échantillon représentatif du classeur
Excel « Lifecycle » couvrant toutes les classes (equity / crédit / taux / FX /
commodity). **Seules les caractéristiques produits sont versionnées** : aucune
donnée client ni commission / revenu / salaire n'entre dans le repo.

L'axe d'allocation **par client** se rebranchera via un fichier **local non
suivi** (`data/allocations.local.json`, ignoré par git), pour que l'identité des
clients ne figure jamais dans l'historique. L'import complet (~160 lignes) se
fera depuis un export propre du classeur (CSV/JSON via le bouton « Export »).

## Modèle de données

Le cœur `Product` est une **enveloppe commune** (identification, émetteur, dates,
nominal, sous-jacents). Le mécanisme de payoff est porté par une **union
discriminée** `terms` selon la famille :

- `AutocallTerms` — autocall / Phoenix / Athena / Airbag / inverse / +bonus
- `CreditTerms` — CLN / first-to-default / tranche (ébauche, à compléter)
- `RatesTerms` — CMS steepener / range accrual / TARN / callable (ébauche)

Les 4 produits d'amorce couvrent : mono sous-jacent, indice à décrément,
panier équipondéré, worst-of ; autocall standard & inverse ; Airbag, Oxygène,
barrière dégressive.

## Feuille de route

1. **Masque & listing** ✅ (v1)
2. **Calendrier des observations** ✅ (v1 transversal)
3. **Vue Tableau (Excel) + Synopsis (carte)** ✅
4. **Import du portefeuille** ✅ (échantillon multi-classes ; complet via export Excel)
5. **Interprétation taux & crédit** — affiner CLN / TARN / CMS sur termsheets réelles
6. **Prix mark-to-market** — source de prix des sous-jacents (Bloomberg via import,
   ou source marché pour la version cloud)
7. **Allocation par client** — fichier local non versionné, puis stockage dédié
8. **Accès client** — authentification + base de données + vue par client
```
