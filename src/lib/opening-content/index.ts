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
      pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. c3 Qb6 6. Qb3",
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
        m("Black's queen eyes b2 and adds pressure to d4."),
        m("Meet the queen head-on: Qb3 guards b2 and offers a queen trade on your terms.", {
          theme: "meet the …Qb6 idea",
          commonMistake:
            "Ignoring …Qb6 and letting Black win the b2 pawn.",
          hintLevel1: "Something on your queenside is attacked. Defend it actively.",
          hintLevel2: "Your queen can defend b2 and face Black's queen at the same time.",
          revealExplanation:
            "Qb3 — defend b2 and challenge the black queen; if …Qxb3, axb3 opens the a-file for your rook.",
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
      pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4 Bf5 4. e3 e6 5. Bd3 Bxd3 6. Qxd3 c5 7. c3 Nc6 8. Nbd2",
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
        m("Black accepts the bishop trade."),
        m("Recapture with the queen, keeping your pawn structure intact.", {
          theme: "recapture well",
          commonMistake: "Recapturing with the c-pawn doubles pawns for no reason.",
          hintLevel1: "Recapture so your pawns stay healthy.",
          hintLevel2: "Take back with a piece, not a pawn.",
          revealExplanation: "Qxd3 — recapture with the queen; your pawn chain stays intact.",
        }),
        m("Black hits d4, the standard break."),
        m("Brace d4 with c3, the London's answer to every …c5.", {
          theme: "support the center",
          hintLevel1: "Reinforce your center pawn.",
          hintLevel2: "A pawn on c3 backs up d4.",
          revealExplanation: "c3 — the London triangle d4/e3/c3 holds the center.",
        }),
        m("Black adds another attacker to d4."),
        m("Develop the last minor piece behind the pawns, ready to castle next.", {
          theme: "development",
          hintLevel1: "Finish developing your minor pieces.",
          hintLevel2: "The b1-knight belongs on d2 because c3 is taken.",
          revealExplanation: "Nbd2 — develop, support e4 later, and castle next move.",
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
      pgn: "1. d4 Nf6 2. Bf4 g6 3. Nf3 Bg7 4. e3 O-O 5. Be2 d6 6. h3",
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
        m("Black prepares …e5 or …Nbd7, King's Indian style."),
        m("Make an escape square on h2 for the London bishop before Black can chase it.", {
          theme: "keep the bishop",
          commonMistake: "Letting …Nh5 trade off your best bishop.",
          hintLevel1: "Your dark-square bishop could be chased. Give it a retreat.",
          hintLevel2: "A rook-pawn move creates the square h2 for the bishop.",
          revealExplanation: "h3 — the bishop can drop back to h2 and stay on the diagonal.",
        }),
      ],
    },
  ],
};

