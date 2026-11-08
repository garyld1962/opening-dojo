import { openings } from "@/lib/opening-content";
import { TrainClient } from "@/components/train/TrainClient";

export const metadata = { title: "Train — Opening Dojo" };

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ opening?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const valid = new Set(openings.map((o) => o.slug));
  const opening = sp.opening && valid.has(sp.opening) ? sp.opening : "all";
  const mode = sp.mode === "line" ? "line" : "review";
  return (
    <TrainClient
      openings={openings.map((o) => ({ slug: o.slug, name: o.name }))}
      initialOpening={opening}
      initialMode={mode}
    />
  );
}
