# Collecte quotidienne des prix via Bloomberg (BLPAPI)

Met à jour `lib/feed.json` (colonne `last`, en % du pair) avec les prix
mark-to-market des produits structurés, depuis le **Terminal Bloomberg** du PC.

## 1. Installation (une fois, sur le PC Bloomberg)

- Terminal Bloomberg lancé et **connecté** (le service `bbcomm` doit tourner).
- Python 3.9+ installé.
- L'API Desktop :

```bat
python -m pip install --index-url=https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi
```

- Dépôt cloné (le script lit/écrit `lib/feed.json` en relatif).

## 2. Lancer

```bat
python scripts\bloomberg_prices.py --dry-run   :: test : affiche, n'écrit rien
python scripts\bloomberg_prices.py             :: met à jour lib\feed.json
git diff lib/feed.json                          :: vérifier
git add lib/feed.json && git commit -m "Prix Bloomberg du JJ/MM" && git push
```

Le push déclenche le redéploiement Vercel → prix à jour sur le dashboard.

Prix retenu : `PX_LAST`, sinon `PX_MID`, sinon mid(BID,ASK), sinon `PX_BID`.
Adapter la liste `FIELDS` dans le script si une source de prix émetteur précise
est requise (certaines notes ne cotent que `PX_BID`/`PX_ASK`).

## 3. Automatiser (quotidien)

**Option A — Planificateur de tâches Windows** : créer une tâche qui exécute
un `.bat` chaque soir :

```bat
@echo off
cd /d C:\chemin\vers\dashboard
python scripts\bloomberg_prices.py
git add lib/feed.json && git commit -m "Prix Bloomberg auto %date%" && git push
```

**Option B — Claude Code sur le PC** : `/loop` quotidien qui lance le script,
relit le diff et pousse.

## 4. Conformité

L'API Desktop est licenciée pour l'usage de l'utilisateur **loggé** (valoriser
ton propre book = OK). La **redistribution** de ces prix (publication externe,
reportings PDF clients) peut relever du Data License Bloomberg : à cadrer avec
ton account manager avant toute diffusion.

## 5. Évolution (sans redéploiement)

Étape suivante possible : un endpoint d'ingestion `POST /api/prices/ingest`
(protégé par secret) qui écrit les prix dans **Vercel KV**, lus en surcouche
de `feed.json` côté app. Le script Bloomberg `POST` alors les prix au lieu de
réécrire le JSON → plus de commit ni de redéploiement par mise à jour.
