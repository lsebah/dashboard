# Agent veille « Décrément » — configuration (Vercel Cron + Microsoft Graph)

Le cron `/api/cron/decrement` lit chaque jour le dossier Outlook **Emetteurs ▸ Décrement**
de `l.sebah@cmf.finance`, classe les mails (nouveaux indices vs runs de prix), et écrit
l'état dans Vercel KV. Le dashboard (`/lifecycle2/comparatif`) lit cet état via
`/api/decrement/monitoring`.

## 1. Planification
`vercel.json` déclenche le cron à **17:00 UTC = 19:00 Paris (heure d'été)**.
En hiver (CET) cela correspond à 18:00 Paris — ajuster à `0 18 * * *` si besoin.

## 2. App registration Azure (lecture mail app-only)
1. Azure Portal → *App registrations* → *New registration*.
2. *API permissions* → Microsoft Graph → **Application** → **Mail.Read** → *Grant admin consent*.
   - (Optionnel : restreindre l'accès à la seule BAL via *Application Access Policy*.)
3. *Certificates & secrets* → *New client secret*.
4. Récupérer **Tenant ID**, **Client ID**, **Client secret**.

## 3. Vercel KV
Vercel → projet → *Storage* → *Create KV*. Les variables `KV_REST_API_URL` et
`KV_REST_API_TOKEN` sont injectées automatiquement.

## 4. Variables d'environnement (Vercel → Settings → Environment Variables)
| Variable | Valeur |
| --- | --- |
| `GRAPH_TENANT_ID` | Tenant ID Azure |
| `GRAPH_CLIENT_ID` | Client ID de l'app |
| `GRAPH_CLIENT_SECRET` | Client secret |
| `CRON_SECRET` | chaîne aléatoire (Vercel l'envoie en `Authorization: Bearer` au cron) |
| `DECREMENT_MAILBOX` | `l.sebah@cmf.finance` (défaut) |
| `DECREMENT_FOLDER_ID` | id du dossier Décrément (défaut déjà câblé) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | fournis par Vercel KV |

## 5. Test manuel
```
curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/decrement
```
Réponse : `{ ok, nouveaux, majs, persisted, classified[] }`. Le dashboard se met à jour.

## État actuel
- Sans ces variables, le cron renvoie `503` (et le dashboard affiche le dernier scan versionné).
- **À venir (itératif)** : extraction des niveaux coupon/upfront par émetteur dans `lib/decrement/parser.ts`
  pour alimenter automatiquement la base comparatif (`lib/decrement-comparatif.json`).
