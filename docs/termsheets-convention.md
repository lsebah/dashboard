# Termsheets — convention de nommage & ingestion automatique

## Convention de nommage

Tout fichier déposé dans le dossier OneDrive `Documents/Termsheets/` doit suivre :

```
YYMMDD_<durée>Y_<Nom commercial>_<Fréquence>_<ISIN>_<ÉMETTEUR>.pdf
```

| Champ        | Règle                                                            | Exemple                              |
| ------------ | ---------------------------------------------------------------- | ------------------------------------ |
| `YYMMDD`     | date de strike / émission                                        | `260220`                             |
| `<durée>Y`   | maturité en années                                               | `5Y`, `10Y`, `12Y`                   |
| `<Nom>`      | nom commercial (espaces et `+` autorisés, **pas** d'underscore)  | `Phoenix Mémoire Réarmement Europe`  |
| `<Fréquence>`| `Mensuel` · `Trimestriel` · `Semestriel` · `Annuel` · `In Fine`  | `Trimestriel`                        |
| `<ISIN>`     | 12 caractères ISO 6166                                           | `XS3250102665`                       |
| `<ÉMETTEUR>` | code court                                                       | `BNP`, `SOCGEN`, `BBVA`, `GS`, `MSCO`, `CITI`, `CIBC`, `EFG`, `BARCLAYS`, `SANTANDER`, `MAREX`, `DB`, `CIC`, `BOFA`, `BIL` |

Exemple complet :
`260220_5Y_Phoenix Memoire Réarmement Europe_Trimestriel_XS3250102665_BBVA.pdf`

## Ingestion automatique (côté application)

`lib/termsheets.ts` :
- `parseTermsheetName(fichier)` — lit un nom (même non conforme) → `{ isin, dateEmission, dureeAnnees, nom, frequence, emetteur, conforme }`.
- `canonicalTermsheetName(produit)` — reconstruit le nom propre à partir des métadonnées d'un produit.
- `TERMSHEET_NONCONFORME` — liste des fichiers du dossier à renommer.

`lib/products.ts` → `minimal(isin)` : si un ISIN du portefeuille n'a pas de définition codée mais qu'une termsheet existe dans le dossier, **l'identité est auto-renseignée depuis le nom de fichier** (nom, émetteur, dates, durée, fréquence, type, classe d'actif inférée). Résultat : **déposer une termsheet correctement nommée fait apparaître le produit** dans le tableau (badge `TS — auto`). Un fichier mal nommé apparaît avec le badge `TS à renommer`.

## Vérifier les noms

```
node scripts/termsheets-lint.mjs
```
Liste les fichiers non conformes et le gabarit cible. Sort en code 1 si au moins un fichier est non conforme (utilisable en CI / pre-commit).

## Renommage + ajout « à la volée » côté OneDrive

L'app se met à jour à partir de `lib/termsheets-index.json` (instantané du dossier).
Deux briques restent à câbler **côté OneDrive** (accès en écriture non disponible depuis l'app) :

1. **Renommage automatique** — flux **Power Automate** « Quand un fichier est créé dans `Termsheets` » → appeler une fonction qui calcule le nom canonique (mêmes règles que `canonicalTermsheetName`) et `PATCH` le fichier via Microsoft Graph (`/me/drive/items/{id}` → `name`). À défaut de Power Automate, un script Graph (Node ou PowerShell) lancé périodiquement fait le même travail.
2. **Re-synchro de l'index** — le même flux (ou un cron) régénère `lib/termsheets-index.json` à partir de la liste du dossier, puis commit. Le produit apparaît alors tout seul grâce à `minimal()`.

> Le script Graph de renommage + re-synchro peut être généré sur demande (il nécessite un *app registration* Azure AD avec `Files.ReadWrite` et tourne avec tes identifiants).
