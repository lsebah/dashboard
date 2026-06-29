#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collecte des prix mark-to-market des produits structurés (PR005 par ISIN) ET des
niveaux des sous-jacents (PX_Last par ticker) depuis Bloomberg (Desktop API /
BLPAPI), puis les POSTe au dashboard (-> Vercel KV).

ROUTE SANS GIT : sur le PC Bloomberg, seuls Python + blpapi sont nécessaires.
Pas de dépôt cloné : les listes (ISIN + sous-jacents) sont récupérées depuis le
dashboard, et les valeurs lui sont renvoyées par HTTP. (urllib de la stdlib.)

Réplique tes formules Excel :
  • Prix produit  : =BDP(isin & "@" & source & " Corp"; "PR005")  sur la liste de
    sources, 1re source numérique gagne.
  • Niveau sous-j : =BDP(ticker [+ " Index"/" Equity" si absent]; "PX_Last").

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
  python bloomberg_prices.py               # POSTe prix + niveaux au dashboard
  python bloomberg_prices.py --no-levels   # prix produits uniquement

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


def http_get_json(url, headers=None):
    req = urllib.request.Request(url)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"GET {url} echoue ({e.code}) : {e.read().decode('utf-8', 'replace')[:300]}")


def http_post_json(url, payload, headers):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"POST echoue ({e.code}) : {e.read().decode('utf-8', 'replace')[:300]}")


def open_session(host, port):
    opts = blpapi.SessionOptions()
    opts.setServerHost(host)
    opts.setServerPort(port)
    session = blpapi.Session(opts)
    if not session.start():
        sys.exit("Impossible de demarrer la session BLPAPI (Terminal lance/logge ?).")
    if not session.openService("//blp/refdata"):
        sys.exit("Service //blp/refdata indisponible.")
    return session


def bdp(session, securities, field):
    """ReferenceDataRequest pour une liste de securities -> {security: float}."""
    refdata = session.getService("//blp/refdata")
    out = {}
    for start in range(0, len(securities), 100):
        batch = securities[start : start + 100]
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
                    name = sd.getElementAsString("security")
                    if sd.hasElement("securityError"):
                        continue
                    fd = sd.getElement("fieldData")
                    if fd.hasElement(field):
                        try:
                            out[name] = fd.getElementAsFloat(field)
                        except Exception:
                            pass
            if ev.eventType() == blpapi.Event.RESPONSE:
                break
    return out


def fetch_prices(session, isins, field):
    """Pour chaque ISIN, 1re source (ordre de priorite) qui renvoie un nombre."""
    combos = [f"{isin}@{src} Corp" for isin in isins for src in SOURCES]
    raw = bdp(session, combos, field)
    out = {}
    for isin in isins:
        val = None
        for src in SOURCES:
            v = raw.get(f"{isin}@{src} Corp")
            if isinstance(v, (int, float)):
                val = round(v, 4)
                break
        out[isin] = val
    return out


def bbg_security(ticker):
    """Reproduit ta formule Excel : ajoute le yellow-key si absent.
    Deja ' Index'/' Equity'/' Comdty'/' Curncy' -> tel quel ;
    sinon contient 'Index' -> ' Index' ; sinon -> ' Equity'."""
    t = (ticker or "").strip()
    low = t.lower()
    if any(s in low for s in (" index", " equity", " comdty", " curncy")):
        return t
    return t + (" Index" if "index" in low else " Equity")


def fetch_levels(session, tickers, field="PX_LAST"):
    """PX_Last par ticker Bloomberg (sous-jacents)."""
    secs = {t: bbg_security(t) for t in tickers}
    raw = bdp(session, list(dict.fromkeys(secs.values())), field)
    out = {}
    for t, sec in secs.items():
        v = raw.get(sec)
        if isinstance(v, (int, float)):
            out[t] = round(v, 4)
    return out


def fetch_index_levels(session, tickers, field="PX_LAST"):
    """Niveau (PX_Last) des indices a decrement — yellow-key ' Index' force
    (les codes type CNFSPT / GOLDM50 ne contiennent pas 'index')."""
    secs = {t: (t if " index" in t.lower() else t + " Index") for t in tickers}
    raw = bdp(session, list(dict.fromkeys(secs.values())), field)
    out = {}
    for t, sec in secs.items():
        v = raw.get(sec)
        if isinstance(v, (int, float)):
            out[t] = round(v, 4)
    return out


def _index_security(t):
    """Ajoute ' Index' sauf si le ticker porte deja un yellow-key."""
    low = (t or "").strip().lower()
    if any(s in low for s in (" index", " equity", " comdty", " curncy")):
        return t.strip()
    return t.strip() + " Index"


def bdh_at(session, security, yyyymmdd, field="PX_LAST"):
    """Niveau historique a UNE date (HistoricalDataRequest) -> float | None.
    Remplit par la derniere valeur connue si la date est un jour non ouvre."""
    refdata = session.getService("//blp/refdata")
    req = refdata.createRequest("HistoricalDataRequest")
    req.getElement("securities").appendValue(security)
    req.getElement("fields").appendValue(field)
    req.set("startDate", yyyymmdd)
    req.set("endDate", yyyymmdd)
    req.set("nonTradingDayFillOption", "ALL_CALENDAR_DAYS")
    req.set("nonTradingDayFillMethod", "PREVIOUS_VALUE")
    session.sendRequest(req)
    val = None
    while True:
        ev = session.nextEvent(30000)
        for msg in ev:
            if not msg.hasElement("securityData"):
                continue
            sd = msg.getElement("securityData")
            if sd.hasElement("fieldData"):
                fd = sd.getElement("fieldData")
                if fd.numValues() > 0:
                    row = fd.getValueAsElement(fd.numValues() - 1)
                    if row.hasElement(field):
                        try:
                            val = row.getElementAsFloat(field)
                        except Exception:
                            pass
        if ev.eventType() == blpapi.Event.RESPONSE:
            break
    return val


