# TeamBoard Architecture & System Design Document

This document details the architectural topology, distributed patterns, data models, and scaling strategy of **TeamBoard** — a production-grade, multi-tenant SaaS project and task management platform.

---

## 1. High-Level System Architecture

TeamBoard is designed with a **stateless, horizontally scalable application layer** deployed behind an Nginx load balancing reverse proxy, backed by a persistent relational database (MySQL 8), an in-memory token bucket rate limiter and aggregate cache (Redis 7), and an event streaming backbone (Apache Kafka in KRaft mode).

```mermaid
graph TD
    subgraph Clients
        Browser["Desktop & Mobile Web Browsers (Next.js App Router)"]
    end

    subgraph Edge / Gateway
        Nginx["Nginx Reverse Proxy & Load Balancer (:80)<br/>Round-Robin, SSL Termination, Compression"]
    end

    subgraph Application Tier
        Backend1["Spring Boot Backend Replica 1 (:8080)<br/>Stateless, Java 25"]
        Backend2["Spring Boot Backend Replica 2 (:8080)<br/>Stateless, Java 25"]
    end

    subgraph Cache & Rate Limiting
        Redis[("Redis 7 Cluster / Store (:6379)<br/>Token Bucket Rate Limiting<br/>Aggregate Caching<br/>Token Revocation Store")]
    end

    subgraph Event Streaming & Outbox
        Kafka[("Apache Kafka 3.8.0 (KRaft Mode :9092)<br/>Topics: task, comment, membership, overdue<br/>Dead-Letter Topic: teamboard-dead-letter")]
    end

    subgraph Persistence Tier
        MySQL[("MySQL 8.0 Primary DB (:3306)<br/>Flyway Schema Migrations<br/>Composite Multi-Tenant Indexes")]
    end

    subgraph Observability
        Prometheus["Prometheus Scraper (:9090)"]
        Grafana["Grafana Dashboards (:3001)"]
    end

    Browser -->|HTTP/REST & Static Assets| Nginx
    Nginx -->|Round-Robin /api/v1| Backend1
    Nginx -->|Round-Robin /api/v1| Backend2
    Nginx -->|Proxy Frontend /| Browser

    Backend1 -->|Atomic Lua Scripts & Keys| Redis
    Backend2 -->|Atomic Lua Scripts & Keys| Redis

    Backend1 -->|JPA / HikariCP Pool| MySQL
    Backend2 -->|JPA / HikariCP Pool| MySQL

    Backend1 -->|Outbox Relay & Consumer Group| Kafka
    Backend2 -->|Outbox Relay & Consumer Group| Kafka

    Prometheus -->|Scrape /actuator/prometheus| Backend1
    Prometheus -->|Scrape /actuator/prometheus| Backend2
    Grafana -->|Query Metrics| Prometheus
```

---

## 2. Request Flow Lifecycle

Every inbound HTTP request progresses through a standardized multi-tenant pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Nginx as Nginx Gateway
    participant RateLimit as RateLimitingFilter (Redis)
    participant Auth as JwtAuthenticationFilter
    participant Tenant as TenantSecurityService
    participant Controller as REST Controller
    participant Service as Domain Service Layer
    participant DB as MySQL Database

    User->>Nginx: HTTP Request (e.g. GET /api/v1/organizations/42/projects/7/tasks)
    Note over Nginx: Injects X-Request-ID, client IP headers
    Nginx->>RateLimit: Forward to backend upstream (round-robin)
    RateLimit->>RateLimit: Evaluate Token Bucket via Redis Lua Script
    alt Rate limit exceeded (Tokens exhausted)
        RateLimit-->>User: 429 Too Many Requests (Retry-After, X-RateLimit headers)
    end
    RateLimit->>Auth: Request allowed
    Auth->>Auth: Validate JWT signature & check token revocation blacklist
    Auth->>Tenant: Resolve UserPrincipal & Claims
    Tenant->>Tenant: Verify User is ACTIVE Member of Organization (role lookup cache)
    alt Unauthorized organization access
        Tenant-->>User: 403 Forbidden ("You are not a member of this workspace")
    end
    Tenant->>Controller: Invocation authorized
    Controller->>Service: Call service with tenant context (orgId, currentUserId)
    Service->>DB: Query strictly scoped by organization_id
    DB-->>Service: Result set
    Service-->>Controller: DTO response
    Controller-->>User: 200 OK JSON { status, data, traceId }
