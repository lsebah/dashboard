# Données manquantes — termsheets & prix Bloomberg

> Généré à partir de l'audit des **produits vivants** (feed live) croisé avec le
> dossier OneDrive `Termsheets` et les définitions décodées de `lib/products.ts`.
> **Aucune valeur n'est inventée** : ce document ne fait que lister ce qui manque.
> À réviser après chaque nouvelle émission.

---

## 1. Termsheets à récupérer (produit vivant, aucune TS dans le dossier)

Ces positions sont **détenues** mais n'ont pas de termsheet exploitable dans
`Documents/Termsheets`. Sans elle, le payoff (barrières, coupons, calendrier) ne
peut pas être décodé — la fiche reste en identité minimale.

| ISIN | Produit | Client | Nominal | Où chercher |
| --- | --- | --- | --- | --- |
| **XS3287495306** | Athena Airbag BNP (BBVA, 6Y mensuel) | CURNILLON - 01223 | 300 000 € | ⚠️ le fichier `…_XS3287495306_BBVA.pdf` du dossier contient en réalité la TS d'un **autre** produit (XS3351619633, Micron) — à re-déposer. Demander la vraie TS à BBVA (émission 13/04/2026). |
| **XS3045607119** | NexAutocall Quotidien BNP Paribas Août 2025 | CAPITALL - 01227 | 1 000 € | Introuvable sur les deux drives. Demander à BNP. |
| **FR001400GV92** | Phoenix Mémoire Wof Porsche + Volkswagen | ALVES - 06001 | 600 000 € | Introuvable (seulement des Excel de suivi). Demander l'émetteur. |
| XS2804857568 | Phoenix Bearish CMS 10Y | VIA - 08001 | 1 800 000 € | TS de taux — à fournir. |
| XS2110106908 | GBP Zero-Coupon Callable 12YNC4 | SCALA - 05722 | 630 000 £ | À fournir. |
| XS3191958233 | Athena Booster Wof SPX + SX5E + NKY | VIA - 08001 | 330 000 € | À fournir. |
| XS2482711673 | CLN Société Générale subordonnée 4,60 % | SCALA - 05722 | 5 000 000 € | À fournir. |
| XS2465015720 | TARN steepener CMS 30Y-2Y — 5,75 % ×2 | VIA - 08001 | 5 500 000 € | À fournir. |
| XS2569852416 | Callable FRN 3,61 % | SCALA - 05722 | 1 350 000 € | À fournir. |
| XS2444096874 | TARN steepener CMS 30Y-2Y — 4,20 % ×2 | VIA - 08001 | 1 750 000 € | À fournir. |
| FEI | Dette Privée — FEI (10 ans) | MACIF | 10 000 000 € | Intermédiation (pas de TS bancaire) — normal. |

> **Contrôle automatique associé** : le workflow `sync-termsheets` vérifie
> désormais que l'ISIN du **nom de fichier** apparaît bien dans le **contenu** du
> PDF (`scripts/termsheets-content-check.mjs`) — c'est ce contrôle qui a détecté
> le mauvais fichier XS3287495306. Le rapport est publié dans
> `data/termsheets-content-check.json`.

---

## 2. Tickers Bloomberg — à intégrer / confirmer dans le programme Bloomberg

Le programme `scripts/bloomberg_prices.py` price :
- **les produits** par ISIN (`<ISIN>@<source> Corp`, champ PR005) ;
- **les niveaux des sous-jacents** non cotés Yahoo (`PX_Last`), via
  `/api/underlyings` et `/api/decrement/tickers`.

### 2a. Indices à décrément / propriétaires — **couverts** (ticker connu)

Ces tickers sont déjà envoyés au programme et pricés (PX_Last + strike historique
BDH). Rien à faire côté opérateur, sinon vérifier que Bloomberg renvoie une valeur.

`SSDSAN04 Index` (Sanofi décr.), `MXEADT50 Index`, `MXCPFB50 Index`,
`SGACA110 Index`, `MQDBN420 Index`, `MQDTT296 Index`, `MQDZC50P Index`,
`SOENI096 Index`, `IETAI10 Index`, `EURHGPT Index`, `BEU50CFC Index`,
`BFRTEC10 Index` (TEC 10 — confirmé verbatim TS CIC), `USISS010 Index`
(SOFR CMS 10Y), `EUAMDB10 Index` (EUR CMS 10Y — voir 2c), `GOLDLNPM Cmdty` (or),
`LEONIES3 Index`.

