---
id: dialect/csharp-async
type: dialect
title: C# Async Smells
extends: concept/concurrency
triggers:
  paths: ["**/*.cs"]
  imports: ["System.Threading.Tasks", "System.Threading"]
  always: false
severity_owner: false
---

# C# Async Overlay

In addition to the concept-level async review above, also hunt for these C#-specific smells. These extend — they do not replace — the concept-level hunt list. Inherit output format, severity scale, and the anti-confirmatory instruction from `concept/async`.

Actively hunt for:

- **`async void`** outside event handlers. Exceptions escape to the synchronization context and can't be caught. Any `async void` in a non-event-handler context is at least a major finding.
- **Sync-over-async via `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`.** In ASP.NET Core this can deadlock or exhaust the thread pool; in library code it makes the method hostile to every async caller.
- **Missing `ConfigureAwait(false)` in library code.** In code that may be called from a UI or legacy ASP.NET sync context, every `await` in non-application code should be `ConfigureAwait(false)` unless context is deliberately needed.
- **`ConfigureAwait(false)` in application code that then depends on `HttpContext` or UI context after the await.** The mirror problem — copy-pasted everywhere without thinking.
- **`Task.Run` on the server.** Offloading async work to the thread pool in a web handler doesn't add parallelism, it just moves the work to a different thread and adds overhead. Almost always wrong in ASP.NET.
- **`Task.Run` wrapping a genuinely blocking call with no cancellation path.** The wrapped work can't be cancelled; the `CancellationToken` argument is a lie.
- **`CancellationToken` parameters not threaded through.** Method accepts a token and then calls downstream methods without passing it. Especially common with `HttpClient`, `DbContext.SaveChangesAsync`, and `Stream` reads.
- **`CancellationToken.None` in new code.** A deliberate choice to opt out of cancellation, which is sometimes correct but should be justified. Flag for explanation.
- **`await` inside a `foreach` over remote calls where `Task.WhenAll` (or a bounded `Parallel.ForEachAsync`) would be correct.**
- **`Parallel.ForEach` around async delegates.** Does not await them; work escapes the loop.
- **`ValueTask` consumed more than once.** `ValueTask` may only be awaited once; using it like `Task` in caller code is a bug waiting to happen.
- **`async` method returning `Task` that does not `await` anything.** Free async state machine allocation for no reason — should be `Task.FromResult` or removed.
- **`IAsyncEnumerable<T>` materialized to `List<T>` unnecessarily,** defeating the point of streaming.
- **`EnumerableExtensions`-style chains (`.Select(async x => ...).ToList()`) that produce `List<Task<T>>` when the intent was sequential.** Either the caller forgets to `await` them and nothing runs, or they all run in parallel when the author expected sequential.
- **`lock` statements held across `await`.** The compiler will actually refuse this, but people work around it with `SemaphoreSlim` and then hold the semaphore across work that can fault without releasing.
- **`HttpClient` created per-request** instead of reused or from `IHttpClientFactory`. Exhausts sockets under load.
- **`DbContext` shared across concurrent awaits.** EF Core contexts are not thread-safe; two concurrent awaits on the same context corrupt state.
- **`ConfigureAwait(false)` on `Task.WhenAll` / `Task.WhenAny`** — noop; the inner tasks carry their own continuation context.

For each finding, state the specific runtime consequence in .NET terms (thread pool starvation, sync context deadlock, socket exhaustion, EF state corruption, etc.) and the fix.