```

---

## 3. Asynchronous Event Pipeline (Transactional Outbox Pattern)

To guarantee **zero lost messages** and prevent dual-write anomalies (e.g., database commit succeeds but Kafka producer fails or network partitions occur), TeamBoard strictly enforces the **Transactional Outbox Pattern**:

```mermaid
sequenceDiagram
    autonumber
    participant App as Service Layer
    participant OutboxTable as MySQL (outbox_events table)
    participant DomainTable as MySQL (tasks table)
    participant Relay as OutboxRelayScheduler
    participant Kafka as Apache Kafka Broker
    participant Consumer as EventConsumerService
    participant Dedup as MySQL (processed_events table)
    participant Notification as MySQL (notifications / activity_logs)

    App->>DomainTable: 1. INSERT/UPDATE task within JPA Transaction
    App->>OutboxTable: 2. INSERT outbox record (status: PENDING) within SAME Transaction
    DomainTable-->>App: Transaction Committed
    
    loop Every 1000ms (Outbox Relay)
        Relay->>OutboxTable: Poll top 100 PENDING events
        Relay->>Kafka: Publish event with partition key = organization_id
        Kafka-->>Relay: ACK received
        Relay->>OutboxTable: UPDATE status = SENT, sent_at = NOW()
    end

    Kafka->>Consumer: Deliver message to teamboard-consumer-group
    Consumer->>Dedup: INSERT INTO processed_events (event_id)
    alt Duplicate event detected (Unique constraint violation)
        Consumer-->>Kafka: Skip processing & ACK offset (Idempotent deduplication)
    else First-time event delivery
        Consumer->>Notification: Create Notification & ActivityLog records
        Consumer-->>Kafka: Commit consumer offset
    end
