---
id: dialect/typescript-async
type: dialect
title: TypeScript Async Smells
extends: concept/concurrency
triggers:
  paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
  imports: []
  always: false
severity_owner: false
---

# TypeScript Async Overlay

In addition to the concept-level async review above, also hunt for these TypeScript/JavaScript-specific smells. These extend — they do not replace — the concept-level hunt list. Inherit output format, severity scale, and the anti-confirmatory instruction from `concept/async`.

Actively hunt for:

- **Unhandled promise rejections.** A promise created but never awaited and never given a `.catch()`. In Node this is increasingly fatal; in browsers it's silent data loss.
- **`await` inside `.forEach()` / `.map()` / `.filter()`.** `forEach` does not await; the loop finishes before any of the async work does. `map` with an async callback produces `Promise<T>[]` that the author usually forgets to `Promise.all`.
- **`for...of` over remote calls where `Promise.all` is correct.** Sequential waterfall where parallel would be 10x faster.
- **`Promise.all` where one failure should not cancel siblings.** Should be `Promise.allSettled`.
- **`Promise.all` on unbounded input.** Fanning out one promise per row of a database result. Needs a concurrency-limited pool (`p-limit`, `p-map` with concurrency, or a hand-rolled semaphore).
- **Mixing `.then()` chains with `await`** in the same function. Almost always produces a bug at the boundary: a `.then` that returns a promise the outer `await` doesn't see.
- **Floating promises in event handlers, route handlers, and middleware.** Express/Koa/Fastify handlers that are `async` but whose framework version doesn't await them, so errors bypass error middleware.
- **Missing `AbortSignal` propagation.** Modern `fetch`, most HTTP clients, and Node's `timers/promises` all accept `AbortSignal`. Code that creates a controller and never plumbs the signal through is cancellation theatre.
- **`setTimeout` / `setInterval` in async code without cleanup.** Timers outlive their component, handler, or request.
- **`async` function that `return`s a value that is then `await`ed by the caller, inside a `try/catch` that was meant to catch errors** — but the function `return`s instead of `return await`s, so the catch doesn't fire. (The "return vs return await" trap.)
- **`Promise.race` without cleanup.** The losing promise keeps running and holding resources. Particularly bad with timeouts — the "timed out" request is still in flight.
- **Top-level `await` in modules** that will be imported by code with different expectations about module init timing.
- **`async` Array methods assumed to preserve order under concurrency.** They do when chained correctly but very often don't when the author parallelized.
- **Zone/AsyncLocalStorage context lost across awaits** — typically manifests as trace IDs, request IDs, or DB transactions silently vanishing mid-handler.
- **React-specific: `useEffect` callbacks that are `async` directly** (the return value becomes a promise, not a cleanup function) or `useEffect`s that kick off fetches without an abort/cleanup path, causing "set state on unmounted component" and racing responses.
- **Not awaiting dynamic imports** when the imported module has side effects the caller depends on.
- **`Promise` constructor misuse**: `new Promise(async (resolve, reject) => { ... })` — errors thrown in the async executor are swallowed.

For each finding, state the specific runtime consequence (silent failure, lost error, wrong order, memory leak, rejection handler bypassed) and the fix.
