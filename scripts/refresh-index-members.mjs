// ─────────────────────────────────────────────────────────────────────────
//  RAFRAÎCHISSEMENT MENSUEL DE LA COMPOSITION DES INDICES.
//
//  POURQUOI CE SCRIPT EXISTE — le radar de volatilité se lit sur les
//  COMPOSANTS d'un indice (lib/index-members.ts). Bloomberg le donnait par
//  `members('SX5E Index')` ; sans terminal, il faut aller le chercher chez des
//  sources publiques. Laurent a nommé les seules qu'il considère stables et
//  gratuites (20/08/2026) : stockanalysis.com pour le S&P 500 et le Dow, le CSV
//  de détention de l'ETF URTH d'iShares pour le MSCI World, live.euronext.com
//  pour le CAC 40, stoxx.com pour l'Euro Stoxx 50. MarketScreener et Yahoo
//  bloquent le scraping : ils ne sont volontairement pas utilisés ici.
//
//  LE PRINCIPE QUI GOUVERNE TOUT LE FICHIER : REFUSER PLUTÔT QU'ÉCRIRE DU FAUX.
//
//  Cette composition finit dans une planche client. Une page qui change de
//  forme ne rend pas une erreur : elle rend une liste vide, tronquée, ou pleine
//  de cellules décalées — et un scraper naïf écrase alors une bonne liste par
//  une mauvaise, en silence, avec un run vert. C'est exactement le scénario qui
//  a laissé l'index des termsheets figé un mois (voir scripts/audit-termsheets.mjs).
//
//  Chaque indice passe donc des GARDE-FOUS avant d'être écrit : un plancher de
//  membres plausible, un symbole qui ressemble à un symbole, et l'interdiction
//  d'une chute brutale par rapport à la liste déjà en place (un indice ne perd
//  pas le quart de ses membres en un mois ; une page qui change de forme, si).
//  Si un garde-fou saute, l'entrée EXISTANTE est laissée telle quelle — anciens
//  membres, ancienne date — et l'échec est rapporté. Un indice périmé se voit
//  (lib/index-members.ts affiche son âge) ; un indice faux, non.
//
//  MAPPAGE VERS YAHOO — l'app interroge Yahoo Finance, qui suffixe les places
//  européennes et asiatiques (.PA, .AS, .DE, .MC, .MI…). Le suffixe est déduit
//  de la place de cotation PUBLIÉE PAR LA SOURCE, jamais deviné : une valeur
//  dont on ne sait pas où elle cote est écartée et comptée dans « non mappés ».
//  Un mauvais suffixe ne donne pas une erreur, il donne le cours d'une AUTRE
//  société — c'est la pire panne possible ici.
//
//  Lancement : `node scripts/refresh-index-members.mjs` (Node 22, `fetch`
//  global, aucune dépendance npm, aucun secret).
//  Sortie : rapport lisible sur stdout, Markdown dans $GITHUB_STEP_SUMMARY,
//  et une dernière ligne `MEMBRES_ECHECS=<n>` que le workflow lit pour décider
//  quoi dire dans la pull request. Le code de sortie est TOUJOURS 0 : un
//  rapport ne doit jamais casser la CI.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'

const FICHIER = new URL('../data/index-members.json', import.meta.url)
const AUJOURDHUI = new Date().toISOString().slice(0, 10)

// ─────────────────────────────────────────────────────────────────────────
//  1. LES SOURCES, EN CLAIR
//
//  Plusieurs URL par indice quand la source expose à la fois un fragment de
//  données et une page : on essaie dans l'ordre et on garde la première qui
//  rend quelque chose d'exploitable. Ce n'est pas de la superstition — les
//  endpoints « ajax » d'Euronext et de STOXX ne sont pas contractuels, et une
//  page complète reste lisible quand le fragment disparaît.
// ─────────────────────────────────────────────────────────────────────────
const URL_SPX = 'https://stockanalysis.com/list/sp-500-stocks/'
const URL_DJIA = 'https://stockanalysis.com/list/dow-jones-stocks/'

// « Detailed Holdings and Analytics » d'iShares : le CSV quotidien de l'ETF
// URTH (iShares MSCI World). C'est la seule liste MSCI World publique et
// complète ; MSCI ne publie pas la sienne gratuitement.
const URL_URTH =
  'https://www.ishares.com/us/products/239696/ishares-msci-world-etf/1467271812596.ajax?fileType=csv&fileName=URTH_holdings&dataType=fund'

