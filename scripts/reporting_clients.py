#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reporting clients — un PDF de valorisation par client à partir des positions du
dashboard (lib/feed.json). Conçu pour tourner :
  • ici (conteneur) pour produire les PDF du jour, puis te les envoyer ;
  • sur ta machine Windows chaque lundi, en écrivant directement dans le dossier
    OneDrive (et, en option, en préparant les brouillons Outlook).

Exemples :
  python3 scripts/reporting_clients.py --out ./reporting_clients
  py scripts\\reporting_clients.py --out "C:\\Users\\Laurent\\OneDrive\\Documents - Perso\\Claude\\Reporting Clients"

Dépend de fpdf2 :  pip install fpdf2
"""
import argparse, json, os, re, datetime, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

# ── Enrichissement best-effort depuis products.ts (émetteur / dates / type) ──
def product_meta(products_ts_path):
    """Carte ISIN -> {emetteur, dateEmission, dateEcheance, productType}. Parse
    par blocs : on lit chaque 'isin:' puis on récupère les champs voisins jusqu'au
    prochain produit. Tolérant : un champ manquant reste vide."""
    try:
        txt = open(products_ts_path, encoding="utf-8").read()
    except OSError:
        return {}
    lines = txt.split("\n")
    meta = {}
    cur = None
    fields = {
        "emetteur": re.compile(r"emetteur:\s*'([^']*)'"),
        "dateEmission": re.compile(r"dateEmission:\s*'([^']*)'"),
        "dateEcheance": re.compile(r"dateEcheance:\s*'([^']*)'"),
        "productType": re.compile(r"productType:\s*'([^']*)'"),
    }
    isin_re = re.compile(r"\bisin:\s*'([A-Z0-9]{8,14})'")
    for ln in lines:
        m = isin_re.search(ln)
        if m:
            cur = m.group(1)
            meta.setdefault(cur, {})
            continue
        if cur:
            for k, rx in fields.items():
                if k not in meta[cur]:
                    mm = rx.search(ln)
                    if mm:
                        meta[cur][k] = mm.group(1)
    return meta

ISSUER_SHORT = {
    "BNP Paribas": "BNP", "BNP Paribas Issuance B.V.": "BNP",
    "Goldman Sachs": "GS", "Goldman Sachs International": "GS",
    "Morgan Stanley": "MSCO", "Morgan Stanley B.V.": "MSCO",
    "Banco Santander S.A.": "Santander", "Santander International Products Plc": "Santander",
    "Société Générale": "SG", "Societe Generale": "SG",
    "Marex Financial Products plc": "Marex", "Marex Financial": "Marex",
}
def issuer_short(name):
    if not name: return "—"
    if name in ISSUER_SHORT: return ISSUER_SHORT[name]
    return name.split()[0]

def to_fr_date(iso):
    if not iso: return "—"
    try:
        d = datetime.date.fromisoformat(iso[:10])
        return d.strftime("%d/%m/%y")
    except ValueError:
        return "—"

def years_between(a, b):
    try:
        da = datetime.date.fromisoformat((a or "")[:10])
        db = datetime.date.fromisoformat((b or "")[:10])
        return max(1, round((db - da).days / 365.25))
    except ValueError:
        return None

CLOSED = {"rappele", "vendu", "echu"}

def eur(n):
    try:
        return f"{n:,.0f}".replace(",", " ")
    except (TypeError, ValueError):
        return "—"

# ── Génération PDF (fpdf2) ────────────────────────────────────────────────
from fpdf import FPDF

NAVY = (11, 31, 58)        # cmf-navy
BLUE = (37, 99, 235)
GREY = (90, 100, 115)
LIGHT = (238, 241, 246)

_TYPO = {"—": "-", "–": "-", "’": "'", "‘": "'",
         "“": '"', "”": '"', "…": "...", "€": "EUR", " ": " "}
def safe(s):
    # fpdf core fonts = latin-1 : on normalise la typographie puis on remplace
    # les éventuels caractères restants hors jeu.
    s = "" if s is None else str(s)
    for k, v in _TYPO.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")

def build_pdf(client, positions, meta, logo, out_path, asof):
    pdf = FPDF(orientation="L", unit="mm", format="A4")  # paysage (7+ colonnes)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    W = pdf.w - 20  # largeur utile (marges 10/10)
    # En-tête
    if logo and os.path.exists(logo):
        try: pdf.image(logo, x=10, y=10, w=18, h=18)
        except Exception: pass
    pdf.set_xy(30, 10)
    pdf.set_fill_color(*NAVY); pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 15)
    pdf.cell(W - 20, 9, safe(f"  {client}"), border=0, fill=True, ln=2)
    pdf.set_x(30); pdf.set_font("Helvetica", "B", 11)
    pdf.cell(W - 20, 8, safe(f"  Valorisation au {asof}"), border=0, fill=True, ln=1)
    pdf.ln(6)

    # Colonnes : ISIN+Desc | Émetteur | Dev | Émission | Maturité | Notionnel | Prix | Valeur
    cols = [("Produit", 95, "L"), ("Émetteur", 26, "L"), ("Dev", 14, "C"),
            ("Émission", 22, "C"), ("Maturité", 22, "C"),
            ("Notionnel", 32, "R"), ("Prix", 20, "R"), ("Valeur", 36, "R")]
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_fill_color(*NAVY); pdf.set_text_color(255, 255, 255)
    for title, w, _ in cols:
        pdf.cell(w, 7, safe(title), border=0, align="C", fill=True)
    pdf.ln(7)

    tot_notional = 0.0
    tot_value = 0.0
    pdf.set_text_color(30, 35, 45)
    fill = False
    for p in positions:
        isin = p.get("isin", "")
        m = meta.get(isin, {})
        desc = p.get("description") or ""
        dev = p.get("devise") or "EUR"
        amount = p.get("amount") or 0
        last = p.get("last")
        value = (amount * last / 100.0) if isinstance(last, (int, float)) else None
        tot_notional += amount or 0
        if value is not None: tot_value += value
        emis = to_fr_date(m.get("dateEmission"))
        y = years_between(m.get("dateEmission"), m.get("dateEcheance"))
        mat = f"{y} Ans" if y else "—"
        prix = f"{last:.2f}".replace(".", ",") if isinstance(last, (int, float)) else "—"

        # hauteur de ligne = 2 sous-lignes (ISIN gras + description)
        h = 9
        pdf.set_fill_color(*(LIGHT if fill else (255, 255, 255)))
        x0, y0 = pdf.get_x(), pdf.get_y()
        # colonne Produit (deux lignes)
        pdf.multi_cell(cols[0][1], h/2, "", border=0, fill=True)  # fond
        pdf.set_xy(x0, y0)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(cols[0][1], h/2, safe(" " + isin), border=0, ln=2, fill=False)
        pdf.set_font("Helvetica", "", 7.5); pdf.set_text_color(*GREY)
        pdf.cell(cols[0][1], h/2, safe(" " + desc[:70]), border=0, ln=0, fill=False)
        pdf.set_text_color(30, 35, 45)
        pdf.set_xy(x0 + cols[0][1], y0)
        # autres colonnes (centrées verticalement)
        vals = [issuer_short(m.get("emetteur")), dev, emis, mat, eur(amount), prix, eur(value)]
        pdf.set_font("Helvetica", "", 8)
        for (title, w, align), v in zip(cols[1:], vals):
            pdf.cell(w, h, safe(v), border=0, align=align, fill=True)
        pdf.ln(h)
        # filet
        pdf.set_draw_color(225, 228, 234)
        pdf.line(10, pdf.get_y(), 10 + W, pdf.get_y())
        fill = not fill

    # Totaux
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(*LIGHT); pdf.set_text_color(*NAVY)
    label_w = cols[0][1] + cols[1][1] + cols[2][1] + cols[3][1] + cols[4][1]
    pdf.cell(label_w, 8, safe("  TOTAL"), border=0, align="L", fill=True)
    pdf.cell(cols[5][1], 8, safe(eur(tot_notional)), border=0, align="R", fill=True)
    pdf.cell(cols[6][1], 8, "", border=0, fill=True)
    pdf.cell(cols[7][1], 8, safe(eur(tot_value)), border=0, align="R", fill=True)
    pdf.ln(12)

    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(120, 128, 140)
    pdf.multi_cell(W, 4, safe(
        "Capital Management France — document d'information. Valorisation = prix de marché (% du pair) x notionnel. "
        "Prix indicatifs (dernier cours connu). Ce document ne constitue ni un conseil ni une sollicitation."))
    pdf.output(out_path)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.getcwd(), "reporting_clients"))
    ap.add_argument("--feed", default=os.path.join(ROOT, "lib", "feed.json"))
    ap.add_argument("--commissions", default=os.path.join(ROOT, "lib", "commissions.json"))
    ap.add_argument("--products", default=os.path.join(ROOT, "lib", "products.ts"))
    ap.add_argument("--logo", default=os.path.join(ROOT, "public", "cmf-logo.png"))
    ap.add_argument("--include-closed", action="store_true",
                    help="inclure les positions clôturées (rappelé/vendu/échu)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    feed = load_json(args.feed)
    meta = product_meta(args.products)
    # Repli depuis commissions.json (émetteur + date d'émission) pour les ISIN
    # dont la définition products.ts est absente/partielle.
    try:
        for l in load_json(args.commissions).get("lignes", []):
            i = l.get("isin")
            if not i:
                continue
            m = meta.setdefault(i, {})
            if l.get("emetteur") and not m.get("emetteur"):
                m["emetteur"] = l["emetteur"]
            if l.get("issue") and not m.get("dateEmission"):
                m["dateEmission"] = l["issue"]
    except OSError:
        pass
    asof = datetime.date.today().strftime("%d/%m/%Y")

    by_client = {}
    for p in feed:
        c = p.get("client")
        if not c or p.get("isin") == "FEI":
            continue
        if not args.include_closed and (p.get("statut") in CLOSED):
            continue
        by_client.setdefault(c, []).append(p)

    def slug(s):
        return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")

    written = []
    for client in sorted(by_client):
        positions = sorted(by_client[client], key=lambda x: -(x.get("amount") or 0))
        fname = f"{slug(client)}_valorisation_{datetime.date.today().isoformat()}.pdf"
        path = os.path.join(args.out, fname)
        build_pdf(client, positions, meta, args.logo, path, asof)
        written.append((client, fname, len(positions)))

    print(f"OK — {len(written)} PDF générés dans : {args.out}")
    for c, f, n in written:
        print(f"  {c:30s} {n:>2d} pos  ->  {f}")

if __name__ == "__main__":
    sys.exit(main())
