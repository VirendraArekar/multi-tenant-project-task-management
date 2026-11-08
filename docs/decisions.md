# Architectural Decision Records (ADRs)

This document captures the key architectural trade-offs, evaluated alternatives, and rationale behind fundamental system design decisions in TeamBoard.

---

## ADR 001: Transactional Outbox Pattern vs. Direct Kafka Publishing

### Status
**Accepted**

### Context
When business actions occur (such as creating a task, moving a card on the Kanban board, or changing a member's role), downstream services require asynchronous notifications and audit log records. We had to choose how application services publish domain events to Apache Kafka.

### Alternatives Considered
1. **Direct Publishing inside Transaction**: Publish directly to Kafka inside the JPA `@Transactional` method.
   - *Downside*: If Kafka is slow, the database transaction remains open, holding HikariCP connections and database row locks. If the database commit subsequently fails, phantom events are emitted to Kafka.
2. **Direct Publishing after Transaction Commit (Spring `@TransactionalEventListener`)**: Publish to Kafka after transaction commit.
   - *Downside*: If the application crashes, server reboots, or Kafka is unreachable right after commit, the event is permanently lost, causing data inconsistency between database state and event log.
3. **Transactional Outbox Pattern**: Insert an `outbox_events` record in the same relational transaction as the business entity, and use an asynchronous relay (`OutboxRelayScheduler`) to poll and publish events to Kafka with acknowledgement and status updates.

### Decision
We adopted the **Transactional Outbox Pattern**.
- Guarantees **At-Least-Once Delivery**: No event can be lost because the event is committed atomically alongside the domain entity in MySQL.
- Protects database connection pool from broker latency spikes.
- Downstream consumers achieve **Exactly-Once Semantics (EOS)** by maintaining a `processed_events` deduplication table.

---

## ADR 002: Shared Database & Shared Schema vs. Database-per-Tenant

### Status
**Accepted**

### Context
TeamBoard is a multi-tenant SaaS application supporting organizations ranging from small startup teams to enterprise departments. We needed an isolation model balancing cost, operational complexity, and data safety.

### Alternatives Considered
1. **Database-per-Tenant**: Dedicated MySQL database for each organization.
   - *Pros*: Complete physical isolation.
   - *Cons*: Immense infrastructure overhead (managing thousands of connection pools and databases), slow schema migrations across thousands of databases, and inefficient resource utilization for small workspaces.
2. **Schema-per-Tenant (Multiple Schemas in single MySQL instance)**: Separate schema per workspace.
   - *Cons*: MySQL treats schemas as databases; schema count limits and migration complexity remain high.
3. **Shared Database, Shared Schema with Discriminator Column (`organization_id`)**: Every table includes `organization_id` with composite indexes and central RBAC/tenant verification on every request.

### Decision
We chose **Shared Database, Shared Schema** with mandatory `organization_id` scoping:
- Maximizes hardware utilization and supports instant organization creation without provisioning overhead.
- Schema migrations run cleanly in a single Flyway run.
- Data isolation is strictly verified at three layers:
  1. Central `TenantSecurityService` validates membership and permissions on every inbound request.
  2. All JPA repository queries are explicitly scoped by `organization_id`.
  3. Integration tests explicitly verify that cross-tenant access attempts return HTTP 403 Forbidden.

---

## ADR 003: Optimistic Locking (`@Version`) vs. Pessimistic Locking for Kanban Boards

### Status
**Accepted**

### Context
In real-time collaborative Kanban boards, two or more users may drag or update the same task concurrently. We required a concurrency control mechanism that prevents silent overwrites and lost updates.

### Alternatives Considered
1. **Pessimistic Locking (`SELECT ... FOR UPDATE`)**:
   - *Downside*: Forces database row locks during user review or interaction. If an API call hangs or network latency spikes, other users are blocked. Unsuitable for high-throughput collaborative drag-and-drop.
2. **Last-Write-Wins (Uncontrolled Overwrite)**:
   - *Downside*: Silently discards previous user edits without warning.
3. **Optimistic Concurrency Control via `@Version`**:
   - Entities maintain a `version` column. When updating or moving a task, the client sends its current `version`. The update verifies `WHERE id = :id AND version = :version`.

### Decision
We chose **Optimistic Concurrency Control (`@Version`)**:
- High throughput: No database locks are held while users view or drag cards.
- Detects concurrent collisions: If User B updates a task while User A had it open, User A's update fails with HTTP 409 Conflict.
- Frontend Rollback: The Next.js frontend implements optimistic UI updates with automatic rollback and re-sync on 409 responses, displaying a non-intrusive alert explaining the conflict.

---

## ADR 004: Redis Lua Token Bucket Rate Limiting vs. Fixed Window Counter

### Status
**Accepted**

### Context
To defend against credential stuffing, brute-force attacks, and API abuse, we needed distributed rate limiting operating across multiple backend replicas.

### Alternatives Considered
1. **Fixed Window Counter (Redis `INCR` + `EXPIRE`)**:
   - *Downside*: Suffers from "boundary burst" where a user can send 2x the quota around window transition boundaries (e.g., 60 requests at 00:59 and 60 requests at 01:00).
2. **Sliding Window Log (Redis Sorted Sets / `ZADD`)**:
   - *Downside*: Stores every timestamp in a Redis sorted set; high memory consumption under high request volume.
3. **Token Bucket Algorithm via Redis Lua Script**:
   - Tokens replenish smoothly at a steady rate. A single atomic Lua script computes token replenishment based on elapsed time, deducts a token if available, and returns current status and reset time.

### Decision
We chose the **Token Bucket Algorithm implemented via an atomic Redis Lua script**:
- Smooth traffic shaping: Accommodates small legitimate bursts while enforcing a steady refill rate.
- Minimal memory footprint: Only stores two numbers per client key (remaining tokens and last update timestamp).
- Distributed and atomic: Runs inside Redis single-threaded execution context, avoiding race conditions across backend replicas.
- Standards compliant: Returns `429 Too Many Requests` alongside `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` HTTP headers.
