# Express Rate Limiter

A small TypeScript/Express reference implementation of request rate limiting. It separates the limiting algorithm from the persistence store and selects both through factories. The repository includes fixed-window, sliding-window, and token-bucket algorithms, plus in-memory, Redis, MongoDB, and MySQL stores.

> **Status:** useful for learning and local evaluation. The current read/modify/write algorithms are not atomic, so this project is not safe as-is for enforcing hard limits under concurrent production traffic. The production gaps below are deliberate context for evaluating the design.

## What problem does it solve?

Rate limiting bounds how often a caller can perform an action during a period. It helps protect an API from accidental retry storms, noisy tenants, scraping, credential-guessing, and disproportionate use of expensive endpoints. It can also implement product quotas, though billing-grade quotas usually need a separate durable accounting path.

The current middleware keys a bucket by Express's `req.ip`, asks an algorithm to consume a request against the configured store, then either calls `next()` or returns HTTP `429`. The default response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

## Quick start with Docker Compose

Requirements: Docker Engine/Desktop with the Compose plugin.

```sh
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Compose starts the application and Redis, MongoDB, and MySQL. The default selected store is Redis; the other databases are available so you can switch backends without changing the app code. Their data is stored in named Docker volumes.

Check health and make a request:

```sh
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/test
```

The default policy allows five requests per client IP in a 60-second fixed window. Make more requests to see `429 Too Many Requests`:

```sh
for i in $(seq 1 7); do
  curl -s -o /dev/null -w "$i: %{http_code}\n" http://localhost:3000/api/test
