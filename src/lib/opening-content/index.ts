/**
 * opening-content — curated London System + Caro-Kann repertoire as data.
 *
 * Lines are stored as PGN and validated through chess-rules at seed time (N8).
 * Per-ply content (explanation/theme/commonMistake/hints/reveal) is keyed by
 * half-move index and must match the number of plies in the line's PGN.
 *
 * Content sourced from PRD §5.1 (London) and §5.2 (Caro-Kann).
 */
import type { Side } from "@/lib/types";
import { START_FEN } from "../chess-rules";

/** Per-ply curated content. `explanation` is always required (PRD §6.2). */
export interface MoveContent {
  explanation: string;
  theme?: string;
  commonMistake?: string;
  hintLevel1?: string;
  hintLevel2?: string;
  revealExplanation?: string;
}

export interface LineContent {
  name: string;
  startingFen: string;
  pgn: string;
  description: string;
  priority: number;
  active: boolean;
  /** One entry per half-move in `pgn`, in order. */
  moves: MoveContent[];
}

export interface OpeningContent {
  /** Stable URL slug (PRD §11 routes use [slug]). */
  slug: string;
  name: string;
  side: Side;
  description: string;
  difficulty: string;
  lines: LineContent[];
}

const m = (explanation: string, extra: Partial<MoveContent> = {}): MoveContent => ({
  explanation,
  ...extra,
});

const london: OpeningContent = {
  slug: "london-system",
  name: "London System",
  side: "white",
  difficulty: "beginner",
  description:
    "A solid, repeatable system for White: build a pawn center, develop the dark-square bishop to f4 before e3, and castle safely before committing to a plan.",
  lines: [
    {
      name: "Classical setup (…d5/…Nf6/…e6)",
      startingFen: START_FEN,
      priority: 1,
      active: true,
      description:
        "The main London basic setup against Black's classical development.",
      pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4 e6 4. e3 c5 5. c3 Nc6 6. Nbd2 Be7 7. Bd3 O-O 8. O-O",
      moves: [
        m("Claim the center and open a path for the dark-square bishop.", {
          theme: "central control",
        }),
        m("Black mirrors, fighting for the center."),
        m("Develop the kingside knight and keep an eye on e5.", {
          theme: "development",
        }),
        m("Black develops and contests e4/d5."),
        m(
          "The signature London move: the dark-square bishop comes out before e3 would lock it in.",
          {
            theme: "the London bishop",
            commonMistake:
              "Playing e3 first traps this bishop behind the pawn chain.",
            hintLevel1:
              "Develop your problem piece before closing the pawn chain.",
            hintLevel2: "Which bishop does e3 block in? Move it out first.",
            revealExplanation:
              "Bf4 — develop the dark-square bishop outside the pawn chain before playing e3.",
          },
        ),
        m("Black opens a diagonal for the f8-bishop."),
        m("Now e3 is safe: it supports d4 and frees the light-square bishop.", {
          theme: "solid center",
        }),
        m("Black strikes at d4 to gain central counterplay."),
        m("Reinforce d4 so the center holds under pressure.", {
          theme: "support the center",
          commonMistake:
            "Ignoring …Qb6 pressure on b2 while the center is contested.",
        }),
        m("Black adds a second attacker to d4."),
        m(
          "Develop the last minor piece, keeping c3 intact and preparing Ne5.",
          {
            theme: "development",
            hintLevel1: "Finish developing your minor pieces.",
            hintLevel2:
              "The b1-knight belongs on d2 (c3 is occupied by a pawn).",
            revealExplanation:
              "Nbd2 — the queenside knight develops behind the c3 pawn, eyeing e5.",
          },
        ),
        m("Black prepares to castle."),
        m("Aim the light-square bishop at Black's kingside and prepare O-O.", {
          theme: "development",
        }),
        m("Black castles into safety."),
        m("Castle: king safety comes before any attack.", {
          theme: "king safety",
          commonMistake:
            "Attacking before castling leaves your own king exposed.",
          hintLevel1: "Get your king to safety before doing anything else.",
          hintLevel2: "Short castling is available — take it.",
          revealExplanation:
            "O-O — castle kingside to complete the basic London setup.",
        }),
      ],
    },
    {
      name: "…c5 early pressure",
      startingFen: START_FEN,
      priority: 2,
      active: true,
      description: "Black hits d4 early with …c5; White braces the center.",
      pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. c3",
      moves: [
        m("Claim the center.", { theme: "central control" }),
        m("Black contests the center."),
        m("Develop and cover e5.", { theme: "development" }),
        m("Black develops the kingside knight."),
        m("Develop the London bishop early, before e3.", {
          theme: "the London bishop",
          commonMistake: "Don't shut it in with e3 first.",
        }),
        m("Black strikes at d4 immediately for early pressure."),
        m("Support d4 and open the light bishop; the center holds.", {
          theme: "solid center",
        }),
        m("Black piles a second attacker onto d4."),
        m("Brace d4 with c3 so the pressure fizzles out.", {
          theme: "support the center",
          hintLevel1: "Reinforce your attacked center pawn.",
          hintLevel2: "A pawn on c3 backs up d4.",
          revealExplanation:
            "c3 — support d4 against the …c5/…Nc6 pressure.",
        }),
      ],
    },
    {
      name: "…Bf5 mirror setup",
      startingFen: START_FEN,
      priority: 3,
      active: true,
      description:
        "Black copies the London idea with …Bf5; White offers to trade the light bishops.",
      pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4 Bf5 4. e3 e6 5. Bd3",
      moves: [
        m("Claim the center.", { theme: "central control" }),
        m("Black contests the center."),
        m("Develop and cover e5.", { theme: "development" }),
        m("Black develops the kingside knight."),
        m("Develop the London bishop early.", { theme: "the London bishop" }),
        m("Black mirrors, developing the bishop outside the pawn chain."),
        m("Solidify the center and free the light-square bishop.", {
          theme: "solid center",
        }),
        m("Black opens a path for the f8-bishop."),
        m("Offer to trade light bishops — Black's is the better-placed one.", {
          theme: "trade the good bishop",
          hintLevel1: "Challenge Black's active light-square bishop.",
          hintLevel2: "Your light-square bishop can contest f5 from d3.",
          revealExplanation:
            "Bd3 — challenge Black's light-square bishop and prepare to castle.",
        }),
      ],
    },
    {
      name: "…g6 King's Indian-style setup",
      startingFen: START_FEN,
      priority: 4,
      active: true,
      description:
        "Black fianchettoes; White develops flexibly and prefers Be2 over Bd3.",
      pgn: "1. d4 Nf6 2. Bf4 g6 3. Nf3 Bg7 4. e3 O-O 5. Be2",
      moves: [
        m("Claim the center.", { theme: "central control" }),
        m("Black heads for a King's Indian-style setup."),
        m("Develop the London bishop before e3.", {
          theme: "the London bishop",
        }),
        m("Black fianchettoes the dark-square bishop."),
        m("Develop and control e5.", { theme: "development" }),
        m("The bishop eyes the long diagonal."),
        m("Support d4 and free the light-square bishop.", {
          theme: "solid center",
        }),
        m("Black castles."),
        m(
          "Develop the bishop modestly and prepare to castle. Against a fianchetto, Bd3 invites …Nh5, so Be2 is safer.",
          {
            theme: "flexible development",
            hintLevel1:
              "Develop your light-square bishop and prepare to castle.",
            hintLevel2: "Against …g6, e2 is a safer square than d3 here.",
            revealExplanation:
              "Be2 — solid development that sidesteps …Nh5; castle next.",
          },
        ),
      ],
    },
  ],
};

