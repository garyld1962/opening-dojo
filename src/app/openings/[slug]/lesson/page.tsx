import { notFound } from "next/navigation";
import { getOpeningBySlug } from "@/lib/opening-content";
import { primaryLine } from "@/components/lesson-steps";
import { LessonClient } from "@/components/LessonClient";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opening = getOpeningBySlug(slug);
  if (!opening) notFound();

  const line = primaryLine(opening.lines);

  return (
    <LessonClient
      slug={slug}
      openingName={opening.name}
      side={opening.side}
      line={line}
    />
  );
}