def fetch_strikes(session, needed, field="PX_LAST"):
    """needed = [{isin, ticker, date 'YYYY-MM-DD'}] -> {isin: {ticker,date,value}}.
    Niveau de l'indice a la date de constatation initiale (= strike)."""
    out = {}
    for r in needed:
        sec = _index_security(r.get("ticker", ""))
        d = (r.get("date") or "").replace("-", "")
        if not sec or len(d) != 8:
            continue
        v = bdh_at(session, sec, d, field)
        if isinstance(v, (int, float)):
            out[r["isin"]] = {"ticker": r["ticker"], "date": r["date"], "value": round(v, 4)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dashboard-url", default=os.environ.get("DASHBOARD_URL"))
    ap.add_argument("--api-key", default=os.environ.get("PRICES_API_KEY"))
    # Jeton « Protection Bypass for Automation » (si le déploiement est protégé).
    ap.add_argument("--bypass", default=os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET"))
    ap.add_argument("--dry-run", action="store_true", help="interroge Bloomberg, n'envoie rien")
    ap.add_argument("--no-levels", action="store_true", help="prix produits uniquement")
    ap.add_argument("--no-decrement", action="store_true", help="ne pas pricer les indices a decrement")
    ap.add_argument("--field", default="PR005", help="champ de prix produit (def. PR005)")
    ap.add_argument("--level-field", default="PX_LAST", help="champ de niveau sous-jacent (def. PX_LAST)")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8194)
    args = ap.parse_args()

    if not args.dashboard_url:
        sys.exit("Renseigne --dashboard-url ou DASHBOARD_URL (ex. https://...vercel.app).")
    base = args.dashboard_url.rstrip("/")
    bypass = {"x-vercel-protection-bypass": args.bypass} if args.bypass else {}

    print("Recuperation des listes (ISIN + sous-jacents) depuis le dashboard...")
    isins = http_get_json(base + "/api/isins", bypass).get("isins", [])
    if not isins:
        sys.exit("Aucun ISIN renvoye par /api/isins.")
    tickers = []
    if not args.no_levels:
        tickers = http_get_json(base + "/api/underlyings", bypass).get("underlyings", [])
    decr_tickers = []
    strikes_needed = []
    if not args.no_levels and not args.no_decrement:
        decr_tickers = http_get_json(base + "/api/decrement/tickers", bypass).get("tickers", [])
        strikes_needed = http_get_json(base + "/api/decrement/strikes-needed", bypass).get("strikes", [])

    session = open_session(args.host, args.port)

    print(f"{len(isins)} ISIN x {len(SOURCES)} sources - prix produits (champ {args.field})...")
    prices = fetch_prices(session, isins, args.field)
    got = {k: v for k, v in prices.items() if v is not None}
    print(f"{len(got)} prix produits, {len(isins) - len(got)} sans prix.")
    missing = [i for i in isins if prices.get(i) is None]
    if missing:
        print("Sans prix Bloomberg :", ", ".join(missing))

    levels = {}
    if tickers:
        print(f"{len(tickers)} sous-jacents - niveaux (champ {args.level_field})...")
        levels = fetch_levels(session, tickers, args.level_field)
        print(f"{len(levels)} niveaux, {len(tickers) - len(levels)} sans niveau.")
        miss_l = [t for t in tickers if t not in levels]
        if miss_l:
            print("Sans niveau Bloomberg :", ", ".join(miss_l))

    # Indices a decrement (CNFSPT, GOLDM50, …) → niveau courant, meme surcouche.
    if decr_tickers:
        print(f"{len(decr_tickers)} indices decrement - niveaux (champ {args.level_field})...")
        decr_levels = fetch_index_levels(session, decr_tickers, args.level_field)
        print(f"{len(decr_levels)} niveaux indices, {len(decr_tickers) - len(decr_levels)} sans niveau.")
        miss_i = [t for t in decr_tickers if t not in decr_levels]
        if miss_i:
            print("Indices sans niveau Bloomberg :", ", ".join(miss_i))
        levels.update(decr_levels)

    # Strikes (valeurs initiales) manquants → niveau de l'indice a la date de strike.
    strikes = {}
    if strikes_needed:
        print(f"{len(strikes_needed)} strike(s) a recuperer (BDH historique)...")
        strikes = fetch_strikes(session, strikes_needed, args.level_field)
        print(f"{len(strikes)} strike(s) recuperes, {len(strikes_needed) - len(strikes)} sans valeur.")

    session.stop()

    if args.dry_run:
        for i in isins:
            print(f"  PRIX   {i}: {prices.get(i)}")
        for t in tickers:
            print(f"  NIVEAU {t}: {levels.get(t)}")
        print("\n[dry-run] rien envoye au dashboard.")
        return

    if not got and not levels and not strikes:
        print("Rien a envoyer (Bloomberg n'a renvoye aucune valeur) - POST ignore.")
        return

    if not args.api_key:
        sys.exit("Renseigne --api-key ou PRICES_API_KEY pour poster.")
    payload = {}
    if got:
        payload["prices"] = got
    if levels:
        payload["levels"] = levels
    if strikes:
        payload["strikes"] = strikes
    res = http_post_json(
        base + "/api/prices/ingest",
        payload,
        {"x-prices-api-key": args.api_key, **bypass},
    )
    print("Reponse dashboard :", json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
