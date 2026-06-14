---
id: dialect/python-async
type: dialect
title: Python Async Smells
extends: concept/concurrency
triggers:
  paths: ["**/*.py"]
  imports: ["asyncio", "anyio", "trio"]
  always: false
severity_owner: false
---

# Python Async Overlay

In addition to the concept-level async review above, also hunt for these Python-specific smells. These extend — they do not replace — the concept-level hunt list. Inherit output format, severity scale, and the anti-confirmatory instruction from `concept/async`.

Actively hunt for:

- **Blocking calls inside coroutines.** `requests`, `time.sleep`, `open().read()` on a large file, `subprocess.run`, `psycopg2` (non-async driver), `boto3` without the async extension, any CPU-bound work of meaningful size. One blocking call stalls the entire event loop.
- **`asyncio.run` called more than once in a process,** or called from inside a running loop. Both break.
- **Mixing `asyncio`, `trio`, and `anyio`** in the same process without a bridge. Usually a sign the author didn't realize a dependency brought its own loop.
- **`asyncio.gather` without `return_exceptions=True`** when partial failure should not cancel siblings. Default behavior cancels the rest on first exception.
- **`asyncio.gather` with `return_exceptions=True` but no one actually checks the results for exceptions.** Silent failure.
- **`asyncio.create_task` with the task reference dropped.** Python's GC can collect the task before it completes. Always assign to a variable and either `await` it or keep it in a set with a done callback that removes it.
- **Fire-and-forget via `asyncio.ensure_future` with no error handling.** Exceptions land on the loop's exception handler and often go nowhere useful.
- **`async for` over a generator that yields one remote call at a time** when the calls could be batched.
- **Unbounded `asyncio.gather` on user input.** Needs an `asyncio.Semaphore` or a bounded worker pattern.
- **Missing cancellation handling.** Coroutines that catch `Exception` without re-raising `asyncio.CancelledError` (pre-3.8 it was a subclass of `Exception`; still bites in legacy code and in overly broad `except`).
- **`asyncio.wait_for` used for timeouts without understanding that the underlying task keeps running after the timeout** unless the coroutine itself responds to cancellation.
- **Sync context managers (`with`) around async resources** that should use `async with`. Particularly common with database sessions and HTTP clients.
- **Calling `.result()` on a future from inside the event loop.** Deadlock.
- **`asyncio.Lock` held across an `await` to an unbounded external call.** Serializes the entire system on the slowest dependency.
- **Mixing threads and asyncio** without `loop.run_in_executor` or `asyncio.to_thread`. Thread calls asyncio code, asyncio code calls thread code, eventually something deadlocks.
- **`async def` functions that don't actually await anything.** Either vestigial or a sign the author wrapped a sync function in async without doing the work off-thread.
- **FastAPI/Starlette route handlers declared `def` (sync)** that do blocking I/O. Starlette runs them on a threadpool, which is correct, but the threadpool is small and the author usually didn't realize they opted in. Conversely, `async def` route handlers that call blocking libraries stall the loop.
- **Context variables (`contextvars.ContextVar`) set before an `await` but not propagated via `copy_context()`** when spawning tasks.
- **`aiohttp.ClientSession` created per request** instead of reused. Exhausts sockets.

For each finding, state the specific runtime consequence in Python terms (event loop stall, dropped task, cancellation not honored, GIL contention, threadpool exhaustion, etc.) and the fix.
