#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collecte des prix mark-to-market des produits structurés depuis Bloomberg
(Desktop API / BLPAPI) et met à jour lib/feed.json (colonne `last`, en % du pair).

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
  python scripts/bloomberg_prices.py --host 127.0.0.1 --port 8194

Prix retenu (en % du pair) : PX_LAST, sinon PX_MID, sinon (PX_BID+PX_ASK)/2,
sinon PX_BID. Les positions rappelées / vendues / échues sont ignorées (sauf --all).

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
FIELDS = ["PX_LAST", "PX_MID", "PX_BID", "PX_ASK"]
CLOSED = {"rappele", "vendu", "echu"}


def pick_price(fd) -> float | None:
    """Choisit le meilleur prix disponible dans le fieldData d'un titre."""
    def g(name):
        return fd.getElementAsFloat(name) if fd.hasElement(name) else None
    last, mid, bid, ask = g("PX_LAST"), g("PX_MID"), g("PX_BID"), g("PX_ASK")
    if last:
        return last
    if mid:
        return mid
    if bid and ask:
        return (bid + ask) / 2
    return bid


def fetch_prices(isins, host: str, port: int) -> dict[str, float | None]:
    opts = blpapi.SessionOptions()
    opts.setServerHost(host)
    opts.setServerPort(port)
    session = blpapi.Session(opts)
    if not session.start():
        sys.exit("Impossible de démarrer la session BLPAPI (Terminal lancé/loggé ?).")
    if not session.openService("//blp/refdata"):
        sys.exit("Service //blp/refdata indisponible.")
    refdata = session.getService("//blp/refdata")

    out: dict[str, float | None] = {}
    # Bloomberg limite la taille des requêtes : on découpe par paquets.
    for batch in (isins[i : i + 50] for i in range(0, len(isins), 50)):
        req = refdata.createRequest("ReferenceDataRequest")
        for isin in batch:
            req.getElement("securities").appendValue(f"/isin/{isin}")
        for f in FIELDS:
            req.getElement("fields").appendValue(f)
        session.sendRequest(req)
        while True:
            ev = session.nextEvent(500)
            for msg in ev:
                if not msg.hasElement("securityData"):
                    continue
                arr = msg.getElement("securityData")
                for j in range(arr.numValues()):
                    sd = arr.getValueAsElement(j)
                    isin = sd.getElementAsString("security").rsplit("/", 1)[-1]
                    if sd.hasElement("securityError"):
                        out[isin] = None
                        continue
                    price = pick_price(sd.getElement("fieldData"))
                    out[isin] = round(price, 4) if price else None
            if ev.eventType() == blpapi.Event.RESPONSE:
                break
    session.stop()
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="affiche sans écrire")
    ap.add_argument("--all", action="store_true", help="inclut les positions clôturées")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8194)
    args = ap.parse_args()

    feed = json.loads(FEED.read_text(encoding="utf-8"))
    isins = sorted({r["isin"] for r in feed if args.all or r.get("statut") not in CLOSED})
    print(f"{len(isins)} ISIN à interroger sur Bloomberg…")

    prices = fetch_prices(isins, args.host, args.port)
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