// CAC 40 : code indice PX1, ISIN FR0003500008, place XPAR.
const URLS_CAC = [
  'https://live.euronext.com/en/ajax/getIndexCompositionFilteredByIndexId/FR0003500008-XPAR/ALL',
  'https://live.euronext.com/en/product/indices/FR0003500008-XPAR/index-composition',
  'https://live.euronext.com/en/product/indices/FR0003500008-XPAR/market-information',
]

// Euro Stoxx 50 : fiche indice STOXX.
const URLS_SX5E = [
  'https://www.stoxx.com/index-details?symbol=SX5E',
  'https://www.stoxx.com/api/index/components?symbol=SX5E',
]

// ─────────────────────────────────────────────────────────────────────────
//  2. GARDE-FOUS
//
//  Les planchers sont posés SOUS la taille réelle de l'indice, assez bas pour
//  ne pas hurler à la moindre révision trimestrielle, assez haut pour qu'une
//  liste amputée par un changement de page ne passe jamais. Le Dow est à 30
//  valeurs, le CAC à 40, l'Euro Stoxx 50 à 50, le S&P 500 à ~503 lignes
//  (classes d'actions multiples), et URTH détient ~1 300 lignes.
// ─────────────────────────────────────────────────────────────────────────
const CHUTE_MAX = 0.25 // au-delà de -25 % vs la liste en place, on refuse
const PART_NON_MAPPES_MAX = 0.2 // au-delà de 20 % de valeurs non mappables, la source a changé de forme

// ─────────────────────────────────────────────────────────────────────────
//  3. PLACES DE COTATION → SUFFIXE YAHOO
//
//  Table volontairement séparée de lib/underlyings.ts : celle-là traduit des
//  suffixes BLOOMBERG (« FP », « GY »), qu'aucune de nos sources publiques
//  n'emploie. Ici on part de libellés de place en clair (« Euronext Paris »,
//  « Xetra », « SIX Swiss Exchange ») ou de pays. Deux vocabulaires différents,
//  donc deux tables — et pas d'import de lib/*.ts, qui obligerait à lancer ce
//  script avec le décodeur TypeScript alors qu'il doit rester du Node nu.
//
//  L'ordre compte : les règles européennes et asiatiques passent AVANT les
//  américaines, parce qu'iShares écrit « Nyse Euronext - Euronext Paris » et
//  que le mot « Nyse » y désignerait à tort une cotation américaine.
// ─────────────────────────────────────────────────────────────────────────
const PLACES = [
  [/nasdaq\s*omx\s*helsinki|helsinki/i, '.HE'],
  [/nasdaq\s*omx\s*stockholm|stockholm/i, '.ST'],
  [/nasdaq\s*omx\s*(copenhagen|copenhague)|copenhagen|copenhague|danemark|denmark/i, '.CO'],
  [/euronext\s*paris|bourse de paris|\bparis\b|\bfrance\b/i, '.PA'],
  [/euronext\s*amsterdam|amsterdam|netherlands|pays-bas|nederland/i, '.AS'],
  [/euronext\s*brussels|brussel|bruxelles|belgium|belgique/i, '.BR'],
  [/euronext\s*lisbon|lisbo|portugal/i, '.LS'],
  [/euronext\s*milan|borsa\s*italiana|milan|italy|italie|italia/i, '.MI'],
  [/xetra|deutsche\s*b(o|ö)erse|frankfurt|francfort|germany|allemagne|deutschland/i, '.DE'],
  [/six\s*swiss|swiss\s*exchange|zurich|switzerland|suisse/i, '.SW'],
  [/bolsa\s*de\s*madrid|madrid|\bbme\b|spain|espagne|españa/i, '.MC'],
  [/london\s*stock\s*exchange|\blse\b|londres|united kingdom|royaume-uni/i, '.L'],
  [/wiener|vienna|vienne|austria|autriche/i, '.VI'],
  [/oslo|norway|norvège|norvege/i, '.OL'],
  [/euronext\s*dublin|irish|dublin|ireland|irlande/i, '.IR'],
  [/tokyo|japan\s*exchange|\bjapan\b|japon/i, '.T'],
  [/hong\s*kong|hkex/i, '.HK'],
  [/singapore|singapour|\bsgx\b/i, '.SI'],
  [/australian\s*securities|\basx\b|australia|australie/i, '.AX'],
  [/new\s*zealand|\bnzx\b|nouvelle-zélande/i, '.NZ'],
  [/tel\s*aviv|\btase\b|israel|israël/i, '.TA'],
  // Places américaines et canadiennes en dernier (voir plus haut).
  [/toronto|\btsx\b|canada/i, '.TO'],
  [/nasdaq|new\s*york\s*stock\s*exchange|\bnyse\b|\bcboe\b|\bbats\b|\barca\b|nyse\s*mkt|united states|états-unis|etats-unis|\busa\b/i, ''],
]

