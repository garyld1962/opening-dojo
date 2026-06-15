/**
 * Database seed.
 *
 * - Upserts the single demo user (idempotent).
 * - Seeds curated opening content. EVERY line's PGN is validated through
 *   chess-rules before insert (N8); an illegal line aborts the seed with a
 *   clear error. Content re-seeds are idempotent (existing content is wiped
 *   and recreated; the demo user and schema are untouched).
 *
 * `moveNumber` on MoveExplanation is stored as the 1-based half-move (ply)
 * index within the line — unique and naturally ordered. The displayed full
 * move number is `Math.ceil(moveNumber / 2)`.
 */
import { PrismaClient } from "../src/generated/prisma";
import { validateLineDetailed } from "../src/lib/chess-rules";
import { openings, type LineContent } from "../src/lib/opening-content";

const prisma = new PrismaClient();

const DEMO_USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

export class ContentValidationError extends Error {}

export interface SeedMoveRow {
  moveNumber: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  explanation: string;
  theme: string | null;
  commonMistake: string | null;
  hintLevel1: string | null;
  hintLevel2: string | null;
  revealExplanation: string | null;
}

/**
 * Validate one line's PGN through chess-rules and map curated content onto the
 * per-move FENs. Throws ContentValidationError if the PGN is illegal, the ply
 * count does not match the content, or any explanation is empty (N8, §6.2).
 */
export function buildLineMoves(line: LineContent): SeedMoveRow[] {
  const validated = validateLineDetailed(line.startingFen, line.pgn);
  if (!validated.ok) {
    throw new ContentValidationError(`Line "${line.name}": ${validated.error}`);
  }
  if (validated.moves.length !== line.moves.length) {
    throw new ContentValidationError(
      `Line "${line.name}": PGN has ${validated.moves.length} plies but ${line.moves.length} content entries`,
    );
  }
  return validated.moves.map((vm, i) => {
    const c = line.moves[i];
    if (!c.explanation || c.explanation.trim().length === 0) {
      throw new ContentValidationError(
        `Line "${line.name}" ply ${i + 1}: explanation is empty`,
      );
    }
    return {
      moveNumber: i + 1,
      san: vm.san,
      fenBefore: vm.fenBefore,
      fenAfter: vm.fenAfter,
      explanation: c.explanation,
      theme: c.theme ?? null,
      commonMistake: c.commonMistake ?? null,
      hintLevel1: c.hintLevel1 ?? null,
      hintLevel2: c.hintLevel2 ?? null,
      revealExplanation: c.revealExplanation ?? null,
    };
  });
}

export async function seedDemoUser(client: PrismaClient = prisma) {
  await client.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: { id: DEMO_USER_ID },
  });
}

export async function seedOpenings(client: PrismaClient = prisma) {
  // Validate ALL content up front so we never partially seed an illegal line.
  const prepared = openings.map((o) => ({
    opening: o,
    lines: o.lines.map((line) => ({ line, rows: buildLineMoves(line) })),
  }));

  await client.$transaction(async (tx) => {
    // Wipe existing content; DB-level cascades remove lines, moves, attempts,
    // and progress. The demo user is not an Opening child, so it survives.
    await tx.opening.deleteMany();

    for (const { opening, lines } of prepared) {
      const createdOpening = await tx.opening.create({
        data: {
          name: opening.name,
          side: opening.side,
          description: opening.description,
          difficulty: opening.difficulty,
        },
      });
      for (const { line, rows } of lines) {
        await tx.line.create({
          data: {
            openingId: createdOpening.id,
            name: line.name,
            startingFen: line.startingFen,
            moveSequencePgn: line.pgn,
            description: line.description,
            priority: line.priority,
            active: line.active,
            moves: { create: rows },
          },
        });
      }
    }
  });
}

async function main() {
  await seedDemoUser();
  await seedOpenings();
  const [openingCount, lineCount, moveCount] = await Promise.all([
    prisma.opening.count(),
    prisma.line.count(),
    prisma.moveExplanation.count(),
  ]);
  console.log(
    `Seeded demo user ${DEMO_USER_ID}; ${openingCount} openings, ${lineCount} lines, ${moveCount} move explanations.`,
  );
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