```

### Dead-Letter Queue (DLQ) Strategy
If a poison message fails deserialization or throws unexpected runtime exceptions after 3 retry attempts with exponential backoff (1s, 2s, 4s), it is automatically rerouted to the `teamboard-dead-letter` topic with failure metadata (`x-error-message`, `x-original-topic`, `x-exception-stacktrace`) to prevent blocking the consumer partition.

---

## 4. Multi-Tenant Data Model (Entity-Relationship Diagram)

TeamBoard implements a **shared database, shared schema** architecture. Every tenant-scoped entity carries a mandatory `organization_id` column with composite database indexes to enforce sub-millisecond query isolation.

```mermaid
erDiagram
    users ||--o{ organization_members : "belongs to"
    organizations ||--o{ organization_members : "has"
    organizations ||--o{ organization_invites : "issues"
    organizations ||--o{ projects : "owns"
    projects ||--o{ tasks : "contains"
    users ||--o{ tasks : "assigned to"
    users ||--o{ tasks : "reported by"
    tasks ||--o{ task_comments : "has"
    tasks ||--o{ task_labels : "tagged with"
    organizations ||--o{ activity_logs : "records"
    users ||--o{ notifications : "receives"
    organizations ||--o{ outbox_events : "publishes"

    users {
        BIGINT id PK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR full_name
        TIMESTAMP created_at
    }

    organizations {
        BIGINT id PK
        VARCHAR name
        VARCHAR slug UK
        TIMESTAMP created_at
    }

    organization_members {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT user_id FK
        VARCHAR role "OWNER, ADMIN, MEMBER"
        TIMESTAMP joined_at
    }

    organization_invites {
        BIGINT id PK
        BIGINT organization_id FK
        VARCHAR email
        VARCHAR role
        VARCHAR token UK
        BIGINT invited_by FK
        TIMESTAMP expires_at
        TIMESTAMP accepted_at
    }

    projects {
        BIGINT id PK
        BIGINT organization_id FK
        VARCHAR name
        TEXT description
        BOOLEAN is_archived
        BIGINT created_by FK
        TIMESTAMP created_at
    }

    tasks {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT project_id FK
        VARCHAR title
        TEXT description
        VARCHAR status "TODO, IN_PROGRESS, IN_REVIEW, DONE"
        VARCHAR priority "LOW, MEDIUM, HIGH, URGENT"
        BIGINT assignee_id FK
        BIGINT reporter_id FK
        DATE due_date
        DOUBLE position
        BIGINT version "Optimistic Locking"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    task_labels {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT task_id FK
        VARCHAR name
        VARCHAR color
    }

    task_comments {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT task_id FK
        BIGINT user_id FK
        TEXT content
        TIMESTAMP created_at
    }

    outbox_events {
        VARCHAR id PK
        BIGINT organization_id FK
        VARCHAR aggregate_type
        VARCHAR aggregate_id
        VARCHAR event_type
        VARCHAR topic
        JSON payload
        VARCHAR status "PENDING, SENT, FAILED"
        INT retry_count
        TIMESTAMP created_at
    }

    activity_logs {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT user_id FK
        VARCHAR action
        VARCHAR entity_type
        BIGINT entity_id
        VARCHAR entity_name
        TEXT details
        TIMESTAMP created_at
    }

    notifications {
        BIGINT id PK
        BIGINT organization_id FK
        BIGINT user_id FK
        VARCHAR title
        TEXT message
        VARCHAR type
        BOOLEAN is_read
        TIMESTAMP created_at
    }

    processed_events {
        VARCHAR event_id PK
        VARCHAR consumer_group
        TIMESTAMP processed_at
    }
```

### Key Database Index Decisions
1. **`idx_tasks_org_project_status` on `(organization_id, project_id, status)`**:
   - Accelerates Kanban board queries which group and filter tasks by column within a project. B-tree composite index satisfies multi-column filtering in a single index lookup without table scanning.
2. **`idx_tasks_org_project_position` on `(organization_id, project_id, status, position)`**:
   - Enables instant index-ordered retrieval of cards inside each Kanban column, preventing filesort operations during high-frequency drag-and-drop operations.
3. **`idx_org_members_org_user` on `(organization_id, user_id)`**:
   - Unique composite index ensuring that a user cannot join the same workspace twice, while providing instant $O(1)$ role and membership checks in `TenantSecurityService`.
4. **`idx_outbox_status_created` on `(status, created_at)`**:
   - Allows the `OutboxRelayScheduler` to poll pending messages ordered by insertion timestamp without locking the entire table.

---

## 5. Scaling to 100x Architecture

As the customer base grows from thousands of workspaces to 100x scale (hundreds of millions of tasks, 50,000+ requests/second), TeamBoard is architected to scale horizontally across every tier:

```mermaid
graph TD
    subgraph Edge Layer
        CDN["Global Cloudflare CDN<br/>Edge Caching for Next.js Static Pages, Chunks & Assets"]
        AnycastDNS["Anycast DNS Routing"]
    end

    subgraph Gateway Tier
        NginxCluster["Nginx High-Availability Load Balancer Pool (Keepalived / VRRP)"]
    end

    subgraph Service Layer (K8s)
        BackendHPA["Spring Boot Autoscaling Deployment (Horizontal Pod Autoscaler)<br/>Stateless Pods, CPU/Memory & Request Target Scaling"]
    end

    subgraph Cache Layer
        RedisCluster["Redis Cluster (Master-Replica with 6+ Shards)<br/>Key Hashing by org:{orgId}:* ensuring all tenant keys co-locate"]
    end

    subgraph Messaging Tier
        KafkaCluster["Multi-Node Apache Kafka Cluster<br/>Partition Key = organizationId<br/>Ensures strict FIFO ordering per tenant across 64+ Partitions"]
    end

    subgraph Storage Tier
        Router["Vitess / ProxySQL Database Sharding Proxy"]
        Shard1[("MySQL Shard 1 (Org IDs 0-9999)<br/>Primary + 2 Read Replicas")]
        Shard2[("MySQL Shard 2 (Org IDs 10000-19999)<br/>Primary + 2 Read Replicas")]
        ShardN[("MySQL Shard N (Org IDs ...)<br/>Primary + 2 Read Replicas")]
    end

    AnycastDNS --> CDN
    CDN --> NginxCluster
    NginxCluster --> BackendHPA
    BackendHPA --> RedisCluster
    BackendHPA --> KafkaCluster
    BackendHPA --> Router
    Router --> Shard1
    Router --> Shard2
    Router --> ShardN
```

### 1. MySQL Read Replicas & Connection Pooling
- **Read/Write Splitting**: Route write transactions (`INSERT`, `UPDATE`, `DELETE`, `PATCH`) to MySQL Primary, and delegate read traffic (`GET /kanban`, `GET /tasks`, `GET /activity-logs`, `GET /dashboard`) to read replicas via Spring's `AbstractRoutingDataSource`.
- **ProxySQL / Vitess**: Provide connection pooling and statement routing with sub-millisecond connection reuse, mitigating connection limits.

### 2. Sharding by `organization_id`
- Multi-tenancy inherently partitions data along tenant boundaries. Because 99.9% of queries include `WHERE organization_id = :orgId`, sharding by `hash(organization_id)` allows each tenant's entire working set to reside on a single shard.
- Cross-tenant queries are avoided by architectural design. Global user lookups (`users` table) are placed in a dedicated auth catalog or mirrored with read-heavy caching in Redis.

### 3. Kafka Partitioning by `organization_id`
- When publishing domain events (`task-events`, `comment-events`, `membership-events`, `overdue-events`), the message key is set strictly to `String.valueOf(organizationId)`.
- Kafka's default murmur2 hashing ensures all events for a given tenant land on the exact same partition, guaranteeing **strict sequential ordering** per workspace without bottlenecking other workspaces across independent consumer partitions.

### 4. Redis Cluster & Hash Tags
- Redis is scaled out using **Redis Cluster** with automatic sharding across 16,384 hash slots.
- By naming keys with hash tags like `{org:42}:dashboard`, `{org:42}:roles`, `{org:42}:rate-limit`, all keys related to tenant 42 map to the exact same hash slot, allowing atomic multi-key Lua scripts to execute without cross-slot errors.

### 5. Cloudflare CDN for Next.js App Router
- Next.js App Router static assets (`/_next/static/*`), icons, and static marketing/landing pages are cached globally across Cloudflare edge data centers.
- Dynamic routes use Server-Side Generation (SSG) with incremental cache invalidation, reducing origin server load by over 80%.