/** Suffixe Yahoo d'une place. `null` = place inconnue : on n'invente pas. */
function suffixePlace(libelle) {
  const s = (libelle ?? '').trim()
  if (!s) return null
  for (const [motif, suffixe] of PLACES) if (motif.test(s)) return suffixe
  return null
}

// Les SEULS symboles réécrits à la main. Chacun est une divergence connue et
// vérifiée entre le code de la source et celui de Yahoo — lib/underlyings.ts
// porte déjà les deux dernières, confirmées par Laurent. Rien d'autre n'est
// retouché : hors de cette liste, le symbole de la source est pris tel quel.
const REECRITURES = {
  BRKB: 'BRK-B', // Berkshire Hathaway B
  BFB: 'BF-B', // Brown-Forman B
  LENB: 'LEN-B', // Lennar B
  NOVOB: 'NOVO-B', // Novo Nordisk B (Copenhague)
  ROG: 'RO', // Roche (SIX) — cf. lib/underlyings.ts
}

// Suffixe de place BLOOMBERG → suffixe Yahoo. Cette table-là existe déjà dans
// lib/underlyings.ts ; elle est recopiée plutôt qu'importée parce que ce script
// doit tourner sous Node nu, sans le décodeur TypeScript. Elle sert au seul cas
// où une source publie un code de type « SAP GY » : la place y est déjà écrite,
// autant la lire que la deviner.
const SUFFIXE_BLOOMBERG = {
  FP: '.PA',
  IM: '.MI',
  GY: '.DE',
  GR: '.DE',
  SW: '.SW',
  SE: '.SW',
  LN: '.L',
  NA: '.AS',
  SM: '.MC',
  BB: '.BR',
  DC: '.CO',
  PL: '.LS',
  AV: '.VI',
  FH: '.HE',
  SS: '.ST',
  NO: '.OL',
  ID: '.IR',
  US: '',
  UN: '',
  UW: '',
  UQ: '',
  UP: '',
  UA: '',
}

// Un symbole de source acceptable avant mappage, puis un symbole Yahoo
// acceptable après. Le second filtre est le vrai garde-fou : il attrape aussi
// bien une cellule décalée (« 1 234,56 ») qu'un suffixe mal recollé.
const TICKER_SOURCE = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/
const TICKER_YAHOO = /^[A-Z0-9][A-Z0-9\-]{0,11}(\.[A-Z]{1,3})?$/

/**
 * Symbole de la source + place → symbole Yahoo, ou `null` si le mappage n'est
 * pas certain. Ce `null` n'est pas un échec silencieux : l'appelant le compte
 * dans « non mappés » et le rapport l'affiche.
 */
function versYahoo(brut, place) {
  const sym = (brut ?? '').trim().toUpperCase()
  if (!sym) return null
  // Code de type Bloomberg (« SAP GY ») : la place est dans le code lui-même.
  const bbg = sym.match(/^([A-Z0-9]{1,6})\s+([A-Z]{2})$/)
  if (bbg) {
    const suffixeBbg = SUFFIXE_BLOOMBERG[bbg[2]]
    if (suffixeBbg === undefined) return null
    const candidat = (REECRITURES[bbg[1]] ?? bbg[1]) + suffixeBbg
    return TICKER_YAHOO.test(candidat) ? candidat : null
  }
  if (!TICKER_SOURCE.test(sym)) return null
  const suffixe = suffixePlace(place)
  if (suffixe === null) return null
  let racine = REECRITURES[sym] ?? sym
  // Yahoo sépare les classes d'actions américaines par un tiret là où les
  // sources écrivent un point (« BRK.B » → « BRK-B »).
  if (suffixe === '') racine = racine.replace(/\./g, '-')
  // Yahoo écrit les codes de Hong Kong sur quatre chiffres au moins : iShares
  // publie « 700 » là où Yahoo attend « 0700.HK ». Les codes déjà à cinq
  // chiffres (« 09988 ») ne bougent pas.
  if (suffixe === '.HK') racine = racine.replace(/^0+/, '').padStart(4, '0')
  const symbole = racine + suffixe
  return TICKER_YAHOO.test(symbole) ? symbole : null
}

