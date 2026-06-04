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
lib/types.ts        Modèle de données multi-classes (equity / taux / crédit…)
lib/lifecycle.ts    Dérivations : prochaine observation, statut, situation, formats
lib/products.ts     Amorce : 4 produits réels encodés depuis leurs termsheets
app/page.tsx        Portefeuille (cartes type vizibility + synthèse)
app/calendrier      Calendrier transversal des observations
app/produits/nouveau  Masque de saisie d'un produit (v1)
```

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
3. **Interprétation multi-classes** — modéliser taux & crédit sur termsheets réelles
4. **Prix mark-to-market** — source de prix des sous-jacents (Bloomberg via import,
   ou source marché pour la version cloud)
5. **Allocation par client** — positions par client (stockage hors repo)
6. **Accès client** — authentification + base de données + vue par client
```
