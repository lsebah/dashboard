# Audit du site Lifecycle — état au 11/08/2026

Cartographie complète (pages → composants → requêtes → sources) et inventaire des
dysfonctionnements, en vue d'une refonte V3. Chaque point est référencé
`fichier:ligne` et prouvé par le code — rien n'est supposé.

---

## 1. Arborescence des requêtes

```
════════════════════════════════════════════════════════════════════════════════
 ACCUEIL
════════════════════════════════════════════════════════════════════════════════
/                                                          app/page.tsx  'use client'
├── GET  /api/weather ─────────────────────────► wttr.in/Paris          (30 min)
├── GET  /api/markets ─────────────────────────► Yahoo ×7               (15 min)
│                                                 ⚠ CMS 10Y / OAT 10Y EN DUR
└── GET  /api/news ────────────────────────────► CNBC RSS ×3            (15 min)

════════════════════════════════════════════════════════════════════════════════
 /lifecycle2  ◄══ ENTRÉE OFFICIELLE (seul lien depuis l'accueil, app/page.tsx:48)
════════════════════════════════════════════════════════════════════════════════
layout ── Lifecycle2Nav      ⚠ AUCUN hook de données : pas de badge notifications,
       │                        pas de SyncIndicator, AUCUN email de rappel émis
       │
       ├─ /lifecycle2 ......................... Synthèse — CmfTerminal
       │   └── GET /api/lifecycle/courant?isins=…
       │        ├─► lib/products.ts  (feed.json + 96 définitions codées main)
       │        ├─► Yahoo /v8/finance/chart  × N symboles uniques
       │        ├─► KV levels:overlay            ◄── Bloomberg
       │        └─► KV decrement:strikes:overlay ◄── Bloomberg
       │   └── RiskCartography (prop courant) ─► lib/cmf-risk.ts
       │        ⚠ ignore les allocations saisies (lit p.clients du feed)
       │
       ├─ /lifecycle2/portefeuille ............ PortfolioExplorer  (1035 l.)
       │   ├── GET  /api/prices ──────────────► KV prices:overlay ◄── Bloomberg
       │   ├── GET  /api/lifecycle/courant?isins=…
       │   ├── GET  /api/commissions/store?slot=alloc|statut|noms|products
       │   │                                  ─► KV cmf:lifecycle:*
       │   ├── POST /api/notifications/rappel ─► Resend + KV cmf:rappels:notifies:v1
       │   └── [fiche] GET /api/lifecycle/niveaux?isin=…
       │        ⚠ QUASI-DOUBLON de /courant, avec Math.min EN DUR (chiffre faux)
       │
       ├─ /lifecycle2/calendrier .............. CalendarView
       │   ├── GET  /api/lifecycle/courant   ×2 (useLiveProducts + fetch inline)
       │   ├── GET  /api/prices
       │   ├── POST /api/notifications/rappel
       │   └── [fiche] GET /api/lifecycle/niveaux?isin=…
       │
       ├─ /lifecycle2/decrement ............... Banner + ComparatifDecrement
       │   ├── GET /api/decrement/monitoring ─► KV decrement:monitoring
       │   │                                     ◄── cron/decrement ◄── MS Graph
       │   ├── GET /api/levels ───────────────► KV levels:overlay ◄── Bloomberg
       │   └── statique lib/decrement-comparatif.json
       │        ◄── sync-issuer-runs.yml  ⚠ PR jamais auto-mergée
       │
       ├─ /lifecycle2/frn ..................... FrnView
       │   ├── GET/PUT /api/commissions/store?slot=frn ─► KV cmf:frn:quotes:v1
       │   └── statique data/frn-quotes.json
       │        ◄── sync-frn-runs.yml  ⚠ CASSÉ (mauvais dossier) — corrigé 11/08
       │
       ├─ /lifecycle2/itraxx .................. ItraxxView — ZÉRO fetch
       │   └── statique data/itraxx-tranches.json      (figé au 11/06, 61 j)
       │
       ├─ /lifecycle2/commissions ............. CommissionsView
       │   └── GET/PUT /api/commissions/store?slot=ov|local|alloc
       │        + statique lib/commissions.json        (figé au 19/06, 53 j)
       │
       ├─ /lifecycle2/bloomberg ............... MarketTerminal
       │   └── GET /api/lifecycle/markets ────► Yahoo ×22             (60 s)
       │        + statique data/markets-curated.json  (13/15 null, 61 j)
       │
       └─ /lifecycle2/client .................. ⚠ COQUILLE VIDE
            0 fetch · 0 logique · onglet permanent

════════════════════════════════════════════════════════════════════════════════
 /lifecycle  ◄══ V1 ENTIÈREMENT REDIRIGÉE vers /lifecycle2  (next.config.js:9)
             { source: '/lifecycle/:path*', destination: '/lifecycle2/:path*' }
             Les pages existent sur disque mais sont INATTEIGNABLES.
════════════════════════════════════════════════════════════════════════════════
layout ── LifecycleNav  (useLiveProducts + useNotifications + SyncIndicator)
       │      └── POST /api/notifications/email ─► Resend
       │      🔴 JAMAIS MONTÉ : layout dans l'arbre redirigé
       ├─ /lifecycle ............... → /lifecycle2            (existe)
       ├─ /lifecycle/calendrier ..... → /lifecycle2/calendrier (existe)
       ├─ /lifecycle/comparatif ..... → /lifecycle2/decrement  (existe)
       ├─ /lifecycle/commissions .... → /lifecycle2/commissions(existe)
       ├─ /lifecycle/bloomberg ...... → /lifecycle2/bloomberg  ⚠ page DIFFÉRENTE
       ├─ /lifecycle/sante .......... → /lifecycle2/sante ......... 🔴 404
       └─ /lifecycle/notifications .. → /lifecycle2/notifications . 🔴 404

  🔴 CONSÉQUENCE EN CHAÎNE : « Santé des données » et « Notifications » sont
     INACCESSIBLES, et comme `useNotifications` — seul appelant de
     POST /api/notifications/email — n'est monté que par LifecycleNav (v1) et
     NotificationsView (v1), AUCUN EMAIL DE RAPPEL NE PEUT PLUS PARTIR.
     `SyncIndicator` étant aussi dans ce layout, un échec de sauvegarde KV est
     invisible partout dans l'application.

  Sens des imports : lifecycle2 ──► lifecycle  (jamais l'inverse).
  Les composants sont partagés ; seules les ROUTES sont dupliquées.

════════════════════════════════════════════════════════════════════════════════
 IMPRESSION / REPORTING
════════════════════════════════════════════════════════════════════════════════
/print?client=<code>                              ◄── scripts/reporting_clients.mjs
└── PrintReports → GET /api/lifecycle/courant + GET /api/prices
     └── ReportSheet (import nommé de ClientReport)

════════════════════════════════════════════════════════════════════════════════
 CHAÎNE BLOOMBERG  (hors CI — PC Windows + Terminal, tâche planifiée horaire)
════════════════════════════════════════════════════════════════════════════════
scripts/bloomberg_prices.py
├── GET /api/isins ─────────────────► ISIN vivants
├── GET /api/underlyings ───────────► tickers NON mappables Yahoo
├── GET /api/decrement/tickers ─────► 184 indices
├── GET /api/decrement/strikes-needed
│        ↓ BLPAPI localhost:8194   (PR005 par ISIN · PX_LAST · BDH strikes)
└── POST /api/prices/ingest  [x-prices-api-key]
         └─► KV prices:overlay · levels:overlay · decrement:strikes:overlay

════════════════════════════════════════════════════════════════════════════════
 JOBS PLANIFIÉS
════════════════════════════════════════════════════════════════════════════════
GitHub Actions
├── sync-termsheets.yml    0 8 * * *      OneDrive → index + renommage + contrôles
│                                          ⚠ inerte : secrets GRAPH_* absents
├── sync-issuer-runs.yml   0 6 * * *      mail décrément → comparatif
│                                          ⚠ inerte + PAS d'auto-merge
├── sync-frn-runs.yml      0 6 * * 1-5    mail FRN → grille
│                                          ⚠ inerte + mauvais dossier (corrigé)
└── reporting-clients.yml  15 6 * * 1     relevés clients PDF + email

Vercel crons (vercel.json)
├── /api/cron/decrement    0 17 * * *  ET  0 8 * * 1   ─► MS Graph → KV
└── /api/cron/sante        30 6 * * *                  ─► contrôles + Resend
     ⚠ les deux sont PUBLICS si CRON_SECRET n'est pas défini
```

