# Reporting clients — valorisation PDF par client

Génère **un PDF de valorisation par client** à partir des positions du dashboard
(`lib/feed.json`, enrichi par `lib/products.ts` et `lib/commissions.json`).

Script : [`scripts/reporting_clients.py`](../scripts/reporting_clients.py).

## Pré-requis (une fois)

- Python 3 installé.
- `pip install fpdf2`

## Générer les PDF (ex. chaque lundi)

Sous Windows, en écrivant directement dans le dossier OneDrive :

```powershell
py scripts\reporting_clients.py --out "C:\Users\Laurent\OneDrive\Documents - Perso\Claude\Reporting Clients"
```

- 1 fichier par client : `CLIENT_valorisation_AAAA-MM-JJ.pdf`.
- Par défaut, seules les positions **vivantes** sont incluses. Ajouter
  `--include-closed` pour inclure rappelé / vendu / échu.
- Le dossier de sortie est créé s'il n'existe pas.

Le PDF contient, par position : ISIN + description, émetteur, devise, date
d'émission, maturité, notionnel, prix de marché (% du pair) et valeur (€), plus
un total. Les prix sont les derniers cours connus du feed.

## Automatisation hebdomadaire (lundi)

1. **Planificateur de tâches Windows** → nouvelle tâche, déclencheur
   « chaque lundi 08:00 », action : lancer la commande `py …` ci-dessus.
2. **Envoi Outlook** : phase 2 (voir ci-dessous) — un script complémentaire
   créera un mail par client avec son PDF en pièce jointe, en utilisant le
   carnet d'adresses (`mailing` dans `lib/commissions.json`).

> Remarque : la génération et l'envoi doivent tourner **sur la machine de
> Laurent** (seule à voir le OneDrive local et l'Outlook de bureau).
