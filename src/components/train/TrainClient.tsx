"use client";

/**
 * TrainClient — the repertoire trainer. One position at a time: find your
 * repertoire move (drag, or tap a piece then its square), with two hints
 * before the answer is shown. Results go to the server, which schedules the
 * position for review (spaced repetition).
 *
 * Layout: board on top and the panel below on phones; side by side from the
 * `md` breakpoint. The action buttons stay pinned to the bottom of the screen
 * on phones so you never have to scroll to reach "Next".
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Board } from "@/components/Board";
import { Button, Card, CardContent } from "@/components/ui";
import type { TrainItem, TrainMode, TrainSession, TrainStats } from "@/lib/training";
import { cn } from "@/lib/utils";
import {
  formatPath,
  initSession,
  isContinuation,
  isExpectedMove,
  sessionReducer,
  summarize,
} from "./session";

export interface TrainOpeningOption {
  slug: string;
  name: string;
}

export interface TrainClientProps {
  openings: TrainOpeningOption[];
  initialOpening: string;
  initialMode: TrainMode;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-10 rounded-full border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function StatsLine({ stats }: { stats: TrainStats }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid="train-stats">
      <span className="font-semibold text-foreground">{stats.due}</span> due ·{" "}
      <span className="font-semibold text-foreground">{stats.newToday}</span> new ·{" "}
      {stats.learned}/{stats.total} learned
    </p>
  );
}

export function TrainClient({ openings, initialOpening, initialMode }: TrainClientProps) {
  const router = useRouter();
  const routerRef = React.useRef(router);
  routerRef.current = router;
  const [opening, setOpening] = React.useState(initialOpening);
  const [mode, setMode] = React.useState<TrainMode>(initialMode);
  const [stats, setStats] = React.useState<TrainStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nextReview, setNextReview] = React.useState<string | null>(null);
  const [boardKey, setBoardKey] = React.useState(0);
  const [reloadCount, setReloadCount] = React.useState(0);
  const [state, dispatch] = React.useReducer(sessionReducer, initSession(initialMode, []));
  const postedRef = React.useRef<string>("");

  // Load a session whenever the opening or mode changes (or on "go again").
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/train?opening=${encodeURIComponent(opening)}&mode=${mode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s: TrainSession) => {
        if (cancelled) return;
        dispatch({ type: "load", mode: s.mode, items: s.items });
        setStats(s.stats);
        setNextReview(null);
        postedRef.current = "";
        setBoardKey((k) => k + 1);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    routerRef.current.replace(`/train?opening=${opening}&mode=${mode}`, { scroll: false });
    return () => {
      cancelled = true;
    };
  }, [opening, mode, reloadCount]);

  const item: TrainItem | undefined = state.items[state.index];

  // Persist each resolved position exactly once.
  React.useEffect(() => {
    if (state.status !== "resolved" || !item || !state.result) return;
    const key = `${state.index}:${item.cardKey}`;
    if (postedRef.current === key) return;
    postedRef.current = key;
    setNextReview(null);
    fetch("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardKey: item.cardKey,
        correct: state.result.correct,
        hintUsed: state.result.hintUsed,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { nextReview?: string } | null) => setNextReview(j?.nextReview ?? null))
      .catch(() => setNextReview(null));
  }, [state.status, state.index, state.result, item]);

  const onMove = React.useCallback(
    (san: string): boolean => {
      if (!item || state.status !== "asking") return false;
      dispatch({ type: "attempt", san });
      return isExpectedMove(item, san);
    },
    [item, state.status],
  );

  const goNext = React.useCallback(() => {
    if (state.status !== "resolved" || !item) return;
    const upcoming = state.items[state.index + 1];
    if (!upcoming || !isContinuation(item, upcoming)) setBoardKey((k) => k + 1);
    dispatch({ type: "next" });
  }, [state.status, state.items, state.index, item]);

  // Desktop keyboard shortcuts: Enter = next, H = hint.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "Enter" && state.status === "resolved") goNext();
      if ((e.key === "h" || e.key === "H") && state.status === "asking") dispatch({ type: "hint" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, goNext]);

  const resolved = state.status === "resolved";
  const boardFen = item ? (resolved ? item.fenAfter : item.fen) : undefined;
  const lastMove = item
    ? resolved
      ? { from: item.expectedFrom, to: item.expectedTo }
      : item.lastMove
    : null;
  const arrows: [string, string][] =
    item && resolved && !state.result?.correct ? [[item.expectedFrom, item.expectedTo]] : [];
  const marks = item && state.status === "asking" && state.hintLevel >= 2 ? [item.expectedFrom] : [];
  const position = state.index + 1;

  return (
    <main className="container mx-auto max-w-5xl pb-6 pt-4 sm:pt-8">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold">Train</h1>
        {stats && <StatsLine stats={stats} />}
      </header>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Choose what to train">
        <Chip active={opening === "all"} onClick={() => setOpening("all")}>
          All openings
        </Chip>
        {openings.map((o) => (
          <Chip key={o.slug} active={opening === o.slug} onClick={() => setOpening(o.slug)}>
            {o.name}
          </Chip>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-border sm:block" aria-hidden />
        <Chip active={mode === "review"} onClick={() => setMode("review")}>
          Due reviews
        </Chip>
        <Chip active={mode === "line"} onClick={() => setMode("line")}>
          Play a line
        </Chip>
      </div>

      {error && (
        <p className="text-destructive" role="alert">
          Could not load training ({error}).
        </p>
      )}
      {loading && !error && <p className="text-muted-foreground">Loading…</p>}

      {!loading && !error && state.status === "done" && (
        <SessionSummary
          log={state.log}
          stats={stats}
          mode={mode}
          onAgain={() => (mode === "review" ? setReloadCount((n) => n + 1) : setMode("review"))}
          onPlayLine={() => (mode === "line" ? setReloadCount((n) => n + 1) : setMode("line"))}
        />
      )}

      {!loading && !error && item && boardFen && state.status !== "done" && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,560px)_1fr] md:gap-6">
          <div className="flex justify-center">
            <Board
              key={boardKey}
              fen={boardFen}
              orientation={item.side}
              onMove={onMove}
              interactive={state.status === "asking"}
              lastMove={lastMove}
              markSquares={marks}
              arrows={arrows}
            />
          </div>

          <section className="flex flex-col gap-3" data-testid="train-panel">
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.openingName}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {position} of {state.items.length}
                  </span>
                  {item.isNew && (
                    <span className="rounded bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                      New position
                    </span>
                  )}
                </div>

                <p className="break-words font-mono text-sm" data-testid="train-path">
                  {item.path.length > 0 ? formatPath(item.path) : "Starting position"}
                  {!resolved && <span className="text-muted-foreground"> …?</span>}
                  {resolved && <strong> {item.expectedSan}</strong>}
                </p>

                {state.status === "asking" && (
                  <>
                    <p className="text-lg font-medium" data-testid="train-prompt">
                      {item.side === "white" ? "White" : "Black"} to move: find your{" "}
                      {item.openingName} move.
                    </p>
                    {item.isNew && state.hintLevel === 0 && !state.wrongSan && (
                      <p className="text-sm text-muted-foreground">
                        New here? Use a hint, or show the answer. It comes back later today
                        so you can recall it.
                      </p>
                    )}
                    {state.wrongSan && (
                      <p className="text-amber-700 dark:text-amber-400" data-testid="train-wrong">
                        {state.wrongSan} isn&apos;t the repertoire move. Try again.
                      </p>
                    )}
                    {state.hintLevel >= 1 && (
                      <p className="text-sm" data-testid="train-hint1">
                        <span className="font-medium">Hint: </span>
                        {item.hint1}
                      </p>
                    )}
                    {state.hintLevel >= 2 && (
                      <p className="text-sm" data-testid="train-hint2">
                        <span className="font-medium">Hint: </span>
                        {item.hint2}
                      </p>
                    )}
                  </>
                )}

                {resolved && state.result && (
                  <div className="space-y-2" data-testid="train-result">
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        state.result.outcome === "clean" && "text-green-700 dark:text-green-400",
                        state.result.outcome === "hinted" && "text-amber-700 dark:text-amber-400",
                        state.result.outcome === "missed" && "text-red-700 dark:text-red-400",
                      )}
                    >
                      {state.result.outcome === "clean" && `Correct: ${item.expectedSan}`}
                      {state.result.outcome === "hinted" && `Correct, with a hint: ${item.expectedSan}`}
                      {state.result.outcome === "missed" && `The move is ${item.expectedSan}`}
                    </p>
                    <p>{item.explanation}</p>
                    {item.theme && (
                      <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {item.theme}
                      </span>
                    )}
                    {item.commonMistake && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Common mistake: </span>
                        {item.commonMistake}
                      </p>
                    )}
                    {nextReview && (
                      <p className="text-xs text-muted-foreground" data-testid="train-next-review">
                        You&apos;ll see this position again in {nextReview}.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pinned to the bottom of the screen on phones; inline on desktop. */}
            <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
              {state.status === "asking" && (
                <>
                  <Button
                    variant="secondary"
                    className="h-12 flex-1 md:h-10"
                    onClick={() => dispatch({ type: "hint" })}
                  >
                    {state.hintLevel < 2 ? "Hint" : "Show answer"}
                  </Button>
                  {state.hintLevel < 2 && (
                    <Button
                      variant="ghost"
                      className="h-12 flex-1 border md:h-10"
                      onClick={() => {
                        dispatch({ type: "hint" });
                        dispatch({ type: "hint" });
                        dispatch({ type: "hint" });
                      }}
                    >
                      Show answer
                    </Button>
                  )}
                </>
              )}
              {resolved && (
                <Button className="h-12 flex-1 md:h-10" onClick={goNext} autoFocus>
                  {state.index + 1 >= state.items.length && state.result?.outcome !== "missed"
                    ? "Finish"
                    : mode === "line"
                      ? "Continue"
                      : "Next position"}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function SessionSummary({
  log,
  stats,
  mode,
  onAgain,
  onPlayLine,
}: {
  log: { cardKey: string; outcome: "clean" | "hinted" | "missed" }[];
  stats: TrainStats | null;
  mode: TrainMode;
  onAgain: () => void;
  onPlayLine: () => void;
}) {
  const s = summarize(log);
  const empty = log.length === 0;
  return (
    <Card data-testid="train-summary">
      <CardContent className="space-y-4 pt-4">
        {empty ? (
          <>
            <p className="text-lg font-semibold">Nothing due right now.</p>
            <p className="text-sm text-muted-foreground">
              {stats && stats.unseen > 0
                ? `${stats.unseen} new positions are waiting; more unlock tomorrow. Play a line to keep practicing.`
                : "You've learned every position. Play a line to keep them sharp."}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {mode === "line" ? "Line complete." : "Session complete."}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{s.clean}</p>
                <p className="text-xs text-muted-foreground">first try</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{s.hinted}</p>
                <p className="text-xs text-muted-foreground">with a hint</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{s.missed}</p>
                <p className="text-xs text-muted-foreground">shown</p>
              </div>
            </div>
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-12 flex-1 sm:h-10" onClick={onPlayLine}>
            {mode === "line" ? "Play another line" : "Play a line"}
          </Button>
          <Button variant="secondary" className="h-12 flex-1 sm:h-10" onClick={onAgain}>
            Check for due reviews
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
