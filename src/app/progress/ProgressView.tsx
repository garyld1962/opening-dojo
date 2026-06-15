import Link from "next/link";
import { Card } from "@/components/ui";
import type { ProgressSummaryView } from "./data";
import type { DrillSuggestion } from "./suggest";

function confidenceLabel(score: number): string {
  if (score >= 6) return "Strong";
  if (score >= 2) return "Developing";
  if (score > 0) return "Shaky";
  return "Needs work";
}

/**
 * Presentational progress dashboard (PRD §11.5). Pure render of a summary +
 * suggestion so it is unit-testable without a DB.
 */
export function ProgressView({
  summary,
  suggestion,
}: {
  summary: ProgressSummaryView;
  suggestion: DrillSuggestion | null;
}) {
  return (
    <div className="space-y-6" data-testid="progress-view">
      <section>
        <h2 className="text-lg font-semibold">Overall confidence</h2>
        <p className="text-3xl font-bold" data-testid="overall-confidence">
          {summary.overallConfidence.toFixed(1)}
        </p>
        <p className="text-sm text-muted-foreground">
          {confidenceLabel(summary.overallConfidence)}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Per-opening progress</h2>
        {summary.openings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No drills practiced yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {summary.openings.map((o) => (
              <li key={o.openingName}>
                <Card className="flex items-center justify-between p-3">
                  <span>{o.openingName}</span>
                  <span className="text-sm text-muted-foreground">
                    {o.averageConfidence.toFixed(1)} avg · {o.lineCount} line
                    {o.lineCount === 1 ? "" : "s"} · {o.completedLessons} mastered
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Weak lines</h2>
        {summary.weakLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Practice some drills to surface your weak spots.
          </p>
        ) : (
          <ul className="mt-2 space-y-1" data-testid="weak-lines">
            {summary.weakLines.map((w) => (
              <li key={w.lineId} className="text-sm">
                <Link
                  className="underline"
                  href={`/openings/${w.openingSlug}/drill`}
                >
                  {w.openingName} — {w.lineName}
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({w.confidenceScore.toFixed(1)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suggestion && (
        <section>
          <h2 className="text-lg font-semibold">Suggested next drill</h2>
          <Link
            className="inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
            href={suggestion.href}
            data-testid="suggested-drill"
          >
            Drill {suggestion.openingName}
            {suggestion.lineName ? ` — ${suggestion.lineName}` : ""}
          </Link>
        </section>
      )}
    </div>
  );
}
