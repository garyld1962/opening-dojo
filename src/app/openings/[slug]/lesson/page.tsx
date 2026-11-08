import { notFound } from "next/navigation";
import { getOpeningBySlug } from "@/lib/opening-content";
import { lineByPriority } from "@/components/lesson-steps";
import { LessonClient } from "@/components/LessonClient";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ line?: string }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const opening = getOpeningBySlug(slug);
  if (!opening) notFound();

  const line = lineByPriority(opening.lines, sp.line);

  return (
    <LessonClient
      slug={slug}
      openingName={opening.name}
      side={opening.side}
      line={line}
    />
  );
}
