import Link from "next/link";
import { openings } from "@/lib/opening-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export const metadata = { title: "Openings — Opening Dojo" };

export default function OpeningsIndexPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Openings</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a repertoire to study and drill.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {openings.map((o) => (
          <Link key={o.slug} href={`/openings/${o.slug}`} className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{o.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{o.description}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Plays as {o.side} · {o.difficulty}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
