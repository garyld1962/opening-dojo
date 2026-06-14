import { prisma } from "@/lib/db";
import {
  overallConfidence,
  progressByOpening,
  weakLines,
} from "@/lib/progress-tracking";
import { openings as content } from "@/lib/opening-content";

export interface OpeningProgressView {
  openingName: string;
  openingSlug: string;
  averageConfidence: number;
  lineCount: number;
  completedLessons: number;
}

export interface WeakLineView {
  lineId: string;
  lineName: string;
  openingName: string;
  openingSlug: string;
  confidenceScore: number;
}

export interface ProgressSummaryView {
  overallConfidence: number;
  openings: OpeningProgressView[];
  weakLines: WeakLineView[];
}

/** Map a DB opening name to its content-layer slug (slug is content-only). */
function slugForOpeningName(name: string): string {
  return content.find((o) => o.name === name)?.slug ?? "";
}

/**
 * Build the dashboard progress summary for a user, enriching the DB-keyed
 * progress rows with opening names + content slugs and line names so the UI can
 * link to real routes. Empty data yields zeros / empty arrays, never throws.
 */
export async function getProgressSummary(
  userId: string,
): Promise<ProgressSummaryView> {
  const [overall, byOpening, weak] = await Promise.all([
    overallConfidence(prisma, userId),
    progressByOpening(prisma, userId),
    weakLines(prisma, userId, 5),
  ]);

  const openingIds = byOpening.map((o) => o.openingId);
  const lineIds = weak.map((w) => w.lineId).filter((id): id is string => !!id);

  const [dbOpenings, dbLines] = await Promise.all([
    prisma.opening.findMany({
      where: { id: { in: openingIds } },
      select: { id: true, name: true },
    }),
    prisma.line.findMany({
      where: { id: { in: lineIds } },
      select: { id: true, name: true, opening: { select: { name: true } } },
    }),
  ]);

  const openingNameById = new Map(dbOpenings.map((o) => [o.id, o.name]));
  const lineById = new Map(dbLines.map((l) => [l.id, l]));

  const openingsView: OpeningProgressView[] = byOpening.map((o) => {
    const name = openingNameById.get(o.openingId) ?? "Unknown opening";
    return {
      openingName: name,
      openingSlug: slugForOpeningName(name),
      averageConfidence: o.averageConfidence,
      lineCount: o.lineCount,
      completedLessons: o.completedLessons,
    };
  });

  const weakView: WeakLineView[] = weak
    .filter((w) => w.lineId)
    .map((w) => {
      const line = lineById.get(w.lineId as string);
      const openingName = line?.opening.name ?? "Unknown opening";
      return {
        lineId: w.lineId as string,
        lineName: line?.name ?? "Unknown line",
        openingName,
        openingSlug: slugForOpeningName(openingName),
        confidenceScore: w.confidenceScore,
      };
    });

  return {
    overallConfidence: overall,
    openings: openingsView,
    weakLines: weakView,
  };
}
