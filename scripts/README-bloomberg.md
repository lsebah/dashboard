# Collecte des prix via Bloomberg (BLPAPI) — route SANS git

Le script `bloomberg_prices.py` récupère la liste d'ISIN depuis le dashboard,
price chaque produit sur Bloomberg, puis **POSTe** les prix au dashboard
(→ Vercel KV). Le portefeuille les affiche par-dessus `feed.json` (le plus
récent gagne). **Aucun git, aucun dépôt cloné sur le PC Bloomberg.**

## 0. Côté Vercel (une fois)

- Créer un store **Vercel KV** et le lier au projet (Vercel pose alors
  `KV_REST_API_URL` et `KV_REST_API_TOKEN` automatiquement).
- Ajouter une variable d'environnement **`PRICES_API_KEY`** = un secret de ton
  choix (ex. une longue chaîne aléatoire). Redeploy.
- Tu utiliseras la **même** valeur `PRICES_API_KEY` sur le PC Bloomberg.

## 1. Sur le PC Bloomberg (une fois)

- Terminal Bloomberg lancé et **connecté** (service `bbcomm`).
- Python 3.9+.
- Installer blpapi (deux tirets `--`, surtout pas un tiret long `—`) :

```
python -m pip install --user --index-url https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi
```

- Récupérer **un seul fichier** : `bloomberg_prices.py` (ce dossier). Pas besoin
  du reste du dépôt. Le déposer p. ex. dans `C:\bbg\`.

## 2. Lancer (PowerShell)

```powershell
$env:DASHBOARD_URL  = "https://TON-DOMAINE.vercel.app"
$env:PRICES_API_KEY = "le-meme-secret-que-sur-vercel"
python C:\bbg\bloomberg_prices.py --dry-run     # TEST : price, n'envoie rien
python C:\bbg\bloomberg_prices.py               # POSTe les prix au dashboard
```

Méthode de prix (= ta formule Excel) : pour chaque ISIN, `<ISIN>@<SOURCE> Corp`
sur le champ **PR005**, en parcourant `SOURCES` (LEOZ, BSED, …, BVAL, SGIN, …)
et en gardant la **première source numérique**.

## 3. Automatiser (quotidien, sans git)

Créer `C:\bbg\refresh_prices.bat` :

```bat
@echo off
set DASHBOARD_URL=https://TON-DOMAINE.vercel.app
set PRICES_API_KEY=le-meme-secret-que-sur-vercel
python "%~dp0bloomberg_prices.py" >> "%~dp0refresh_prices.log" 2>&1
```

Puis une tâche planifiée (ex. toutes les heures en journée) :

```bat
schtasks /Create /TN "CMF Prix Bloomberg" /TR "C:\bbg\refresh_prices.bat" /SC HOURLY /ST 08:00
```

Si le Terminal n'est pas lancé, blpapi échoue proprement (log) sans rien casser.

## 4. Conformité

L'API Desktop est licenciée pour ton usage (valoriser ton book). La
**redistribution** de ces prix (site externe, PDF clients) peut relever du
Data License Bloomberg — à cadrer avec ton account manager avant diffusion.

## 5. Endpoints utilisés

- `GET /api/isins` — liste des ISIN vivants à pricer (public, lecture seule).
- `POST /api/prices/ingest` — ingestion des prix (protégé par `x-prices-api-key`).
- `GET /api/prices` — surcouche de prix (lue par le portefeuille).

> La variante **avec git** (script qui réécrit `lib/feed.json` puis `git push`)
> reste possible mais n'est plus le chemin par défaut.
