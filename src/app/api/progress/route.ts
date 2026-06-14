import { prisma, DEMO_USER_ID } from "@/lib/db";
import {
  overallConfidence,
  progressByOpening,
  weakLines,
} from "@/lib/progress-tracking";

/**
 * GET /api/progress?userId=<id>
 *
 * Returns a progress summary for a user: overall confidence, per-opening
 * progress, and the weakest lines. Defaults to the demo user when `userId` is
 * absent. Empty/no-data users yield zeros and empty arrays rather than errors.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? DEMO_USER_ID;

  const [overall, byOpening, weak] = await Promise.all([
    overallConfidence(prisma, userId),
    progressByOpening(prisma, userId),
    weakLines(prisma, userId),
  ]);

  return Response.json({
    userId,
    overallConfidence: overall,
    byOpening,
    weakLines: weak,
  });
}