done
```

With a fresh bucket, expect five `200` responses followed by `429` responses. Wait for the window to expire before repeating the demonstration. `/health` is intentionally outside the limiter so container probes work while the application is throttling requests.

### Choose a store or algorithm

Set values in `.env`, then recreate the app container:

```dotenv
RATE_STORE=mongo
RATE_ALGORITHM=sliding-window
```

```sh
docker compose up --build -d
```

Supported `RATE_STORE` values are `memory`, `redis`, `mongo`, and `mysql`. Supported `RATE_ALGORITHM` values are `fixed-window`, `sliding-window`, and `token-bucket`. Compose starts all three database containers, but only the selected store is used by the rate limiter.

To stop the stack while retaining database data:

```sh
docker compose down
```

To also delete the local database volumes and their contents:

```sh
docker compose down -v
```

## Run without Docker

```sh
npm ci
npm run dev
```

Without `RATE_STORE`, the app uses the process-local memory store. For a local Redis instance:

```sh
RATE_STORE=redis REDIS_URL=redis://localhost:6379 npm run dev
```

MongoDB and MySQL use the connection environment variables below. Database connections are created and cached by `DatabaseFactory`; the store factory constructs the adapter selected by `RATE_STORE`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `RATE_STORE` | `memory` locally; `redis` in Compose | Persistence backend |
| `RATE_ALGORITHM` | `fixed-window` | Request accounting algorithm |
| `RATE_WINDOW_MS` | `60000` | Policy window or state TTL, in milliseconds |
| `RATE_MAX` | `5` | Maximum count/capacity for the current policy |
| `RATE_REFILL_RATE` | `1` | Token refill rate, in tokens per second; used by token bucket |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection URL |
| `MONGO_DB_NAME` | `rate_limiter` | MongoDB database |
| `MONGO_RATE_LIMIT_COLLECTION` | `rate_limits` | MongoDB collection |
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | empty locally; Compose development value in `.env.example` | MySQL password |
| `MYSQL_DATABASE` | `rate_limiter` | Existing MySQL database/schema |
| `MYSQL_RATE_LIMIT_TABLE` | `rate_limits` | Rate-limit table name; must be a simple SQL identifier |

`RATE_MAX`, `RATE_WINDOW_MS`, and `RATE_REFILL_RATE` must be positive numbers. The database names/credentials in Compose are for local development only. Use a secret manager and least-privileged database accounts outside local development.

## Algorithms: tradeoffs and fit

| Algorithm | Good fit | Advantages | Costs and behavior |
| --- | --- | --- | --- |
| Fixed window | Coarse per-minute/per-hour limits; simple API protection | Small state per key and low computation | A caller can use nearly `2 × max` around a window boundary (end of one window, then start of the next). |
| Sliding window | Smoother enforcement over the preceding interval | Avoids the fixed-window boundary burst | Stores timestamps per request and scans/filter them; memory and work grow with request volume. A production implementation should use a bounded approximation or an atomic sorted-set/script strategy. |
| Token bucket | APIs that allow short bursts while controlling long-run throughput | Separates burst capacity from average refill rate | Requires correct fractional refill accounting and atomic state updates. In this implementation, refill is floored to whole tokens on every request, so frequent requests can lose fractional refill. |

Algorithm names describe the intended policy; inspect the implementation before relying on strict semantics. For example, `RATE_REFILL_RATE` currently affects only the token-bucket algorithm.

## Stores: tradeoffs and fit

| Store | Good fit | Advantages | Costs and limits |
| --- | --- | --- | --- |
| Memory | Local development, demos, single-process tools | No infrastructure or network round trip | Every process has independent state; restarts erase it. Not suitable behind multiple workers/replicas. Its timer-based expiry can delete a refreshed record early because old timers are not cancelled. |
| Redis | General distributed API rate limiting | Low-latency shared state, native key TTL, natural fit for atomic scripts | Requires Redis availability, capacity planning, and an explicit failure policy. The current adapter stores records, but the algorithm's separate `GET` and `SET` are not atomic. |
| MongoDB | Systems already operating MongoDB where durable documents are useful | Flexible document shape and shared persistence | More latency/operational cost than Redis for hot counters. Expiry is checked on read; inactive expired documents are not automatically removed unless a TTL index is configured. |
| MySQL | Systems that already operate MySQL and have modest rate-limit volume | Fits existing SQL operations and reporting tools | Adds SQL traffic and contention to a hot request path. The adapter creates its table lazily; expired rows are removed on access, not by a background cleanup job. |

For most multi-instance API throttling, Redis is the practical starting point. Choose MongoDB or MySQL when operational simplicity within an existing platform outweighs their higher hot-path cost. Memory is for development, not a distributed deployment.

## Senior engineering review: known production gaps

1. **Concurrent requests can exceed the limit.** Each algorithm reads a record, modifies it in application memory, and writes it back. Two app instances can read the same count and both accept, losing one update. A shared database alone does not fix this. Put the decision and mutation in one atomic operation: for Redis, a Lua script or carefully designed transaction; for SQL, a conditional atomic update/transaction; for MongoDB, an atomic update pipeline with a correctly modeled counter. Recheck correctness under parallel load.
2. **The identity key is underspecified.** `req.ip` groups all users behind the same NAT and can be spoofed/misreported if proxy trust is configured incorrectly. Behind a trusted load balancer, set Express `trust proxy` to the exact deployment topology. Consider composing a key from tenant/user, route class, and IP, with privacy-aware retention and normalization.
3. **Failure behavior is implicit.** A store connection failure currently propagates through Express and normally returns a server error. Decide per endpoint whether to fail open (availability) or fail closed (abuse resistance), define timeouts, and make fallback behavior observable. Avoid silently falling back to per-process memory in a multi-instance service.
4. **Headers need a stable contract.** The current `X-RateLimit-Reset` value is the algorithm's reset duration in milliseconds, rather than a reset timestamp. The `retryAfter` result from sliding-window is not currently emitted as `Retry-After`. Define units and semantics, then test clients against them.
5. **Expiry and storage lifecycle need operational ownership.** Add MongoDB TTL cleanup if desired, MySQL cleanup/partitioning for expired rows, Redis memory/eviction sizing, and graceful connection shutdown. MySQL schema creation belongs in a migration for controlled production deployments rather than app startup.
6. **Policy and operations need observability.** Add metrics for allowed/blocked requests, backend latency/errors, key cardinality, and cleanup. Do not use raw user identifiers as metric labels. Add per-route policies, exemptions, and versioned configuration if policy changes must be rolled out safely.
7. **Tests are essential before hard enforcement.** Cover boundary times, clock behavior, TTL semantics, shared-store multi-instance behavior, simultaneous requests for one key, database outages, and retry/header behavior. This repository currently has no automated test suite.

## Project layout

```text
app/
  algorithms/       fixed-window, sliding-window, token-bucket implementations
  factories/        algorithm, store, and database connection factories
  middleware/       Express rate-limiter and 404 middleware
  stores/           memory, Redis, MongoDB, and MySQL adapters
  app.ts            health and demo API routes
  server.ts         HTTP server entry point
Dockerfile
docker-compose.yml
```

The public store and rate-limit interfaces are defined in `app/stores/rate-store-interface.ts`. Adapters implement the same `get`, `set`, and `delete` contract; algorithms therefore do not depend on a specific database client.
