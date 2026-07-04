# PostgreSQL Extensions

This project runs on the `pgvector/pgvector:pg17` image, with `pgvector`
enabled via `init.sql` (`CREATE EXTENSION IF NOT EXISTS vector;`) — it's a
first-class part of the stack, used for embeddings/AI features, not an
optional add-on. `pg_stat_statements` is kept as a general-purpose query
performance tool. Other extensions (PostGIS, timescaledb, postgres_fdw,
pg_repack, uuid-ossp, pgcrypto) are omitted — none apply to this project's
data (no geo data, no time-series, no cross-database queries, no in-DB
password hashing, and UUIDs are handled by Prisma/native `gen_random_uuid()`
rather than `uuid-ossp`).

## Extension Management

```sql
-- List available extensions
SELECT * FROM pg_available_extensions ORDER BY name;

-- List installed extensions
SELECT * FROM pg_extension;

-- Install extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS vector;

-- Update extension
ALTER EXTENSION vector UPDATE;
```

## pg_stat_statements (Query Performance)

```sql
-- Install and configure
CREATE EXTENSION pg_stat_statements;

-- postgresql.conf:
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- Top 10 slowest queries by mean time
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Most frequently called queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- Most time-consuming queries (total time)
SELECT
  query,
  calls,
  total_exec_time / 1000 as total_seconds,
  mean_exec_time,
  (total_exec_time / sum(total_exec_time) OVER ()) * 100 as percentage
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

## pgvector (Vector Similarity Search)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Create table with vector column
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)  -- e.g. OpenAI-style embeddings are 1536 dimensions
);

-- Add vector index (HNSW for better performance)
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
-- or IVFFlat for memory efficiency:
-- CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Insert vectors
INSERT INTO embeddings (content, embedding)
VALUES ('Hello world', '[0.1, 0.2, 0.3, ...]');

-- Similarity search (cosine distance)
SELECT
  content,
  1 - (embedding <=> '[0.1, 0.2, ...]') as similarity
FROM embeddings
ORDER BY embedding <=> '[0.1, 0.2, ...]'
LIMIT 10;

-- Distance operators
-- <-> L2 distance (Euclidean)
-- <#> negative inner product
-- <=> cosine distance (most common for embeddings)

-- Set index parameters for better recall
SET hnsw.ef_search = 100;  -- Higher = better recall, slower query

-- Bulk insert optimization
SET maintenance_work_mem = '2GB';
```

## Extension Recommendations for This Project

**Query Performance Monitoring:**
- `pg_stat_statements` (essential, general-purpose)

**Vector Embeddings / AI (chat routing, semantic search):**
- `pgvector` (already enabled via `init.sql`; core to the stack)