// Shared Caro-Kann opening plies (1.e4 c6 2.d4 d5), reused by every main line.
const caroE4 = m("White grabs the center.");
const caroC6 = m(
  "Prepare …d5 to challenge e4 without blocking the light-square bishop.",
  {
    theme: "the Caro-Kann idea",
    commonMistake: "Playing …e6 too early traps the light-square bishop on c8.",
    hintLevel1: "Support a future …d5 break with a pawn.",
    hintLevel2: "…c6 backs up the …d5 break and keeps c8 open.",
    revealExplanation:
      "c6 — the Caro-Kann: prepare …d5 while keeping the c8-bishop free.",
  },
);
const caroD4 = m("White builds a broad center.");
const caroD5 = m("Strike at e4 now that it is supported by the c6 pawn.", {
  theme: "central break",
  hintLevel1: "Challenge White's e4 pawn directly.",
  hintLevel2: "…d5 hits e4 with the support of c6.",
  revealExplanation: "d5 — the central break, the point of …c6.",
});
const caroStart = [caroE4, caroC6, caroD4, caroD5];

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
      moves: [...caroStart],
    },
    {
      name: "Advance Variation",
      startingFen: START_FEN,
      priority: 2,
      active: true,
      description:
        "White closes the center with e5; Black frees the bishop, then attacks the pawn chain with …c5.",
      pgn: "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 cxd4 7. Nxd4 Ne7",
      moves: [
        ...caroStart,
        m("White closes the center with the Advance Variation."),
        m(
          "Develop the light-square bishop OUTSIDE the pawn chain before …e6 can lock it in.",
          {
            theme: "free the bad bishop",
            commonMistake:
              "Playing …e6 first imprisons the c8-bishop behind the chain.",
            hintLevel1: "Develop your light-square bishop before you play …e6.",
            hintLevel2: "The c8-bishop belongs on f5, outside the chain.",
            revealExplanation:
              "Bf5 — get the light-square bishop out before closing with …e6.",
          },
        ),
        m("The quiet main line: White develops and supports d4."),
        m("Now …e6 is safe: the bishop is already outside, and f8 is free to develop.", {
          theme: "solid structure",
          hintLevel1: "Your bishop is out. Now open the other bishop's path.",
          hintLevel2: "A pawn move to e6 frees the f8-bishop and supports d5.",
          revealExplanation: "e6 — build the chain d5/e6 behind your active bishop.",
        }),
        m("White prepares to castle (the Short System)."),
        m("Attack the base of White's pawn chain: d4.", {
          theme: "hit the chain's base",
          commonMistake: "Waiting passively lets White build up on the kingside for free.",
          hintLevel1: "Against a pawn chain, attack its base.",
          hintLevel2: "The c-pawn can strike at d4.",
          revealExplanation: "c5 — the thematic break against d4, the base of White's chain.",
        }),
        m("White adds a defender to d4."),
        m("Trade on d4 to open the c-file for your pieces.", {
          theme: "open the c-file",
          hintLevel1: "Resolve the tension on d4 now.",
          hintLevel2: "Capture toward the center with the c-pawn.",
          revealExplanation: "cxd4 — open the c-file; the knight recapture can be met calmly.",
        }),
        m("White recaptures, and the knight now attacks your bishop on f5."),
        m("Defend the bishop with the knight; it can head to c6 or g6 next.", {
          theme: "protect the bishop",
          commonMistake: "Leaving the f5-bishop hanging to Nxf5.",
          hintLevel1: "Something of yours is attacked. Defend it while developing.",
          hintLevel2: "Your g8-knight can guard f5.",
          revealExplanation: "Ne7 — guard f5 and develop; the knight reroutes to c6 or g6 later.",
        }),
      ],
    },
    {
      name: "Advance: 4.Nc3 and g4",
      startingFen: START_FEN,
      priority: 3,
      active: true,
      description:
        "White chases the bishop with an early g4; Black keeps it on the diagonal and strikes with …c5.",
      pgn: "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nc3 e6 5. g4 Bg6 6. Nge2 c5",
      moves: [
        ...caroStart,
        m("White closes the center with the Advance Variation."),
        m("Develop the bishop outside the pawn chain.", { theme: "free the bad bishop" }),
        m("White develops the queen's knight, preparing an aggressive g4."),
        m("Open the f8-bishop and support d5.", {
          theme: "solid structure",
          hintLevel1: "Free your dark-square bishop.",
          hintLevel2: "The e-pawn supports d5 and opens f8.",
          revealExplanation: "e6 — same structure as the main line.",
        }),
        m("White gains space and attacks your bishop."),
        m("Retreat to g6, staying on the same diagonal and ready to return.", {
          theme: "keep the bishop active",
          commonMistake: "Retreating to c8 or d7 buries the bishop again.",
          hintLevel1: "Your bishop is attacked. Keep it active.",
          hintLevel2: "Step back along the diagonal, not into your own camp.",
          revealExplanation: "Bg6 — the bishop stays outside the chain.",
        }),
        m("White develops and prepares h4 or Nf4."),
        m("Counterattack in the center: hit d4 while White is busy on the kingside.", {
          theme: "hit the chain's base",
          hintLevel1: "Wing attacks are met by central counterplay.",
          hintLevel2: "The c-pawn strikes at d4.",
          revealExplanation: "c5 — central counterplay is the best answer to a wing attack.",
        }),
      ],
    },
    {
      name: "Classical Variation",
      startingFen: START_FEN,
      priority: 4,
      active: true,
      description:
        "Black releases the central tension, develops the bishop actively, and trades it off for a rock-solid position.",
      pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6",
      moves: [
        ...caroStart,
        m("White develops and defends e4."),
        m("Release the central tension on your terms.", {
          theme: "exchange tension",
          hintLevel1: "Your d5 pawn is under pressure. Resolve the tension.",
          hintLevel2: "Capture on e4.",
          revealExplanation: "dxe4 — trade in the center; your bishop comes out next with tempo.",
        }),
        m("White recaptures, centralizing the knight."),
        m("Develop the bishop actively, hitting the e4-knight.", {
          theme: "active development",
          commonMistake: "Delaying development lets White seize space for free.",
          hintLevel1: "Develop your light-square bishop and challenge the knight.",
          hintLevel2: "…Bf5 attacks the e4-knight with tempo.",
          revealExplanation: "Bf5 — active development, the point of the Classical Caro-Kann.",
        }),
        m("White attacks the bishop with the knight."),
        m("Retreat along the diagonal to g6.", {
          theme: "keep the bishop active",
          hintLevel1: "Your bishop is attacked. Keep it on the same diagonal.",
          hintLevel2: "g6 keeps the bishop active and safe.",
          revealExplanation: "Bg6 — the standard retreat.",
        }),
        m("White threatens h5, trapping the bishop."),
        m("Make room for the bishop on h7 so h5 doesn't trap it.", {
          theme: "escape square",
          commonMistake: "Ignoring h4-h5, after which the bishop is trapped.",
          hintLevel1: "White's h-pawn wants to trap your bishop. Prepare a retreat.",
          hintLevel2: "Push your h-pawn one square.",
          revealExplanation: "h6 — the bishop can drop to h7 when h5 comes.",
        }),
        m("White develops and supports h5."),
        m("Develop the knight to d7, controlling e5 and preparing …Ngf6.", {
          theme: "control e5",
          hintLevel1: "Stop White's knight from landing on e5.",
          hintLevel2: "The b8-knight goes to d7, guarding e5.",
          revealExplanation: "Nd7 — keep the white knights off e5.",
        }),
        m("White gains space with h5."),
        m("Retreat to h7, the square you prepared.", {
          theme: "escape square",
          hintLevel1: "Your bishop is attacked again. Use the square you made.",
          hintLevel2: "h7 is waiting for it.",
          revealExplanation: "Bh7 — safe, and still on the b1-h7 diagonal.",
        }),
        m("White offers to trade light-square bishops."),
        m("Trade bishops; your position becomes very solid.", {
          theme: "simplify",
          hintLevel1: "White's bishop challenges yours. Trade.",
          hintLevel2: "Capture on d3.",
          revealExplanation: "Bxd3 — trade the bishops; your remaining pieces fit the pawn structure well.",
        }),
        m("White recaptures with the queen."),
        m("Complete the pawn structure and free the f8-bishop.", {
          theme: "solid structure",
          hintLevel1: "Open the path for your remaining bishop.",
          hintLevel2: "The e-pawn move does it and supports …Ngf6.",
          revealExplanation: "e6 — finish development next with …Ngf6, …Be7 and castle.",
        }),
      ],
    },
    {
      name: "Classical via 3.Nd2",
      startingFen: START_FEN,
      priority: 5,
      active: true,
      description:
        "3.Nd2 transposes to the Classical after …dxe4 Nxe4: same plan, same position.",
      pgn: "1. e4 c6 2. d4 d5 3. Nd2 dxe4 4. Nxe4 Bf5",
      moves: [
        ...caroStart,
        m("White develops the knight to d2, keeping c3 free."),
        m("Same answer as against 3.Nc3: trade on e4.", {
          theme: "exchange tension",
          hintLevel1: "Treat this like 3.Nc3.",
          hintLevel2: "Capture on e4.",
          revealExplanation: "dxe4 — after Nxe4 the position is the Classical Variation.",
        }),
        m("White recaptures, reaching the Classical position."),
        m("Develop the bishop with tempo on the knight.", {
          theme: "active development",
          hintLevel1: "You've seen this position before.",
          hintLevel2: "…Bf5 attacks the knight.",
          revealExplanation: "Bf5 — the Classical Variation by transposition.",
        }),
      ],
    },
    {
      name: "Exchange Variation",
      startingFen: START_FEN,
      priority: 6,
      active: true,
      description: "A symmetrical structure; develop actively and use the half-open c-file.",
      pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qd7",
      moves: [
        ...caroStart,
        m("White trades into the Exchange Variation."),
        m("Recapture toward the center, reaching a clean symmetrical structure.", {
          theme: "symmetry",
          commonMistake: "Drifting passively instead of developing with a plan.",
          hintLevel1: "Recapture the pawn toward the center.",
          hintLevel2: "…cxd5 keeps a sound pawn on d5.",
          revealExplanation:
            "cxd5 — recapture toward the center; develop actively and avoid passivity.",
        }),
        m("White develops the bishop toward your kingside."),
        m("Develop the knight and pressure d4.", {
          theme: "pressure d4",
          hintLevel1: "Develop a knight toward the center.",
          hintLevel2: "The b8-knight eyes d4 from c6.",
          revealExplanation: "Nc6 — develop and pressure d4.",
        }),
        m("White supports d4 with c3."),
        m("Develop the other knight, guarding h7 and d5.", {
          theme: "development",
          hintLevel1: "Bring out your other knight.",
          hintLevel2: "f6 is its natural square.",
          revealExplanation: "Nf6 — develop and guard the kingside.",
        }),
        m("White develops the dark-square bishop London-style."),
        m("Develop the light-square bishop actively before …e6 shuts it in.", {
          theme: "active bishop",
          commonMistake: "Playing …e6 first and burying the c8-bishop.",
          hintLevel1: "Get your light-square bishop out first.",
          hintLevel2: "From g4 it attacks the white queen on d1.",
          revealExplanation: "Bg4 — active development; …e6 can follow.",
        }),
        m("White's queen hits b7 and d5."),
        m("Guard b7 calmly with the queen; your development is fine.", {
          theme: "defend calmly",
          commonMistake: "Grabbing material or panicking; just protect b7.",
          hintLevel1: "Your b7 pawn is attacked.",
          hintLevel2: "The queen can defend b7 along the seventh rank.",
          revealExplanation: "Qd7 — b7 is defended and your pieces stay coordinated.",
        }),
      ],
    },
    {
      name: "Panov Attack",
      startingFen: START_FEN,
      priority: 7,
      active: true,
      description:
        "White plays c4 for an isolated-pawn position; Black develops quickly and blockades d5.",
      pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6",
      moves: [
        ...caroStart,
        m("White trades on d5."),
        m("Recapture toward the center.", {
          theme: "symmetry",
          hintLevel1: "Recapture the pawn toward the center.",
          hintLevel2: "Use the c-pawn.",
          revealExplanation: "cxd5 — as in the Exchange Variation.",
        }),
        m("The Panov: White attacks d5 with c4."),
        m("Defend d5 with a developing move.", {
          theme: "development",
          hintLevel1: "Your d5 pawn is attacked. Defend it while developing.",
          hintLevel2: "The g8-knight guards d5 from f6.",
          revealExplanation: "Nf6 — develop and defend d5.",
        }),
        m("White adds a second attacker to d5."),
        m("Support d5 with a pawn and open the f8-bishop.", {
          theme: "solid structure",
          hintLevel1: "Add a pawn defender to d5.",
          hintLevel2: "The e-pawn supports d5.",
          revealExplanation: "e6 — solid; develop with …Be7, …O-O and …Nc6 next.",
        }),
      ],
    },
    {
      name: "Fantasy Variation",
      startingFen: START_FEN,
      priority: 8,
      active: true,
      description:
        "White over-protects e4 with f3; Black reacts in the center rather than playing automatically.",
      pgn: "1. e4 c6 2. d4 d5 3. f3 dxe4 4. fxe4 e5",
      moves: [
        ...caroStart,
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
        m("White recaptures, with a big but loose center."),
        m("Hit d4 at once while White's kingside diagonal is weakened.", {
          theme: "punish the setup",
          hintLevel1: "Challenge White's center immediately.",
          hintLevel2: "Your e-pawn can attack d4.",
          revealExplanation: "e5 — break the center; …Qh4+ ideas appear on the weakened diagonal.",
        }),
      ],
    },
    {
      name: "Two Knights (2.Nc3 and 3.Nf3)",
      startingFen: START_FEN,
      priority: 9,
      active: true,
      description: "White develops knights first; Black pins and trades for a solid structure.",
      pgn: "1. e4 c6 2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 5. Qxf3 e6",
      moves: [
        caroE4,
        caroC6,
        m("White develops the knight instead of playing d4."),
        m("Strike at e4 anyway.", {
          theme: "central break",
          hintLevel1: "Same idea as always.",
          hintLevel2: "…d5 hits e4.",
          revealExplanation: "d5 — the Caro-Kann break works here too.",
        }),
        m("White develops the other knight."),
        m("Pin the f3-knight, which defends e5 and d4.", {
          theme: "active bishop",
          hintLevel1: "Develop your light-square bishop actively.",
          hintLevel2: "It pins the knight from g4.",
          revealExplanation: "Bg4 — develop with a pin.",
        }),
        m("White asks the bishop what it wants."),
        m("Trade on f3: White gets the bishop pair, you get a solid center.", {
          theme: "simplify",
          hintLevel1: "Retreating loses time. Decide now.",
          hintLevel2: "Capture the knight.",
          revealExplanation: "Bxf3 — a clean trade; play …e6 and …Nf6 next.",
        }),
        m("White recaptures with the queen."),
        m("Build the d5/e6 structure and free the f8-bishop.", {
          theme: "solid structure",
          hintLevel1: "Open your dark-square bishop.",
          hintLevel2: "Push the e-pawn one square.",
          revealExplanation: "e6 — solid; develop with …Nf6 and …Bd6 or …Be7.",
        }),
      ],
    },
    {
      name: "Against 2.c4",
      startingFen: START_FEN,
      priority: 10,
      active: true,
      description: "White plays an early c4; Black trades and regains the pawn with the knight.",
      pgn: "1. e4 c6 2. c4 d5 3. exd5 cxd5 4. cxd5 Nf6",
      moves: [
        caroE4,
        caroC6,
        m("White plays c4, aiming for Panov-style positions."),
        m("Strike at e4 anyway.", {
          theme: "central break",
          hintLevel1: "Same idea as always.",
          hintLevel2: "…d5 hits e4.",
          revealExplanation: "d5 — the Caro-Kann break.",
        }),
        m("White trades on d5."),
        m("Recapture with the c-pawn.", {
          theme: "central break",
          hintLevel1: "Take back toward the center.",
          hintLevel2: "Use the c-pawn.",
          revealExplanation: "cxd5 — keep a pawn on d5.",
        }),
        m("White trades again on d5."),
        m("Don't rush to recapture with the queen; develop the knight and take back on d5 next.", {
          theme: "development",
          commonMistake: "…Qxd5 early, after which Nc3 gains time on your queen.",
          hintLevel1: "Recover the pawn while developing.",
          hintLevel2: "Your g8-knight can win d5 back.",
          revealExplanation: "Nf6 — …Nxd5 next regains the pawn with a developed piece.",
        }),
      ],
    },
    {
      name: "Against 2.d3 (King's Indian Attack)",
      startingFen: START_FEN,
      priority: 11,
      active: true,
      description: "White plays a slow setup; Black takes the center with …d5 and …e5.",
      pgn: "1. e4 c6 2. d3 d5 3. Nd2 e5 4. Ngf3 Bd6",
      moves: [
        caroE4,
        caroC6,
        m("White plays a quiet d3, heading for a King's Indian Attack."),
        m("Take your share of the center.", {
          theme: "central break",
          hintLevel1: "Same idea as always.",
          hintLevel2: "…d5 hits e4.",
          revealExplanation: "d5 — central space.",
        }),
        m("White supports e4 with the knight."),
        m("Grab more space: with d3 played, White is slow, so take e5.", {
          theme: "take the center",
          hintLevel1: "White is slow. Claim more of the center.",
          hintLevel2: "Your e-pawn can go two squares.",
          revealExplanation: "e5 — a full pawn center against White's quiet setup.",
        }),
        m("White develops and attacks e5."),
        m("Defend e5 while developing the bishop.", {
          theme: "development",
          hintLevel1: "Your e5 pawn is attacked. Defend it with a developing move.",
          hintLevel2: "The f8-bishop can guard e5 from d6.",
          revealExplanation: "Bd6 — develop and defend; …Ne7 and castling follow.",
        }),
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
