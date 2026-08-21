// ─────────────────────────────────────────────────────────────────────────
//  PLACEMENT DES ÉTIQUETTES D'UN NUAGE DE POINTS.
//
//  Soixante titres serrés dans un quadrant, ce sont soixante noms qui se
//  chevauchent : le radar devient illisible, et il part en pièce jointe.
//  Poser chaque étiquette « à droite du point » ne marche que sur un nuage
//  clairsemé.
//
//  L'algorithme est un placement GLOUTON par priorité. Chaque point propose
//  quelques ancrages (droite, gauche, dessus, dessous, puis des décalages
//  verticaux) ; on retient le premier qui ne heurte ni une étiquette déjà
//  posée, ni le bord du cadre. Les points les plus lourds passent d'abord :
//  si quelque chose doit céder, ce sera une petite ligne, jamais Apple.
//
//  TROIS PARTIS PRIS, ET LEURS RAISONS
//
//  On ne déplace JAMAIS le point, seulement son étiquette. Un point déplacé
//  ment sur la donnée ; une étiquette déplacée se rattache par un trait.
//
//  On ne tronque pas le texte. Un nom coupé au milieu devient faux ; mieux
//  vaut renoncer à l'étiquette et garder le point.
//
//  Et l'on COMPTE ce qu'on n'a pas pu poser. Une planche où trois noms
//  manquent sans le dire laisse croire à trois points anonymes.
// ─────────────────────────────────────────────────────────────────────────

export interface PointAEtiqueter {
  id: string
  /** Coordonnées du point, en unités du dessin. */
  cx: number
  cy: number
  /** Texte de l'étiquette (déjà raccourci). */
  texte: string
  /** Plus la priorité est haute, plus l'étiquette est posée tôt. */
  priorite: number
}

export interface Cadre {
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

export interface Etiquette {
  id: string
  /** Coin de départ du texte, et son ancrage horizontal. */
  x: number
  y: number
  ancrage: 'start' | 'end'
  /** Trait de rappel à tracer quand l'étiquette a dû s'éloigner du point. */
  trait?: { x1: number; y1: number; x2: number; y2: number }
}

export interface PlacementResultat {
  etiquettes: Etiquette[]
  /** Ids dont l'étiquette n'a pas pu être posée sans chevauchement. */
  nonPlacees: string[]
}

interface Boite {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Largeur approchée d'un texte. Suffisant : on cherche à éviter, pas à composer. */
export function largeurTexte(texte: string, taille: number): number {
  // ~0,56 em en moyenne pour une graisse normale ; les majuscules et les
  // chiffres tirent vers le haut, d'où la marge.
  return texte.length * taille * 0.58
}

const seChevauchent = (a: Boite, b: Boite): boolean =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

const dansLeCadre = (b: Boite, c: Cadre): boolean =>
  b.x1 >= c.xMin && b.x2 <= c.xMax && b.y1 >= c.yMin && b.y2 <= c.yMax

/**
 * Place les étiquettes sans chevauchement, du point le plus prioritaire au
 * moins prioritaire.
 *
 * `rayon` est le rayon du point (l'étiquette s'en écarte), `taille` la taille
 * de police. Le résultat est DÉTERMINISTE : à données égales, même planche —
 * ce qui compte pour un envoi mensuel qu'on compare d'un mois sur l'autre.
 */
export function placer(
  points: PointAEtiqueter[],
  cadre: Cadre,
  options: { taille?: number; rayon?: number; interligne?: number } = {},
): PlacementResultat {
  const { taille = 11, rayon = 5, interligne = 2 } = options
  const hauteur = taille + interligne

  // Les points eux-mêmes sont des obstacles : une étiquette ne doit pas
  // recouvrir un autre point, sinon on masque la donnée pour lire un nom.
  const obstacles: Boite[] = points.map((p) => ({
    x1: p.cx - rayon,
    y1: p.cy - rayon,
    x2: p.cx + rayon,
    y2: p.cy + rayon,
  }))

  const etiquettes: Etiquette[] = []
  // Boîtes des étiquettes DÉJÀ posées, tenues à jour au fil de la pose. Les
  // conserver ici évite d'avoir à retrouver la largeur d'une étiquette à
  // partir de son seul point d'ancrage — un calcul qu'on ne peut pas refaire
  // juste, et qui obligeait à un état partagé au niveau du module.
  const posees: Boite[] = []
  const nonPlacees: string[] = []

  // Tri stable par priorité décroissante, puis par id — deux points de même
  // poids ne doivent pas changer d'ordre d'un rendu à l'autre.
  const ordre = [...points].sort((a, b) => b.priorite - a.priorite || a.id.localeCompare(b.id))

  for (const p of ordre) {
    const l = largeurTexte(p.texte, taille)
    const ecart = rayon + 4

    // Candidats, du plus lisible au plus acrobatique : à droite, à gauche,
    // puis au-dessus et au-dessous, puis des décalages verticaux croissants
    // de part et d'autre — ceux-là méritent un trait de rappel.
    const candidats: { x: number; y: number; ancrage: 'start' | 'end'; trait: boolean }[] = [
      { x: p.cx + ecart, y: p.cy + taille * 0.35, ancrage: 'start', trait: false },
      { x: p.cx - ecart, y: p.cy + taille * 0.35, ancrage: 'end', trait: false },
      { x: p.cx, y: p.cy - ecart - 1, ancrage: 'start', trait: false },
      { x: p.cx, y: p.cy + ecart + taille, ancrage: 'start', trait: false },
    ]
    for (let k = 1; k <= 6; k++) {
      const d = k * hauteur
      candidats.push(
        { x: p.cx + ecart, y: p.cy + taille * 0.35 - d, ancrage: 'start', trait: true },
        { x: p.cx + ecart, y: p.cy + taille * 0.35 + d, ancrage: 'start', trait: true },
        { x: p.cx - ecart, y: p.cy + taille * 0.35 - d, ancrage: 'end', trait: true },
        { x: p.cx - ecart, y: p.cy + taille * 0.35 + d, ancrage: 'end', trait: true },
      )
    }

    let pose: { etiquette: Etiquette; boite: Boite } | null = null
    for (const c of candidats) {
      const x1 = c.ancrage === 'start' ? c.x : c.x - l
      const boite: Boite = { x1, y1: c.y - taille, x2: x1 + l, y2: c.y + interligne }
      if (!dansLeCadre(boite, cadre)) continue
      if (posees.some((b) => seChevauchent(boite, b))) continue
      // On tolère le chevauchement avec SON PROPRE point, pas avec les autres.
      const heurteUnPoint = obstacles.some(
        (o, i) => points[i].id !== p.id && seChevauchent(boite, o),
      )
      if (heurteUnPoint) continue

      pose = {
        etiquette: {
          id: p.id,
          x: c.x,
          y: c.y,
          ancrage: c.ancrage,
          trait: c.trait
            ? {
                x1: p.cx,
                y1: p.cy,
                x2: c.ancrage === 'start' ? c.x - 2 : c.x + 2,
                y2: c.y - taille * 0.3,
              }
            : undefined,
        },
        boite,
      }
      break
    }

    if (pose) {
      etiquettes.push(pose.etiquette)
      posees.push(pose.boite)
    } else nonPlacees.push(p.id)
  }

  return { etiquettes, nonPlacees }
}