// ─────────────────────────────────────────────────────────────────────────
//  4. RÉSEAU
// ─────────────────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (compatible; CMF-dashboard/1.0; +refresh-index-members)'
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/** GET avec trois tentatives : un 503 passager ne doit pas coûter un mois de retard. */
async function recupere(url, { accept = 'text/html,application/json,*/*' } = {}) {
  let derniere
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'en,fr;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const texte = await res.text()
      if (!texte.trim()) throw new Error('réponse vide')
      return texte
    } catch (err) {
      derniere = err
      if (essai < 3) await pause(2_000 * essai)
    }
  }
  throw new Error(`${url} — ${derniere?.message ?? derniere}`)
}

// ─────────────────────────────────────────────────────────────────────────
//  5. LECTURE HTML / CSV À LA MAIN
//
//  Pas de dépendance npm : ces analyseurs sont volontairement bêtes et
//  tolérants. Ils ne cherchent pas à comprendre la page, seulement à en tirer
//  des lignes ; c'est la couche garde-fous qui décide si ces lignes valent
//  quelque chose.
// ─────────────────────────────────────────────────────────────────────────
// Les entités accentuées ne sont pas un raffinement : « Soci&eacute;t&eacute;
// G&eacute;n&eacute;rale » recopié tel quel finirait ainsi dans une planche
// client. Les majuscules sont dérivées automatiquement des minuscules.
const ACCENTS = {
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ',
  szlig: 'ß', eth: 'ð', thorn: 'þ',
}

const ENTITES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—',
  hellip: '…', middot: '·', deg: '°', euro: '€', pound: '£', yen: '¥',
  copy: '©', reg: '®', trade: '™',
  ...ACCENTS,
  ...Object.fromEntries(
    Object.entries(ACCENTS).map(([nom, car]) => [nom[0].toUpperCase() + nom.slice(1), car.toUpperCase()]),
  ),
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)))
    // Recherche sensible à la casse d'abord : « &Eacute; » et « &eacute; » sont
    // deux entités différentes. Une entité inconnue est laissée telle quelle
    // plutôt que remplacée par un caractère au hasard.
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,10});/g, (m, e) => ENTITES[e] ?? ENTITES[e.toLowerCase()] ?? m)
}

const texte = (html) =>
  decode(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

const tableaux = (html) => [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0])
const rangs = (table) => [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0])
const cellules = (rang) =>
  [...rang.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({
    texte: texte(m[2]),
    entete: m[1].toLowerCase() === 'th',
  }))

// Entêtes reconnus. Les motifs sont ancrés là où une correspondance partielle
// ferait des dégâts : « Market Value » ne doit surtout pas être pris pour la
// colonne « Market », sinon tout l'ETF World se retrouverait coté en dollars
// sur une place imaginaire.
const COLONNES = {
  symbole: /^(symbol|symbole|ticker|mnemo|mnémo|mnemonic|trading symbol|bloomberg ticker|bbg ticker)$/i,
  nom: /^(company\s*name|name|nom|company|société|societe|libellé|libelle|instrument|security|issuer)$/i,
  poids: /(weight|poids|pond)/i,
  isin: /^isin/i,
  marche: /^(exchange|market|marché|marche|place|venue|listing|trading venue|bourse)$/i,
  pays: /^(location|country|pays|domicile|country of risk)$/i,
  classe: /^asset\s*class$/i,
}

function indexeColonnes(entetes) {
  const idx = {}
  entetes.forEach((e, i) => {
    for (const [cle, motif] of Object.entries(COLONNES)) {
      if (idx[cle] === undefined && motif.test(String(e).trim())) idx[cle] = i
    }
  })
  return idx
}

