import { DEMO_USER_ID } from "@/lib/db";
import { openings as content } from "@/lib/opening-content";
import { getProgressSummary } from "./progress/data";
import { suggestNextDrill } from "./progress/suggest";
import { HomeView, type RepertoireCard } from "./HomeView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const summary = await getProgressSummary(DEMO_USER_ID);
  const suggestion = suggestNextDrill(summary);
  const openings: RepertoireCard[] = content.map((o) => ({
    slug: o.slug,
    name: o.name,
    side: o.side,
    description: o.description,
    difficulty: o.difficulty,
  }));
  return (
    <HomeView
      openings={openings}
      overallConfidence={summary.overallConfidence}
      suggestion={suggestion}
    />
  );
}
