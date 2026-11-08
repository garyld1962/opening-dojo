import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import type { DrillSuggestion } from "./progress/suggest";

export interface TrainingSummary {
  due: number;
  newToday: number;
  learned: number;
  total: number;
}

export interface RepertoireCard {
  slug: string;
  name: string;
  side: "white" | "black";
  description: string;
  difficulty: string;
}

/**
 * Presentational Home (PRD §11.1): choose repertoire, opening cards, continue
 * practice, progress summary. Pure render of props — unit-testable without a DB.
 */
export function HomeView({
  openings,
  overallConfidence,
  suggestion,
  training,
}: {
  openings: RepertoireCard[];
  overallConfidence: number;
  suggestion: DrillSuggestion | null;
  training?: TrainingSummary | null;
}) {
  return (
    <main className="container mx-auto space-y-8 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Opening Dojo</h1>
        <p className="text-muted-foreground">
          Learn and drill the London System and the Caro-Kann.
        </p>
      </header>

      {training && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm" data-testid="home-training">
                <span className="font-semibold">{training.due}</span> due ·{" "}
                <span className="font-semibold">{training.newToday}</span> new ·{" "}
                {training.learned}/{training.total} positions learned
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/train"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-10"
                >
                  {training.due + training.newToday > 0 ? "Start today's reviews" : "Review"}
                </Link>
                <Link
                  href="/train?mode=line"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground sm:h-10"
                >
                  Play a line
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Choose your repertoire</h2>
        <div className="grid gap-4 sm:grid-cols-2" data-testid="repertoires">
          {openings.map((o) => (
            <Card key={o.slug}>
              <CardHeader>
                <CardTitle>{o.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {o.side === "white" ? "White" : "Black"} · {o.difficulty}
                </p>
                <p className="text-sm">{o.description}</p>
                <Link
                  className="inline-block text-sm underline"
                  href={`/openings/${o.slug}`}
                >
                  Open {o.name} →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {suggestion && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Continue practice</h2>
          <Link
            className="inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
            href={suggestion.href}
            data-testid="continue-practice"
          >
            Drill {suggestion.openingName}
            {suggestion.lineName ? ` — ${suggestion.lineName}` : ""}
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg font-semibold">Progress summary</h2>
        <p className="text-sm" data-testid="home-confidence">
          Overall confidence:{" "}
          <span className="font-semibold">
            {overallConfidence.toFixed(1)}
          </span>
        </p>
        <Link className="text-sm underline" href="/progress">
          View full progress →
        </Link>
      </section>
    </main>
  );
}
