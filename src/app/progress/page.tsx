import { DEMO_USER_ID } from "@/lib/db";
import { ProgressView } from "./ProgressView";
import { getProgressSummary } from "./data";
import { suggestNextDrill } from "./suggest";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const summary = await getProgressSummary(DEMO_USER_ID);
  const suggestion = suggestNextDrill(summary);
  return (
    <main className="container mx-auto py-10">
      <h1 className="mb-6 text-2xl font-bold">Your Progress</h1>
      <ProgressView summary={summary} suggestion={suggestion} />
    </main>
  );
}