function nombre(txt) {
  if (!txt) return undefined
  const s = String(txt)
    .replace(/[%\s ]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const v = Number.parseFloat(s)
  return Number.isFinite(v) ? v : undefined
}

const ISIN = /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/

/** Une ligne de tableau → une candidature de membre (brute, non mappée). */
function extraitRang(c, brut, idx, options) {
  const val = (i) => (i === undefined || !c[i] ? '' : c[i].texte)
  let symbole = val(idx.symbole)
  if (!symbole && options.hrefSymbole) symbole = brut.match(options.hrefSymbole)?.[1] ?? ''
  const isin = val(idx.isin) || (brut.match(ISIN)?.[1] ?? '')
  const place = val(idx.marche) || val(idx.pays) || options.placeParDefaut || ''
  let nom = val(idx.nom)
  if (!nom) {
    // Sans entête, le nom est la cellule la plus « textuelle » : la plus longue
    // qui ne soit ni un nombre, ni le symbole, ni l'ISIN, ni la place.
    nom =
      c
        .map((x) => x.texte)
        .filter(
          (t) =>
            t &&
            t !== symbole &&
            t !== isin &&
            t !== place &&
            /[A-Za-zÀ-ÿ]{3}/.test(t) &&
            !/^[\d\s.,%+-]+$/.test(t),
        )
        .sort((a, b) => b.length - a.length)[0] ?? ''
  }
  if (!symbole && !isin) return null
  return { symbole, nom, place, isin, poids: nombre(val(idx.poids)), classe: val(idx.classe) }
}

/** Le tableau le plus fourni de la page — les autres sont des habillages. */
function membresDepuisTables(html, options = {}) {
  let meilleur = []
  for (const table of tableaux(html)) {
    const lignes = rangs(table)
    if (lignes.length < 4) continue
    let idx = {}
    for (const l of lignes) {
      const c = cellules(l)
      if (c.length >= 2 && c.some((x) => x.entete)) {
        idx = indexeColonnes(c.map((x) => x.texte))
        break
      }
    }
    const trouves = []
    for (const l of lignes) {
      const c = cellules(l)
      if (c.length < 2 || c.every((x) => x.entete)) continue
      const m = extraitRang(c, l, idx, options)
      if (m) trouves.push(m)
    }
    if (trouves.length > meilleur.length) meilleur = trouves
  }
  return meilleur
}

const desechappe = (s) =>
  s
    .replace(/\\u([0-9a-f]{4})/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)))
    .replace(/\\(["/\\])/g, '$1')

/**
 * Repêchage : de plus en plus de pages ne rendent plus de <table> mais un JSON
 * embarqué dans un <script>, hydraté côté navigateur. On y cherche des objets
 * PLATS portant à la fois un symbole et un nom — sans jamais évaluer le
 * script, évidemment.
 */
function membresDepuisJson(html, options = {}) {
  const trouves = []
  const vus = new Set()
  for (const m of html.matchAll(/\{[^{}]{0,800}\}/g)) {
    const o = m[0]
    const s = o.match(/"(?:symbol|ticker|code|s)"\s*:\s*"([^"]{1,12})"/i)
    const n = o.match(/"(?:name|companyName|company|longName|n)"\s*:\s*"([^"]{1,120})"/i)
    if (!s || !n) continue
    const symbole = s[1].trim()
    if (vus.has(symbole)) continue
    vus.add(symbole)
    trouves.push({
      symbole,
      nom: desechappe(n[1]).trim(),
      place:
        o.match(/"(?:exchange|market|mic|country|location)"\s*:\s*"([^"]{1,60})"/i)?.[1] ??
        options.placeParDefaut ??
        '',
      isin: o.match(/"isin"\s*:\s*"([^"]{12})"/i)?.[1] ?? '',
      poids: nombre(o.match(/"(?:weight|poids|w)"\s*:\s*"?([0-9.,]+)"?/i)?.[1]),
      classe: '',
    })
  }
  return trouves
}

function analyseCsv(brut) {
  const lignes = []
  let champ = ''
  let ligne = []
  let guillemets = false
  for (let i = 0; i < brut.length; i++) {
    const ch = brut[i]
    if (guillemets) {
      if (ch === '"') {
        if (brut[i + 1] === '"') {
          champ += '"'
          i++
        } else guillemets = false
      } else champ += ch
    } else if (ch === '"') guillemets = true
    else if (ch === ',') {
      ligne.push(champ)
      champ = ''
    } else if (ch === '\n') {
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else if (ch !== '\r') champ += ch
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ)
    lignes.push(ligne)
  }
  return lignes
}

