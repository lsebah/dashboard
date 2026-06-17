#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collecte des prix mark-to-market des produits structurés depuis Bloomberg
(Desktop API / BLPAPI) et met à jour lib/feed.json (colonne `last`, en % du pair).

Réplique la formule Excel maison :
  =BDP(isin & "@" & source & " Corp"; "PR005")  pour une liste de sources de prix,
  en retenant la PREMIÈRE source qui renvoie un nombre (ordre de priorité).

À LANCER SUR LE PC CONNECTÉ AU TERMINAL BLOOMBERG (session ouverte/loggée).

Pré-requis :
  1. Terminal Bloomberg lancé et connecté (le service local « bbcomm » tourne).
  2. Python 3.9+.
  3. Le paquet blpapi (API Desktop) :
       python -m pip install --index-url=https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi
  4. Le dépôt cloné (ce script lit/écrit lib/feed.json en relatif).

Usage :
  python scripts/bloomberg_prices.py               # met à jour lib/feed.json
  python scripts/bloomberg_prices.py --dry-run     # affiche, n'écrit rien
  python scripts/bloomberg_prices.py --all         # inclut les positions clôturées
  python scripts/bloomberg_prices.py --field PX_MID --host 127.0.0.1 --port 8194

Conformité : l'API Desktop est licenciée pour l'usage de l'utilisateur loggé
(valorisation de ton propre book). La redistribution de ces prix (publication
externe, reportings clients) peut relever du Data License Bloomberg — à cadrer
avec ton account manager avant diffusion.
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import blpapi  # type: ignore
except ImportError:
    sys.exit(
        "blpapi introuvable. Installe-le :\n"
        "  python -m pip install --index-url="
        "https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi"
    )

REPO = Path(__file__).resolve().parents[1]
FEED = REPO / "lib" / "feed.json"

# Sources de prix (mnémoniques contributeurs), DANS L'ORDRE DE PRIORITÉ — repris
# tel quel de la formule Excel. La première source qui renvoie un nombre gagne.
SOURCES = [
    "LEOZ", "BSED", "BRSP", "BBVL", "BNPA", "BPSN", "CIBX", "CGPP", "CICF",
    "DBXM", "GSSD", "MARE", "MLEQ", "MSIP", "NOMX", "BVAL", "BSEQ", "SGIN",
    "SGFR", "UBSF", "BPSP", "BPSL",
]
CLOSED = {"rappele", "vendu", "echu"}


def fetch_prices(isins, field: str, host: str, port: int) -> dict[str, float | None]:
    """Pour chaque ISIN, interroge <ISIN>@<SOURCE> Corp et garde la 1re source
    (ordre de priorité) qui renvoie une valeur numérique pour `field` (PR005)."""
    opts = blpapi.SessionOptions()
    opts.setServerHost(host)
    opts.setServerPort(port)
    session = blpapi.Session(opts)
    if not session.start():
        sys.exit("Impossible de démarrer la session BLPAPI (Terminal lancé/loggé ?).")
    if not session.openService("//blp/refdata"):
        sys.exit("Service //blp/refdata indisponible.")
    refdata = session.getService("//blp/refdata")

    # Toutes les combinaisons ISIN×source, requêtées par paquets.
    combos = [f"{isin}@{src} Corp" for isin in isins for src in SOURCES]
    raw: dict[str, float] = {}
    for start in range(0, len(combos), 100):
        batch = combos[start : start + 100]
        req = refdata.createRequest("ReferenceDataRequest")
        for sec in batch:
            req.getElement("securities").appendValue(sec)
        req.getElement("fields").appendValue(field)
        session.sendRequest(req)
        while True:
            ev = session.nextEvent(500)
            for msg in ev:
                if not msg.hasElement("securityData"):
                    continue
                arr = msg.getElement("securityData")
                for j in range(arr.numValues()):
                    sd = arr.getValueAsElement(j)
                    name = sd.getElementAsString("security")  # "<ISIN>@<SRC> Corp"
                    if sd.hasElement("securityError"):
                        continue
                    fd = sd.getElement("fieldData")
                    if fd.hasElement(field):
                        try:
                            raw[name] = fd.getElementAsFloat(field)
                        except Exception:
                            pass
            if ev.eventType() == blpapi.Event.RESPONSE:
                break
    session.stop()

    out: dict[str, float | None] = {}
    for isin in isins:
        val = None
        for src in SOURCES:  # priorité : première source numérique
            v = raw.get(f"{isin}@{src} Corp")
            if isinstance(v, (int, float)):
                val = round(v, 4)
                break
        out[isin] = val
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="affiche sans écrire")
    ap.add_argument("--all", action="store_true", help="inclut les positions clôturées")
    ap.add_argument("--field", default="PR005", help="champ de prix (déf. PR005)")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8194)
    args = ap.parse_args()

    feed = json.loads(FEED.read_text(encoding="utf-8"))
    isins = sorted({r["isin"] for r in feed if args.all or r.get("statut") not in CLOSED})
    print(f"{len(isins)} ISIN × {len(SOURCES)} sources à interroger sur Bloomberg…")

    prices = fetch_prices(isins, args.field, args.host, args.port)
    got = {k: v for k, v in prices.items() if v is not None}
    print(f"{len(got)} prix récupérés, {len(isins) - len(got)} sans prix.")

    updated = 0
    for r in feed:
        p = prices.get(r["isin"])
        if p is not None and (args.all or r.get("statut") not in CLOSED):
            if r.get("last") != p:
                updated += 1
            r["last"] = p
    print(f"{updated} positions mises à jour dans le feed.")

    missing = [i for i in isins if prices.get(i) is None]
    if missing:
        print("Sans prix Bloomberg :", ", ".join(missing))

    if args.dry_run:
        for i in isins:
            print(f"  {i}: {prices.get(i)}")
        return

    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nÉcrit {FEED}.\nVérifie le diff (git diff lib/feed.json) puis commit + push.")


if __name__ == "__main__":
    main()
