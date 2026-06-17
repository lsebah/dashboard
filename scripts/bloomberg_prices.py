#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collecte des prix mark-to-market des produits structurés depuis Bloomberg
(Desktop API / BLPAPI) et les POSTe au dashboard (-> Vercel KV).

ROUTE SANS GIT : sur le PC Bloomberg, seuls Python + blpapi sont nécessaires.
Pas de dépôt cloné : la liste d'ISIN est récupérée depuis le dashboard, et les
prix lui sont renvoyés par HTTP. (urllib de la stdlib : pas besoin de `requests`.)

Réplique la formule Excel maison :
  =BDP(isin & "@" & source & " Corp"; "PR005")  sur une liste de sources,
  en retenant la PREMIÈRE source qui renvoie un nombre (ordre de priorité).

Pré-requis :
  1. Terminal Bloomberg lancé et connecté (service local « bbcomm »).
  2. Python 3.9+.
  3. blpapi :
       python -m pip install --user --index-url https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi
  4. L'URL du dashboard + la clé PRICES_API_KEY (définie dans Vercel).

Usage (PowerShell) :
  $env:DASHBOARD_URL = "https://ton-domaine.vercel.app"
  $env:PRICES_API_KEY = "********"
  python bloomberg_prices.py --dry-run     # interroge Bloomberg, n'envoie rien
  python bloomberg_prices.py               # POSTe les prix au dashboard

Conformité : l'API Desktop est licenciée pour l'usage de l'utilisateur loggé
(valorisation de ton propre book). La redistribution de ces prix (publication
externe, reportings clients) peut relever du Data License Bloomberg — à cadrer
avec ton account manager avant diffusion.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

try:
    import blpapi  # type: ignore
except ImportError:
    sys.exit(
        "blpapi introuvable. Installe-le :\n"
        "  python -m pip install --user --index-url "
        "https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi"
    )

# Sources de prix (mnémoniques contributeurs), DANS L'ORDRE DE PRIORITÉ — repris
# tel quel de la formule Excel. La première source qui renvoie un nombre gagne.
SOURCES = [
    "LEOZ", "BSED", "BRSP", "BBVL", "BNPA", "BPSN", "CIBX", "CGPP", "CICF",
    "DBXM", "GSSD", "MARE", "MLEQ", "MSIP", "NOMX", "BVAL", "BSEQ", "SGIN",
    "SGFR", "UBSF", "BPSP", "BPSL",
]


def http_get_json(url: str, headers: dict | None = None):
    req = urllib.request.Request(url)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"GET {url} échoué ({e.code}) : {e.read().decode('utf-8', 'replace')[:300]}")


def http_post_json(url: str, payload: dict, headers: dict):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"POST échoué ({e.code}) : {e.read().decode('utf-8', 'replace')[:300]}")


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
    ap.add_argument("--dashboard-url", default=os.environ.get("DASHBOARD_URL"))
    ap.add_argument("--api-key", default=os.environ.get("PRICES_API_KEY"))
    # Jeton « Protection Bypass for Automation » (si le déploiement est protégé
    # par Vercel Authentication). Env : VERCEL_AUTOMATION_BYPASS_SECRET.
    ap.add_argument("--bypass", default=os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET"))
    ap.add_argument("--dry-run", action="store_true", help="interroge Bloomberg, n'envoie rien")
    ap.add_argument("--field", default="PR005", help="champ de prix (déf. PR005)")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8194)
    args = ap.parse_args()

    if not args.dashboard_url:
        sys.exit("Renseigne --dashboard-url ou la variable DASHBOARD_URL (ex. https://...vercel.app).")
    base = args.dashboard_url.rstrip("/")

    # En-tête commun : contourne la protection Vercel pour l'automatisation.
    bypass = {"x-vercel-protection-bypass": args.bypass} if args.bypass else {}

    print("Récupération de la liste d'ISIN depuis le dashboard…")
    isins = http_get_json(base + "/api/isins", bypass).get("isins", [])
    if not isins:
        sys.exit("Aucun ISIN renvoyé par /api/isins.")
    print(f"{len(isins)} ISIN × {len(SOURCES)} sources — interrogation Bloomberg (champ {args.field})…")

    prices = fetch_prices(isins, args.field, args.host, args.port)
    got = {k: v for k, v in prices.items() if v is not None}
    print(f"{len(got)} prix récupérés, {len(isins) - len(got)} sans prix.")
    missing = [i for i in isins if prices.get(i) is None]
    if missing:
        print("Sans prix Bloomberg :", ", ".join(missing))

    if args.dry_run:
        for i in isins:
            print(f"  {i}: {prices.get(i)}")
        print("\n[dry-run] rien envoyé au dashboard.")
        return

    if not args.api_key:
        sys.exit("Renseigne --api-key ou la variable PRICES_API_KEY pour poster les prix.")
    res = http_post_json(
        base + "/api/prices/ingest",
        {"prices": got},
        {"x-prices-api-key": args.api_key, **bypass},
    )
    print("Réponse dashboard :", json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