const caroKann: OpeningContent = {
  slug: "caro-kann",
  name: "Caro-Kann Defense",
  side: "black",
  difficulty: "intermediate",
  description:
    "A sound defense to 1.e4: prepare …d5 with …c6 while keeping the light-square bishop free. Solid structures, active bishop, clear pawn breaks.",
  lines: [
    {
      name: "Primary (1.e4 c6 2.d4 d5)",
      startingFen: START_FEN,
      priority: 1,
      active: true,
      description: "The defining Caro-Kann moves.",
      pgn: "1. e4 c6 2. d4 d5",
      moves: [
        m("White grabs the center."),
        m(
          "Prepare …d5 to challenge e4 without blocking the light-square bishop.",
          {
            theme: "the Caro-Kann idea",
            commonMistake:
              "Playing …e6 too early traps the light-square bishop on c8.",
            hintLevel1: "Support a future …d5 break with a pawn.",
            hintLevel2: "…c6 backs up the …d5 break and keeps c8 open.",
            revealExplanation:
              "c6 — the Caro-Kann: prepare …d5 while keeping the c8-bishop free.",
          },
        ),
        m("White builds a broad center."),
        m("Strike at e4 now that it is supported by the c6 pawn.", {
          theme: "central break",
          hintLevel1: "Challenge White's e4 pawn directly.",
          hintLevel2: "…d5 hits e4 with the support of c6.",
          revealExplanation: "d5 — the central break, the point of …c6.",
        }),
      ],
    },
    {
      name: "Advance Variation",
      startingFen: START_FEN,
      priority: 2,
      active: true,
      description: "White closes the center with e5; Black frees the bishop.",
      pgn: "1. e4 c6 2. d4 d5 3. e5 Bf5",
      moves: [
        m("White grabs the center."),
        m("Prepare the …d5 break.", { theme: "the Caro-Kann idea" }),
        m("White builds a broad center."),
        m("Challenge e4 with support from c6.", { theme: "central break" }),
        m("White closes the center with the Advance Variation."),
        m(
          "Develop the light-square bishop OUTSIDE the pawn chain before …e6 can lock it in.",
          {
            theme: "free the bad bishop",
            commonMistake:
              "Playing …e6 first imprisons the c8-bishop behind the chain.",
            hintLevel1:
              "Develop your light-square bishop before you play …e6.",
            hintLevel2: "The c8-bishop belongs on f5, outside the chain.",
            revealExplanation:
              "Bf5 — get the light-square bishop out before closing with …e6.",
          },
        ),
      ],
    },
    {
      name: "Classical Variation",
      startingFen: START_FEN,
      priority: 3,
      active: true,
      description:
        "Black releases the central tension and develops the bishop actively.",
      pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5",
      moves: [
        m("White grabs the center."),
        m("Prepare the …d5 break.", { theme: "the Caro-Kann idea" }),
        m("White builds a broad center."),
        m("Challenge e4 with support from c6.", { theme: "central break" }),
        m("White develops and defends e4."),
        m("Release the central tension on your terms.", {
          theme: "exchange tension",
        }),
        m("White recaptures, centralizing the knight."),
        m("Develop the bishop actively, hitting the e4-knight.", {
          theme: "active development",
          commonMistake:
            "Delaying development lets White seize space for free.",
          hintLevel1: "Develop your light-square bishop and challenge the knight.",
          hintLevel2: "…Bf5 attacks the e4-knight with tempo.",
          revealExplanation:
            "Bf5 — active development, the point of the Classical Caro-Kann.",
        }),
      ],
    },
    {
      name: "Exchange Variation",
      startingFen: START_FEN,
      priority: 4,
      active: true,
      description: "A symmetrical structure; develop simply and avoid passivity.",
      pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5",
      moves: [
        m("White grabs the center."),
        m("Prepare the …d5 break.", { theme: "the Caro-Kann idea" }),
        m("White builds a broad center."),
        m("Challenge e4 with support from c6.", { theme: "central break" }),
        m("White trades into the Exchange Variation."),
        m("Recapture toward the center, reaching a clean symmetrical structure.", {
          theme: "symmetry",
          commonMistake: "Drifting passively instead of developing with a plan.",
          hintLevel1: "Recapture the pawn toward the center.",
          hintLevel2: "…cxd5 keeps a sound pawn on d5.",
          revealExplanation:
            "cxd5 — recapture toward the center; develop actively and avoid passivity.",
        }),
      ],
    },
    {
      name: "Fantasy Variation",
      startingFen: START_FEN,
      priority: 5,
      active: true,
      description:
        "White over-protects e4 with f3; Black reacts in the center rather than playing automatically.",
      pgn: "1. e4 c6 2. d4 d5 3. f3 dxe4",
      moves: [
        m("White grabs the center."),
        m("Prepare the …d5 break.", { theme: "the Caro-Kann idea" }),
        m("White builds a broad center."),
        m("Challenge e4 with support from c6.", { theme: "central break" }),
        m("The Fantasy Variation: White over-protects e4 and plans a big center."),
        m(
          "Strike immediately; after fxe4, …e5! challenges the center. Don't drift into automatic moves.",
          {
            theme: "punish the setup",
            commonMistake:
              "Playing automatic developing moves and letting White build an ideal center.",
            hintLevel1: "Open the center before White completes it.",
            hintLevel2: "…dxe4 forces matters right away.",
            revealExplanation:
              "dxe4 — strike the center; the Fantasy is harmless if you react actively.",
          },
        ),
      ],
    },
  ],
};

export const openings: OpeningContent[] = [london, caroKann];

/**
 * Find a curated opening by its URL slug.
 *
 * Note: `slug` is a content-layer concept only — it is NOT persisted on the
 * Opening DB row. Routes resolve content via this function; to load the
 * matching DB rows, query `opening.findFirst({ where: { name } })` using the
 * content's `name`. The pair (slug → name) is stable here in code.
 */
export function getOpeningBySlug(slug: string): OpeningContent | undefined {
  return openings.find((o) => o.slug === slug);
}
