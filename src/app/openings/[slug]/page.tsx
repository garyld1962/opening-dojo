import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpeningBySlug } from "@/lib/opening-content";
import { buildLessonSteps, primaryLine } from "@/components/lesson-steps";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function OpeningOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opening = getOpeningBySlug(slug);
  if (!opening) notFound();

  const line = primaryLine(opening.lines);
  const steps = buildLessonSteps(line);

  const keyIdeas = Array.from(
    new Set(steps.map((s) => s.theme).filter((t): t is string => Boolean(t))),
  );
  const mistakes = steps
    .filter((s) => s.commonMistake)
    .map((s) => ({ san: s.san, moveNumber: s.moveNumber, text: s.commonMistake! }));

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/openings"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All openings
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{opening.name}</h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        Plays as {opening.side} · {opening.difficulty}
      </p>
      <p className="mt-4 text-muted-foreground">{opening.description}</p>

      <div className="mt-6 flex gap-3">
        <Link href={`/openings/${slug}/lesson`}>
          <Button>Start lesson</Button>
        </Link>
        <Link href={`/openings/${slug}/drill`}>
          <Button variant="secondary">Start drills</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Key ideas</CardTitle>
          </CardHeader>
          <CardContent>
            {keyIdeas.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {keyIdeas.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Solid, principled development.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Main setup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-1 text-sm text-muted-foreground">{line.name}</p>
            <ol className="space-y-0.5 font-mono text-sm">
              {steps.map((s) => (
                <li key={s.ply}>
                  {s.moveNumber}. {s.san}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {mistakes.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Common mistakes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {mistakes.map((mk) => (
                <li key={mk.moveNumber}>
                  <span className="font-mono font-medium">
                    {mk.moveNumber}. {mk.san}:{" "}
                  </span>
                  {mk.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