---

## 2. Dysfonctionnements

### P0 — Un chiffre ou un statut FAUX est affiché

| # | Problème | Emplacement | Impact |
|---|---|---|---|
| **0a** | **`/lifecycle/*` est redirigé vers `/lifecycle2/*`**, or `sante/` et `notifications/` **n'existent pas** en v2 | `next.config.js:9` | **Deux écrans en 404**, et surtout : `useNotifications` (seul appelant de `POST /api/notifications/email`) n'étant monté que dans l'arbre redirigé, **aucun email de rappel ne peut plus partir**. `SyncIndicator` idem ⇒ échec de sauvegarde invisible partout. |
| **0b** | **`prixOf` fabrique un prix de 100** pour toute position sans cotation | `lib/cmf-analytics.ts:39-42` | **77 des 184 lignes du feed n'ont pas de prix** ⇒ ~42 % du portefeuille valorisé au pair sans source. Alimente « Valorisation MtM », « P&L latent », « Rdt depuis origine », la colonne Prix. **Violation frontale de « jamais un chiffre n'est inventé ».** |
| **0c** | **Le statut n'est dérivé qu'au BUILD** : `rappelConstate(base)` ne voit que `observed-levels.ts` (1 ISIN). Les niveaux live n'arrivent qu'au runtime et **rien ne recalcule le statut** | `lib/products.ts:6918` | Un produit rappelé depuis le dernier build reste « vivant » pour tous les filtres — dont `clientReportRows` ⇒ **il est valorisé dans le relevé envoyé au client**. Le cron santé ne détecte aucun rappel live malgré son commentaire. |
| **0d** | **Table de change codée en dur, repli silencieux `\|\| 1`** | `lib/cmf-analytics.ts:13-30` | Sans source ni date. Convertit tous les nominaux € (encours, P&L, répartitions, risque). Une devise hors table est comptée **1:1 contre l'euro** — pour TRY, erreur ≈ 36×. |
| **0e** | **P&L « coupons inclus » double-compte les produits *in fine*** : les coupons non détachés sont déjà dans le prix MtM | `lib/lifecycle.ts:362-370, 467-471` | Le relevé client imprime « Coupons versés +X % » pour un produit dont rien n'a été versé. Formule juste seulement pour les produits à coupons réellement détachés. |
| **0f** | **Le tri du tableau porte sur les valeurs NON augmentées** (prix du feed, sans surcouche KV ni coupons live) alors que les cellules affichent les valeurs augmentées | `PortfolioExplorer.tsx:332-344, 404` | Trier par P&L ou par Last produit un **ordre visiblement faux**. |
| **0g** | **15 tests ne démarraient jamais** (résolution ESM) — dont ceux couvrant `aggregateBasket`, au cœur du bug n°1 | `lib/basket.test.ts`, `lib/coherence.test.ts` | Le filet de sécurité du calcul de panier était inexistant. **✅ corrigé le 11/08** : `npm test` passe de 21/23 à **36/36**. |
| 1 | **`/api/lifecycle/niveaux` utilise `Math.min` en dur** au lieu de `aggregateBasket(p.basket)` — contrairement à `/courant` | `app/api/lifecycle/niveaux/route.ts:79,98` vs `courant/route.ts:100,120` | Pour tout panier `equipondere` / `panier` / `best_of`, **la fiche produit et la ligne de portefeuille affichent deux valeurs différentes**. La fiche montre le pire sous-jacent au lieu de la moyenne. |
| 2 | **Deux définitions d'« autocall probable »** : le calendrier force le worst-of et ignore `p.basket` | `PortfolioExplorer.tsx:80-92` (correct) vs `CalendarView.tsx:172-179` | Un équipondéré est classé « rappel probable » sur une page et pas sur l'autre. |
| 3 | **CMS 10Y = 3.042 et OAT 10Y = 3.663 codés en dur**, servis avec `marketState:'REGULAR'` et `timestamp: now` | `app/api/markets/route.ts:81-100` | Indiscernables d'une cotation live côté accueil. **Viole la règle « jamais un chiffre inventé ».** |
| 4 | **La Synthèse ignore les allocations saisies** (lit `p.clients` du feed brut) | `lib/cmf-analytics.ts:183`, `RiskCartography.tsx:33,40` | « Allocation par client » de `/lifecycle2` en désaccord avec le Portefeuille et le reporting. |
| 5 | **Données périmées servies sans avertissement** | `data/markets-curated.json` (13/15 `null`, 61 j) · `data/itraxx-tranches.json` (61 j) · `lib/commissions.json` (53 j) · `lib/portfolio-import.ts` (snapshot 10/04) | L'utilisateur ne peut pas distinguer « à jour » de « figé ». |
| 6 | **Yahoo ne cote AUCUN indice à décrément** → `complet = false` → le suivi des coupons est **entièrement sauté**, même quand le PX_Last Bloomberg est présent en KV | `underlyings.ts:69` · `niveaux/route.ts:84` · `courant/route.ts:105` | P&L sans coupons, rappel indétectable. Seul `lib/observed-levels.ts` (1 seul ISIN aujourd'hui) débloque le cas. |

### P1 — Une panne devient invisible, ou une écriture est ouverte

| # | Problème | Emplacement | Impact |
|---|---|---|---|
| 7 | **`kvGet` transforme toute panne KV en « clé absente »** (`catch → null`, `if (!res.ok) return null` avale 401/403/500) | `lib/kv.ts:39,43,52,66,75` | Réseau coupé / token expiré / quota dépassé ⇒ dashboard vide, **HTTP 200 partout, aucun signal**. |
| 8 | **L'alarme « prix froids » est neutralisée par la panne qu'elle doit détecter** : KV KO ⇒ `asof=null` ⇒ `prixFroids=false` | `app/api/cron/sante/route.ts:80-83` | « Les prix Bloomberg ne rentrent plus » ne déclenche rien. |
| 9 | **Sans KV, aucun email de rappel ne part jamais** : `stored` vaut `null` à chaque run ⇒ toujours la branche « amorçage » | `app/api/cron/sante/route.ts:46-50` | Rappels autocall jamais notifiés. |
| 10 | **Email marqué « envoyé » AVANT l'envoi**, jamais retenté (`void fetch().catch(()=>{})`, la route renvoie 200 même si Resend échoue) | `lib/use-notifications.ts:70-77` · `notifications/email/route.ts:40-42` | Notification perdue définitivement. |
| 11 | **`PUT /api/commissions/store` sans AUCUNE authentification**, écriture *replace* | `app/api/commissions/store/route.ts:40-52` | N'importe qui peut **écraser** allocations, statuts, commissions, produits (8 clés métier). |
| 12 | **`POST /api/notifications/email` sans auth** | `app/api/notifications/email/route.ts` | Relai d'envoi ouvert depuis l'adresse vérifiée `@cmf.finance`. |
| 13 | **Crons *fail-open*** : `if (process.env.CRON_SECRET) { … }` | `cron/decrement:18` · `cron/sante:29` | Variable absente ⇒ routes publiques, dont celle qui envoie des emails. |
| 14 | **`/lifecycle2` — l'entrée officielle — n'émet aucun email de rappel** (`useNotifications` monté seulement par `LifecycleNav`) | `Lifecycle2Nav.tsx` (aucun hook) vs `LifecycleNav.tsx:26` | Qui ne navigue que sur v2 ne déclenche jamais les notifications. |
| 15 | **`SyncIndicator` absent du layout v2** | `app/lifecycle2/layout.tsx` | Un échec de sauvegarde KV est silencieux sur le parcours principal. |
| 16 | **Yahoo en panne = « marché fermé »** ; le drapeau `fallback` n'est vrai que si **les 7** symboles échouent | `markets/route.ts:68-70,75` · `lifecycle/markets:77-79` | Panne partielle invisible. |
| 17 | **Perte silencieuse des coupons dans le P&L** : un échec Yahoo ⇒ `bars=[]` ⇒ bloc `niveaux` entièrement sauté | `courant/route.ts:38-42,105` | Rate-limit Yahoo ⇒ P&L faux, sans indicateur. |
| 18 | **`sync-issuer-runs` n'auto-merge pas sa PR** (contrairement aux 2 autres workflows) | `.github/workflows/sync-issuer-runs.yml` | Même si le job tourne, la page Décrément reste figée. |
| 19 | **Secrets `GRAPH_*` absents** ⇒ 3 workflows inertes | GitHub Settings | Termsheets, décrément et FRN ne se rafraîchissent pas. |
| 20 | **`sync-frn-runs` cherchait « Exchange FRN »** — dossier inexistant ⇒ repli `$search` global qui ramassait les notifications GitHub | `scripts/sync-frn-runs.mjs:34` | Grille FRN figée 62 jours. **✅ corrigé le 11/08** (`FRN` + exclusion des expéditeurs automatiques). |

### P2 — Dette, performance, code mort

| # | Problème | Emplacement |
|---|---|---|
| 21 | **Sur-fetch** : jusqu'à **3× `/api/lifecycle/courant`** et 2× `/api/prices` par chargement de `/lifecycle/calendrier`, sans cache partagé | `use-live-products:28` · `PortfolioExplorer:375` · `CalendarView:156` · `CmfTerminal:84` · `PrintReports:26` |
| 22 | **`/api/lifecycle/courant` non borné, sans `maxDuration`** : sans `?isins=`, traite les 177 ISIN ⇒ >100 requêtes Yahoo simultanées | `courant/route.ts:18-20,35-43` |
| 23 | **Routes mortes** : `/api/frn/quotes` (POST valide puis jette, `persisted:false`), `/api/lifecycle/parse-ts` (**POST public qui brûle `ANTHROPIC_API_KEY`**), `/api/decrement/strikes` | — |
| 24 | **Code mort** : `lib/facture.ts` (réimplémenté en dur dans `CommissionsView.tsx:37,201`), `HeatGrid` (`charts.tsx:297`), page `/lifecycle2/client` | — |
| 25 | **Logique dupliquée** : `situation` ×3 (`lifecycle.ts:141`, `CmfTerminal.tsx:47`, `cmf-risk.ts:88`) · `allocsOf` ×3 · `marquerRappele` ×2 · surcouche statut/nom ×2 · `barriereProtection` ×2 | — |
| 26 | **Chaînes cassées** : `sync-fiches` → `public/fiches/` n'existe pas (0/184 indices ont un `fichePdf`) · `termsheets-content-check.json` jamais publié · `lib/clients-roster.json` importé nulle part | — |
| 27 | **`/api/news` et `/api/weather` sans `dynamic`** ⇒ prérendus au build ; si le fetch échoue dans le sandbox de build, le **fallback est figé en cache** | `news/route.ts:77` · `weather/route.ts:3` |
| 28 | **Filtres divergents** : `isins`/`underlyings` excluent `rappele`, `strikes-needed` non | `strikes-needed/route.ts:17` |

---

## 3. Ce qu'une V3 agentique devrait industrialiser

Les pannes ci-dessus ont un point commun : **rien ne vérifie qu'une donnée est fraîche
et cohérente**, et toute panne se dégrade en silence (HTTP 200 + valeur vide). Les
boucles à mettre en place :

1. **Boucle de fraîcheur** — chaque source porte un `asof` + un SLA (FRN : 5 j,
   décrément : 7 j, prix : 2 j, feed : 7 j). Au-delà, la donnée est affichée
   **barrée/orange** dans l'UI et remonte en anomalie. Supprime P0-5 et P1-8.
2. **Boucle d'ingestion e-mail** — un agent lit les dossiers `Emetteurs/*`,
   classe (décrément / FRN / CLN / idée), extrait le tableau, **propose** un diff
   chiffré à valider. Remplace la saisie manuelle et les parseurs figés qui cassent
   au premier changement de mise en page.
3. **Boucle de cohérence inter-vues** — un test qui, pour chaque produit, compare
   ce que renvoient `/courant` et `/niveaux`, et ce qu'affichent Portefeuille /
   Calendrier / Synthèse. Échoue si divergence. Aurait attrapé P0-1, P0-2, P0-4.
4. **Boucle « aucune valeur sans source »** — interdiction d'un nombre sans champ
   `source` (email, TS, Bloomberg, calcul). Aurait bloqué P0-3.
5. **Boucle de santé qui sait dire « je ne sais pas »** — distinguer *absent*
   (KV vide) de *indisponible* (KV en panne), et alerter dans les deux cas.
   Supprime P1-7/8/9.
6. **Fusion v1/v2** — une seule arborescence de routes, tous les hooks montés une
   fois dans le layout, un seul contexte de données partagé (supprime P1-14, P1-15,
   P2-21).
