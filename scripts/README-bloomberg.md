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

Méthode (réplique ta formule Excel) : pour chaque ISIN, on interroge
`<ISIN>@<SOURCE> Corp` sur le champ **PR005**, en parcourant la liste `SOURCES`
(LEOZ, BSED, …, BVAL, SGIN, …) dans l'ordre de priorité et en retenant la
**première source qui renvoie un nombre**. Adapter `SOURCES` / `--field` au besoin.

## 3. Automatiser (quotidien)

**Option A — `scripts\refresh_prices.bat` + Planificateur de tâches Windows** (recommandé).
Le `.bat` : vérifie que Bloomberg tourne (`bbcomm.exe`), `git pull`, lance le script,
puis `commit` + `push` **seulement si les prix ont changé**. Il se positionne tout
seul à la racine du dépôt et journalise dans `scripts\refresh_prices.log`.

Créer la tâche planifiée (ex. toutes les heures en journée) :
```bat
schtasks /Create /TN "CMF Prix Bloomberg" /TR "C:\chemin\vers\dashboard\scripts\refresh_prices.bat" /SC HOURLY /ST 08:00
```
(ou via l'interface « Planificateur de tâches » → Créer une tâche de base.)
Si Bloomberg n'est pas lancé à l'heure dite, le `.bat` s'arrête proprement sans rien faire.

Pré-requis sur le PC : clone sur la branche **`main`**, `git config user.name/user.email`
renseignés, et un accès **push** mémorisé (PAT Windows Credential Manager ou SSH).

**Option B — Claude Code sur le PC** : un `/loop` quotidien qui lance le script,
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
