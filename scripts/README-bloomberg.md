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

Le script récupère **aussi** les **niveaux des sous-jacents** (`PX_Last`), utile
pour les indices à décrément que Yahoo ne sait pas pricer. Il applique ta formule
Excel : ajoute `" Index"`/`" Equity"` au ticker si le yellow-key est absent.
Pour ne collecter que les prix produits : `--no-levels`.

### La composition des indices du radar de volatilité

Le radar trace les **titres** d'un indice : il lui faut donc la liste de ses
membres. Le job mensuel du dashboard sait la scraper pour le S&P 500 et le Dow,
mais ni Euronext, ni STOXX, ni iShares ne répondent — CAC 40, Euro Stoxx 50 et
MSCI World restaient sans composants à tracer. Ce run les rapporte, avec le
champ **bulk** `INDX_MWEIGHT` (= `BDS`) sur `CAC Index`, `SX5E Index` et
`MXWO Index` : une ligne par valeur (« Index Member » + « Percent Weight »), plus
la raison sociale (champ `NAME`) qui étiquette les points de la planche.

L'étape fait partie du run par défaut : `--members` l'explicite, `--no-members`
la coupe, `--dry-run` interroge et affiche le nombre de membres par indice sans
rien envoyer.

Le mappage **ticker Bloomberg → symbole Yahoo** se fait côté dashboard, avec la
table qui sert déjà aux sous-jacents. Un ticker dont la place n'y figure pas
(Tokyo, Toronto, Hong Kong…) est **écarté et compté** dans la réponse, jamais
complété au jugé : un mauvais suffixe ne rend pas une erreur, il rend le cours
d'une **autre** société. Et un indice dont le terminal ne renvoie rien garde la
composition qu'il avait — on n'efface pas une bonne liste par une liste vide.

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

Cette section vaut **particulièrement** pour la composition des indices : une
liste `INDX_MWEIGHT` finit citée telle quelle sur une planche, et une planche
part en pièce jointe chez un client. Redistribuer une composition d'indice
Bloomberg relève potentiellement du Data License — à cadrer avec l'account
manager avant qu'un PDF ne sorte.

## 5. Endpoints utilisés

- `GET /api/isins` — liste des ISIN vivants à pricer (public, lecture seule).
- `GET /api/underlyings` — tickers Bloomberg des sous-jacents à pricer (public).
- `POST /api/prices/ingest` — ingestion (protégé par `x-prices-api-key`). Corps :
  `{ "prices": { ISIN: nombre } }`, `{ "levels": { ticker: nombre } }`,
  `{ "membres": { "CAC": [ { "ticker": "SAF FP", "nom": "SAFRAN SA", "poids": 3.1 }, … ] } }`
  (composition, upsert **par indice** — un POST qui ne porte que le CAC laisse
  les autres intacts), `{ "remove": [ISIN, …] }` (purge) — au moins un champ.
- `GET /api/prices` — surcouche de prix produits (lue par le portefeuille).
- `GET /api/levels` — surcouche de niveaux des sous-jacents (lue par les fiches).

> La variante **avec git** (script qui réécrit `lib/feed.json` puis `git push`)
> reste possible mais n'est plus le chemin par défaut.