// ─────────────────────────────────────────────────────────────────────────
//  6. LES CINQ COLLECTEURS
// ─────────────────────────────────────────────────────────────────────────

/**
 * stockanalysis.com — S&P 500 et Dow Jones.
 *
 * La place n'est pas lue dans la page : elle est connue par construction. Ces
 * deux indices n'admettent que des valeurs cotées aux États-Unis, donc pas de
 * suffixe Yahoo. C'est la seule déduction de place qu'on s'autorise sans que
 * la source la publie, et elle tient au règlement de l'indice, pas à un pari.
 */
async function collecteStockAnalysis(url) {
  const html = await recupere(url)
  const options = {
    hrefSymbole: /href="\/stocks\/([A-Za-z0-9.\-]{1,10})\/?"/i,
    placeParDefaut: 'NASDAQ',
  }
  let brut = membresDepuisTables(html, options)
  if (brut.length < 20) brut = membresDepuisJson(html, options)
  return brut
}

/**
 * iShares URTH — le MSCI World par procuration.
 *
 * Le CSV commence par un préambule (date d'arrêté, encours…) et se termine par
 * un avertissement juridique : on ne se repère donc pas sur un numéro de ligne
 * mais sur l'entête « Ticker … Name », et on s'arrête dès qu'une ligne cesse
 * d'avoir la forme d'une détention. Les lignes de liquidités et de futures
 * portent une classe d'actif autre que « Equity » : ce ne sont pas des membres.
 */
async function collecteURTH() {
  const csv = await recupere(URL_URTH, { accept: 'text/csv,application/csv,*/*' })
  const lignes = analyseCsv(csv)
  const iEntete = lignes.findIndex(
    (l) => l.some((c) => /^ticker$/i.test(c.trim())) && l.some((c) => /^name$/i.test(c.trim())),
  )
  if (iEntete < 0) throw new Error('entête « Ticker … Name » introuvable — le CSV a changé de forme')
  const idx = indexeColonnes(lignes[iEntete].map((c) => c.trim()))
  const out = []
  for (const l of lignes.slice(iEntete + 1)) {
    if (l.length < 3) continue
    const val = (i) => (i === undefined ? '' : (l[i] ?? '').trim())
    const classe = val(idx.classe)
    if (classe && !/equity/i.test(classe)) continue
    const symbole = val(idx.symbole)
    if (!symbole || symbole === '-') continue
    out.push({
      symbole,
      nom: val(idx.nom),
      // La place de cotation d'abord ; le pays ne sert que si la colonne
      // « Exchange » disparaît, et il vaut ce qu'il vaut (pays de risque).
      place: val(idx.marche) || val(idx.pays),
      isin: '',
      poids: nombre(val(idx.poids)),
      classe,
    })
  }
  return out
}

/**
 * Euronext — CAC 40 (PX1).
 *
 * Place par défaut : Euronext Paris. Ce n'est pas une supposition — le
 * règlement du CAC 40 impose la cotation sur Euronext Paris, y compris pour les
 * sociétés de droit néerlandais ou luxembourgeois (Airbus, ArcelorMittal,
 * STMicro) dont c'est bien la ligne parisienne qui entre dans l'indice. La
 * colonne « Market » de la page reste prioritaire quand elle est lisible.
 */
async function collecteCAC() {
  return await premiereQuiParle(URLS_CAC, async (html) => {
    const options = { placeParDefaut: 'Euronext Paris' }
    let brut = membresDepuisTables(html, options)
    if (brut.length < 10) brut = membresDepuisJson(html, options)
    return brut
  })
}

/**
 * STOXX — Euro Stoxx 50.
 *
 * Aucune place par défaut ici : l'Euro Stoxx 50 est réparti sur toute la zone
 * euro, et deviner un suffixe reviendrait à parier sur le pays de chaque
 * valeur. Si la fiche ne publie ni place ni pays exploitable, l'indice échoue
 * ses garde-fous et garde sa liste précédente — c'est le comportement voulu.
 */
async function collecteSX5E() {
  return await premiereQuiParle(URLS_SX5E, async (contenu) => {
    let brut = membresDepuisTables(contenu, {})
    if (brut.length < 10) brut = membresDepuisJson(contenu, {})
    return brut
  })
}

