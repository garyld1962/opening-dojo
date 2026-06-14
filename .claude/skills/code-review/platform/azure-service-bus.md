---
id: platform/azure-service-bus
type: platform
title: Azure Service Bus Smells
extends: concept/resilience
triggers:
  paths: []
  imports:
    - "Azure.Messaging.ServiceBus"
    - "Microsoft.Azure.ServiceBus"
    - "azure-servicebus"
    - "@azure/service-bus"
  always: false
severity_owner: false
---

# Azure Service Bus Overlay

In addition to the concept-level resilience review above, also hunt for these Azure Service Bus-specific smells. These extend — they do not replace — the concept-level hunt list. Inherit output format, severity scale, and the anti-confirmatory instruction from `concept/resilience`.

Service Bus has delivery semantics and operational behaviors that are not obvious from the SDK surface. Most of the bugs in this space come from authors who treat it like a generic queue.

Actively hunt for:

- **`ReceiveAndDelete` mode where `PeekLock` is required.** `ReceiveAndDelete` removes the message before the handler runs. Any crash, timeout, or bug loses the message permanently. Use `PeekLock` unless the workload genuinely tolerates data loss and the author has justified it.
- **Lock renewal not configured for long-running handlers.** Default lock duration is 30 seconds (configurable up to 5 minutes at the queue level). Handlers that process longer than the lock duration lose the lock, the message is redelivered, and the original handler then tries to complete a message it no longer owns.
- **Manual lock renewal loops** where `MaxAutoLockRenewalDuration` would do the job. Or the opposite: relying on auto-renewal without setting `MaxAutoLockRenewalDuration` to a value that actually covers the handler.
- **Handler that does not complete, abandon, or dead-letter the message on every code path.** Any path that returns without an explicit disposition leaks the lock until it expires, then the message is redelivered.
- **`CompleteAsync` / `AbandonAsync` / `DeadLetterAsync` after an `await` to an external call without checking the lock is still held.** If the external call took longer than the lock, completion will throw.
- **No dead-letter handling for poison messages.** A message that will never succeed (bad schema, permanent downstream rejection) loops forever between the queue and the handler, racking up `DeliveryCount` until it hits `MaxDeliveryCount` — which you are relying on being set correctly at the queue level, and which should be checked.
- **No explicit dead-letter draining strategy.** Dead-letter queue fills up and no one notices because there's no alert, no dashboard, and no drain job.
- **Idempotency not enforced on the handler.** Service Bus is at-least-once. If you don't deduplicate on `MessageId` or a business key, you will double-process. The duplicate detection window on the queue is a hint, not a substitute.
- **Session-enabled queues with handlers that don't respect session affinity.** Messages for the same `SessionId` must be processed in order and by one consumer at a time. Authors routinely forget the "in order" part and write handlers that parallelize within a session.
- **`MaxConcurrentCalls` and `MaxConcurrentSessions` left at defaults** on high-throughput consumers, or set to values the downstream can't support.
- **Prefetch count set high on slow handlers.** Prefetched messages hold their locks; slow handlers + high prefetch = mass lock expiration and mass redelivery.
- **`ServiceBusClient` / `ServiceBusSender` created per message.** These are meant to be long-lived. Per-message creation exhausts AMQP links and connections.
- **Schedule send / deferred messages without a replay/retrieval strategy.** Deferred messages require explicit retrieval by sequence number; code that defers and then has no way to get the message back is creating silent backlog.
- **Dead-lettering with empty or useless `DeadLetterReason` / `DeadLetterErrorDescription`.** Operators have to reconstruct why the message failed from logs — often impossible.
- **Transactions across Service Bus and a database** without understanding that Service Bus transactions are scoped to a single namespace and do not participate in DTC. The pattern people want (write to DB and send message atomically) requires outbox, not transactions.
- **Retry policy on the client plus retry via abandon-and-redeliver plus retry in the handler** — three layers of retry, exponential in combination, hammering downstream.
- **Dispositions called on a message received from a different client instance** (e.g., saved to DB and re-processed later). The lock doesn't travel; the disposition will fail.
- **Autoscale rule on queue length without considering dead-letter length** — scales the workers that are failing to process the poison messages.

For each finding, state the specific Service Bus behavior that produces the bug (lock expiration, redelivery, session violation, link exhaustion, etc.) and the fix. If the fix involves a queue-level setting the reviewer cannot see from the code, say so and add it to `Questions`.