> Correctif appliqué : `IETAI10`, `EURHGPT`, `MQDTT296` étaient stockés **sans**
> le suffixe ` Index` → le script leur ajoutait ` Equity` (aucun prix). Corrigé
> dans `lib/products.ts` + durci dans `bbg_security()` (un jeton unique sans code
> place est toujours un indice).

### 2b. Sous-jacents **sans ticker Bloomberg** dans notre base

Ces références n'ont pas de ticker → le programme ne peut pas les demander.
Ce sont des taux (CMS/TEC), des tranches iTraxx et un change. **À renseigner par
l'opérateur Bloomberg** (le ticker n'est pas dans la TS — voir 2c) :

| Référence | Produits concernés | Ticker Bloomberg à confirmer |
| --- | --- | --- |
| EUR CMS 10Y | 13 Phoenix Bearish (BNP + SG) | `EUSA10 Index` ? (à valider, cf. 2c) |
| EUR CMS 2Y | XS3064231932, TARN | `EUSA2 Index` ? |
| EUR CMS 30Y − CMS 2Y | XS2442403130, XS2465015720, XS2444096874 | spread `EUSA30 − EUSA2` |
| EUR CMS 30Y / 5Y | FR001400T985 (Sphinx 15) | `EUSA30` / `EUSA5` |
| TEC 10Y (CNO) | XS2979390502 | `BFRTEC10 Index` (déjà utilisé sur FR001400SDV1) |
| EUR/TRY | XS2621505341 | `EURTRY Curncy` / `WMRPSPOT35` |
| iTraxx Crossover S42 | XS2975786000 | RED Code **2I667KKW7** (série 42 v1) |
| iTraxx Main S42 | XS2642227883, XS2863767542 | RED Code **2I666VDK8** (série 42 v1) |
| iTraxx Main S40 | XS2641318121 | à confirmer |
| iTraxx Main S39 | XS2059726096 | à confirmer |

### 2c. Point important — les CMS ne portent **pas** de ticker Bloomberg dans les TS

Vérifié sur 6 termsheets de taux (5 BNP, 1 SG) : **aucune** ne donne de ticker
Bloomberg. Toutes définissent le taux par sa **page de fixing Reuters/Refinitiv** :

> « The EUR CMS *n*Y swap rate (annually, 30/360) vs 6 months Euribor, as quoted
> on the **Reuters Screen ICESWAP2 Page** at 11:00 am Frankfurt time. » (BNP)
> « Page Écran : **Reuters ICESWAP2**, 11h00 heure de Francfort. » (SG,
> sous-jacent nommé « CMS.EUR.10Y »).

→ Le mapping vers un ticker Bloomberg (`EUSA10 Index`, `EIISDA10 Index`, ou le
`EUAMDB10 Index` déjà utilisé pour FR001400OZR1) est une **décision interne**, pas
une donnée de TS. Des fichiers internes CMF (« Old RF.xlsx », « Backup
Lifecycle.xlsm ») associent XS2442403130 à `EUSA30-EUSA2` et XS3073984430 à
`EUSA10`. **À trancher par Laurent** avant de figer un ticker — d'ici là, on
n'invente rien : ces sous-jacents restent sans ticker.

> Impact réel limité : pour un produit de **taux**, la valo qui compte est le prix
> mark-to-market du produit (PR005 par ISIN, déjà récupéré) ; le niveau du CMS ne
> sert qu'à l'affichage « distance à la barrière ».

---

## 3. À décider (Laurent)

1. **Ticker CMS unique** : figer `EUSA10/EUSA2/EUSA30/EUSA5 Index` (ou `EUAMDB10`)
   pour toutes les lignes de taux, afin d'afficher la distance aux barrières.
2. **Fichiers Excel internes** comme source d'appoint : `20260405_Lifecycle.xlsm`
   contient l'ISIN XS3287495306 avec ses barrières saisies à la main — utilisable
   pour reconstituer le payoff en attendant la vraie TS BBVA (à ouvrir dans Excel,
   illisible via l'API).
3. Deux TS introuvables mais produits vivants (XS3045607119, FR001400GV92) :
   les redemander aux émetteurs.
