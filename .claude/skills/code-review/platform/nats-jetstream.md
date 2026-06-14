---
id: platform/nats-jetstream
type: platform
title: NATS JetStream Smells
extends: concept/resilience
triggers:
  paths: []
  imports:
    - "NATS.Client.JetStream"
    - "NATS.Client"
    - "nats"
    - "nats.aio"
    - "@nats-io/jetstream"
    - "nats.js"
  always: false
severity_owner: false
---

# NATS JetStream Overlay

In addition to the concept-level resilience review above, also hunt for these NATS JetStream-specific smells. These extend — they do not replace — the concept-level hunt list. Inherit output format, severity scale, and the anti-confirmatory instruction from `concept/resilience`.

JetStream gives you persistence, acks, and replay on top of NATS. Almost every bug in this space comes from code that works against core NATS semantics (fire-and-forget pub/sub) when it should be working with JetStream semantics (durable, acked, replayable) — or vice versa.

Actively hunt for:

- **Publishing to a stream via core NATS `Publish` instead of JetStream `PublishAsync`.** The core publish has no ack, no dedup, no persistence confirmation. The author thinks the message is stored; it isn't.
- **Not awaiting the publish ack.** `PublishAsync` returns an ack — dropping it means you don't know whether the message was stored. Under network partition or stream unavailability, you'll silently lose messages.
- **Missing `MsgId` on publishes that need exactly-once semantics.** JetStream deduplicates on `Nats-Msg-Id` within the stream's duplicate window. No `MsgId` means every retry becomes a duplicate event.
- **Duplicate window shorter than the retry horizon.** Dedup only works if the retry arrives within the window. A 2-minute window with a 10-minute retry backoff is dedup theatre.
- **Ephemeral consumer where durable was intended.** Ephemeral consumers lose position when the subscriber disconnects. Fine for monitoring dashboards, wrong for anything that must process every message.
- **Durable consumer name derived from an ephemeral value** (process ID, pod name, random UUID at startup). Every restart creates a new consumer, each with its own unacknowledged backlog, leaking state on the stream.
- **`AckPolicy.None` on a work queue consumer.** No acks means no redelivery on failure — a silent crash loses the message. `AckPolicy.Explicit` is almost always the right choice for workers.
- **`AckPolicy.All` used like `Explicit`** — acking a message acks all prior messages on the consumer, which is usually not what the author wanted when they're handling messages individually.
- **Handler that does not ack, nak, or term on every code path.** Like lock disposition in Service Bus: any path that returns without a disposition leaves the message in-flight until `AckWait` expires, then redelivery.
- **`AckWait` shorter than handler processing time.** Causes redelivery while the original handler is still processing. The handler then tries to ack a message it no longer owns.
- **No `InProgress` heartbeat for long handlers.** For handlers that legitimately run longer than `AckWait`, periodic `InProgress` extends the ack deadline. Missing heartbeats cause the same redelivery-during-processing bug.
- **Poison message with no term path.** `Nak` without a delay retries immediately and forever. `MaxDeliver` should be set on the consumer and handlers should `Term` messages that will never succeed, otherwise the consumer thrashes.
- **`MaxDeliver` not set on durable consumers.** Default is unlimited. Guaranteed infinite redelivery of any permanently bad message.
- **No dead-letter strategy.** JetStream's advisory subjects (`$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.*`) fire when `MaxDeliver` is exhausted. Code that ignores them loses all knowledge of poison messages.
- **Consumer `FilterSubject` that doesn't match the stream's subject hierarchy.** Silent no-op; subscriber receives nothing and the author assumes "no messages" instead of "misconfigured."
- **Subject hierarchy designed without future wildcarding in mind.** Flat subjects like `orders` instead of `orders.{region}.{tenant}` — the stream works now but can't be filtered, replayed, or split later without migration.
- **Stream retention mismatched to workload.** `WorkQueuePolicy` deletes messages on ack — fine for work queues, catastrophic if multiple consumers were supposed to see the message. `LimitsPolicy` keeps messages based on size/age/count — the default, but easy to misconfigure and either run out of disk or lose messages older than the author expected.
- **Consumer `DeliverPolicy` wrong for the use case.** `DeliverAll` replays the entire stream on first connect — fine the first time, a disaster on a redeploy of a long-lived stream. `DeliverNew` skips all backlog. `DeliverByStartSequence` / `DeliverByStartTime` need careful thought.
- **Pull consumer with a batch size of 1** — throwing away JetStream's main throughput lever. Or pull consumer with a huge batch and a short `MaxWait`, causing tight-loop polling.
- **Push consumer with `FlowControl` off on a high-rate stream.** Consumer gets overwhelmed, messages pile up.
- **`NatsConnection` / `JetStreamContext` created per message or per request.** Connections are meant to be long-lived and reused. Per-message creation trashes the connection pool and breaks reconnect logic.
- **No handling of `Disconnected` / `Reconnecting` / `Closed` connection events.** The application keeps "publishing" into a disconnected client, messages buffer in the client, then either flush on reconnect (usually fine) or overflow the pending buffer and drop (not fine, and silent).
- **Idempotency not enforced on the handler.** JetStream is at-least-once. Same deal as Service Bus — dedup on `MsgId` or a business key or you will double-process on redelivery.
- **Transaction across JetStream publish and a database write** without an outbox pattern. NATS has no distributed transactions; the "publish then write DB" or "write DB then publish" ordering questions must be answered with an outbox, not with hope.
- **KV / Object Store bucket created per operation** instead of resolved once and reused.
- **Stream config drift** — code that declares stream config at startup and silently mutates a production stream's retention, replicas, or subjects because the code was updated without thinking about the effect on the running stream.

For each finding, state the specific JetStream behavior that produces the bug (ack expiration, redelivery, consumer drift, flow control exhaustion, etc.) and the fix. If the fix involves a stream- or consumer-level setting the reviewer cannot see from the code, say so and add it to `Questions`.
