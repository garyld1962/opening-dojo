import type { ProgressSummaryView } from "./data";
import { openings as content } from "@/lib/opening-content";

export interface DrillSuggestion {
  openingSlug: string;
  openingName: string;
  /** The specific weak line to drill, when progress data points at one. */
  lineName: string | null;
  href: string;
}

/**
 * Suggest the next drill: the user's weakest line if any progress exists,
 * otherwise the first curated opening. Always returns a real drill route.
 */
export function suggestNextDrill(
  summary: ProgressSummaryView,
): DrillSuggestion | null {
  const weakest = summary.weakLines[0];
  if (weakest && weakest.openingSlug) {
    return {
      openingSlug: weakest.openingSlug,
      openingName: weakest.openingName,
      lineName: weakest.lineName,
      href: `/openings/${weakest.openingSlug}/drill`,
    };
  }
  const first = content[0];
  if (!first) return null;
  return {
    openingSlug: first.slug,
    openingName: first.name,
    lineName: null,
    href: `/openings/${first.slug}/drill`,
  };
}