/** Essaie les URL dans l'ordre, garde la première qui rend une liste crédible. */
async function premiereQuiParle(urls, analyse) {
  const notes = []
  let meilleur = []
  for (const url of urls) {
    try {
      const contenu = await recupere(url)
      const trouves = await analyse(contenu)
      if (trouves.length > meilleur.length) meilleur = trouves
      if (meilleur.length >= 20) return meilleur
      notes.push(`${url} → ${trouves.length} ligne(s) exploitable(s)`)
    } catch (err) {
      notes.push(`${url} → ${err?.message ?? err}`)
    }
  }
  if (!meilleur.length) throw new Error(notes.join(' ; '))
  return meilleur
}

// ─────────────────────────────────────────────────────────────────────────
//  7. MAPPAGE ET GARDE-FOUS
// ─────────────────────────────────────────────────────────────────────────

/** Candidatures brutes → membres Yahoo, avec le compte de ce qu'on a jeté. */
function mappe(brut) {
  const membres = []
  const vus = new Set()
  let nonMappes = 0
  let doublons = 0
  const exemplesNonMappes = []
  for (const b of brut) {
    const symbole = versYahoo(b.symbole, b.place)
    const nom = (b.nom ?? '').trim()
    if (!symbole || !nom) {
      nonMappes++
      if (exemplesNonMappes.length < 5) exemplesNonMappes.push(`${b.symbole || '?'} (${b.place || 'place inconnue'})`)
      continue
    }
    if (vus.has(symbole)) {
      doublons++
      continue
    }
    vus.add(symbole)
    const membre = { symbole, nom }
    if (typeof b.poids === 'number' && b.poids > 0 && b.poids <= 100) membre.poids = Number(b.poids.toFixed(4))
    membres.push(membre)
  }
  return { membres, nonMappes, doublons, exemplesNonMappes, examines: brut.length }
}

/**
 * Le juge. Rend la liste des raisons de REFUSER ; vide, la liste est écrite.
 * Chaque raison correspond à une façon connue dont une source publique se
 * casse la figure sans le dire.
 */
function raisonsDeRefuser(indice, resultat, ancien) {
  const raisons = []
  const { membres, nonMappes, examines } = resultat
  if (membres.length < indice.plancher) {
    raisons.push(`${membres.length} membre(s) retenu(s), plancher ${indice.plancher} — liste amputée ou page changée`)
  }
  const invalides = membres.filter((m) => !TICKER_YAHOO.test(m.symbole) || !m.nom)
  if (invalides.length) {
    raisons.push(`${invalides.length} symbole(s) hors format (ex. « ${invalides[0].symbole} »)`)
  }
  const avant = ancien?.membres?.length ?? 0
  if (avant > 0 && membres.length < Math.floor(avant * (1 - CHUTE_MAX))) {
    raisons.push(
      `chute de ${avant} à ${membres.length} membres (> ${Math.round(CHUTE_MAX * 100)} %) — un indice ne maigrit pas ainsi en un mois`,
    )
  }
  if (examines > 0 && nonMappes / examines > PART_NON_MAPPES_MAX) {
    raisons.push(
      `${nonMappes}/${examines} lignes non mappables (> ${Math.round(PART_NON_MAPPES_MAX * 100)} %) — colonne de place perdue`,
    )
  }
  return raisons
}

// ─────────────────────────────────────────────────────────────────────────
//  8. LES INDICES SUIVIS
// ─────────────────────────────────────────────────────────────────────────
const INDICES = [
  { cle: 'SPX', nom: 'S&P 500', plancher: 480, collecte: () => collecteStockAnalysis(URL_SPX) },
  { cle: 'DJIA', nom: 'Dow Jones Industrial', plancher: 28, collecte: () => collecteStockAnalysis(URL_DJIA) },
  { cle: 'CAC', nom: 'CAC 40', plancher: 36, collecte: collecteCAC },
  { cle: 'SX5E', nom: 'Euro Stoxx 50', plancher: 45, collecte: collecteSX5E },
  { cle: 'WORLD', nom: 'MSCI World (via URTH)', plancher: 1_000, collecte: collecteURTH },
]

// ─────────────────────────────────────────────────────────────────────────
//  9. EXÉCUTION
// ─────────────────────────────────────────────────────────────────────────
const lignesRapport = []
const out = (s = '') => {
  lignesRapport.push(s)
  console.log(s)
}

