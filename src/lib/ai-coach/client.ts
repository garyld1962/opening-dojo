import type { CoachRequest, CoachResponse } from "@/lib/types";
import { buildCoachPrompt } from "./prompt";
import { logCoachInteraction } from "./log";

/** Error thrown when the model/transport fails. The route turns this into a 503. */
export class CoachError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CoachError";
  }
}

export interface CallCoachOptions {
  /** Injectable for tests; defaults to global fetch. */
  transport?: typeof fetch;
  baseUrl?: string;
  model?: string;
  /** Abort the request after this many ms (default 20s) so a stalled model
   * server surfaces as a CoachError instead of hanging the request. */
  timeoutMs?: number;
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * Call the Ollama OpenAI-compatible chat endpoint with a constrained prompt and
 * return a CoachResponse. Server-side only — the endpoint is never exposed to
 * the client. Both the request and the response are logged (N5).
 */
export async function callCoach(
  req: CoachRequest,
  opts: CallCoachOptions = {},
): Promise<CoachResponse> {
  const transport = opts.transport ?? fetch;
  const baseUrl = opts.baseUrl ?? process.env.OLLAMA_BASE_URL;
  const model = opts.model ?? process.env.OLLAMA_MODEL;

  if (!baseUrl) {
    throw new CoachError("OLLAMA_BASE_URL is not configured");
  }
  if (!model) {
    throw new CoachError("OLLAMA_MODEL is not configured");
  }

  const { system, user } = buildCoachPrompt(req);

  logCoachInteraction({
    at: new Date().toISOString(),
    direction: "request",
    model,
    request: req,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await transport(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new CoachError("Coach transport request failed", { cause });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new CoachError(`Coach request failed with HTTP ${res.status}`);
  }

  let data: ChatCompletion;
  try {
    data = (await res.json()) as ChatCompletion;
  } catch (cause) {
    throw new CoachError("Coach response was not valid JSON", { cause });
  }

  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== "string") {
    throw new CoachError("Coach response did not contain an answer");
  }

  const response: CoachResponse = { answer, model };

  logCoachInteraction({
    at: new Date().toISOString(),
    direction: "response",
    model,
    response,
  });

  return response;
}
