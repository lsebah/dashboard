# Reporting clients — valorisation PDF par client

Génère **un PDF de valorisation par client**, **strictement identique** au document
« Imprimer / Enregistrer en PDF » de l'app (en-tête CMF, récap produit, niveaux des
sous-jacents en % du strike avec le worst-of en gras, coupons versés).

Le PDF n'est **pas** redessiné : on imprime la route `/print` du dashboard via un
navigateur headless. C'est donc exactement le même composant (`ReportSheet`) et les
mêmes données live (niveaux Yahoo `/api/lifecycle/courant` + surcouche prix
Bloomberg/KV `/api/prices`) que dans l'app.

- Composant (source unique) : [`ClientReport.tsx` → `ReportSheet`](../app/lifecycle/components/ClientReport.tsx)
- Route d'impression : [`app/print/page.tsx`](../app/print/page.tsx) — `/print?client=<code>` (un client) ou `/print` (tous, un par page)
- Script d'export : [`scripts/reporting_clients.mjs`](../scripts/reporting_clients.mjs)

## Pré-requis (une fois)

- Node.js (déjà nécessaire pour le dashboard).
- `npm i -D puppeteer` (télécharge un Chromium isolé — déjà dans `devDependencies`).

## Générer les PDF (ex. chaque lundi)

L'app doit tourner (la route `/print` et les `/api/*` doivent répondre) :

```powershell
npm run build
npm run start                 # http://localhost:3000

# dans un autre terminal, écrit directement dans le dossier OneDrive :
node scripts/reporting_clients.mjs --out "C:\Users\Laurent\OneDrive\Documents - Perso\Claude\Reporting Clients"
```

- 1 fichier par client : `CLIENT_valorisation_AAAA-MM-JJ.pdf`.
- Seules les positions **vivantes et valorisées** sont incluses (mêmes règles que
  le reporting de l'app — cf. `lib/client-report.ts`).
- Le dossier de sortie est créé s'il n'existe pas.

Options :

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--out <dir>` | `./reporting_clients` | dossier de sortie |
| `--base-url <url>` | `http://localhost:3000` | URL de l'app |
| `--client <code>` | _(tous)_ | n'exporter qu'un seul client |

## Automatisation hebdomadaire (lundi)

1. **Planificateur de tâches Windows** → tâche « chaque lundi 08:00 » qui lance
   `npm run start` puis la commande `node scripts\reporting_clients.mjs …`.
2. **Envoi Outlook** (phase 2) : un script complémentaire créera un mail par client
   avec son PDF en pièce jointe, via le carnet d'adresses (`mailing` dans
   `lib/commissions.json`).

> La génération et l'envoi doivent tourner **sur la machine de Laurent** (seule à
> voir le OneDrive local, l'Outlook de bureau, et les données live de l'app).