let echecs = INDICES.length // en cas de crash total : on signale, on ne se tait pas
let fichierModifie = false

out('═'.repeat(66))
out('  COMPOSITION DES INDICES — rafraîchissement mensuel')
out(`  ${AUJOURDHUI} · sources publiques, aucun secret`)
out('═'.repeat(66))
out()

try {
  const original = readFileSync(FICHIER, 'utf8')
  const donnees = JSON.parse(original)
  echecs = 0

  for (const indice of INDICES) {
    const ancien = donnees[indice.cle]
    out(`── ${indice.cle} — ${indice.nom}`)
    if (!ancien) {
      // Le fichier a perdu une clé : on ne la recrée pas au jugé, la structure
      // est un contrat partagé avec lib/index-members.ts.
      out(`   ⚠ ÉCHEC — clé « ${indice.cle} » absente de data/index-members.json.`)
      out()
      echecs++
      continue
    }
    out(`   Source : ${ancien.source}`)
    try {
      const brut = await indice.collecte()
      const resultat = mappe(brut)
      const raisons = raisonsDeRefuser(indice, resultat, ancien)
      out(
        `   Lignes lues : ${resultat.examines} · retenues : ${resultat.membres.length} · non mappées : ${resultat.nonMappes}` +
          (resultat.doublons ? ` · doublons écartés : ${resultat.doublons}` : ''),
      )
      if (resultat.nonMappes) {
        out(`   Non mappées (échantillon) : ${resultat.exemplesNonMappes.join(', ')}`)
      }
      if (raisons.length) {
        // On ne touche à RIEN : anciens membres, ancienne date. Une liste
        // fausse coûte plus cher qu'une liste vieille d'un mois.
        echecs++
        out(`   ⚠ ÉCHEC — composition REFUSÉE, l'entrée existante est conservée intacte.`)
        for (const r of raisons) out(`     • ${r}`)
        out(`     Conservé : ${ancien.membres?.length ?? 0} membre(s), maj le ${ancien.majLe || '—'}.`)
      } else {
        const avant = ancien.membres?.length ?? 0
        donnees[indice.cle] = { source: ancien.source, majLe: AUJOURDHUI, membres: resultat.membres }
        const delta = resultat.membres.length - avant
        out(
          `   ✓ ${resultat.membres.length} membre(s) écrits (${avant} auparavant, ${delta >= 0 ? '+' : ''}${delta}), maj le ${AUJOURDHUI}.`,
        )
      }
    } catch (err) {
      // Source injoignable ou illisible : c'est un échec, pas un « rien à faire ».
      echecs++
      out(`   ⚠ ÉCHEC — source illisible : ${err?.message ?? err}`)
      out(`     Conservé : ${ancien.membres?.length ?? 0} membre(s), maj le ${ancien.majLe || '—'}.`)
    }
    out()
  }

  // Le _README et l'ordre des clés survivent : on a modifié l'objet lu, pas
  // reconstruit un objet neuf.
  const serialise = JSON.stringify(donnees, null, 2) + '\n'
  if (serialise !== original) {
    writeFileSync(FICHIER, serialise)
    fichierModifie = true
  }

  out('─'.repeat(66))
  out(
    echecs === 0
      ? `✓ Les ${INDICES.length} indices ont été rafraîchis.`
      : `⚠ ${echecs} indice(s) sur ${INDICES.length} ont gardé leur ancienne composition.`,
  )
  out(
    fichierModifie
      ? 'data/index-members.json a changé — le diff part en pull request pour relecture.'
      : 'data/index-members.json est inchangé — aucune pull request à ouvrir.',
  )
} catch (err) {
  // Fichier illisible ou JSON cassé : rien n'a pu être écrit, tout est en échec.
  echecs = INDICES.length
  out(`⚠ RAFRAÎCHISSEMENT EN ERREUR — ${err?.message ?? err}`)
  out("Le job lui-même est en panne : c'est un échec, pas un silence.")
}

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Composition des indices\n\n\`\`\`text\n${lignesRapport.join('\n')}\n\`\`\`\n`,
    )
  } catch {
    /* le rapport stdout reste la source : ne jamais échouer sur l'écriture */
  }
}

console.log(`MEMBRES_ECHECS=${echecs}`)
