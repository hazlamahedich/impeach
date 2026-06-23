-- Enable required extensions on first database init.
-- The postgres Docker entrypoint runs this against POSTGRES_DB as superuser.
--
-- NOTE: CREATE EXTENSION age needs superuser. create_graph('iip_graph') is
-- intentionally NOT run here; it is handled by the Story 1.3 boot runner
-- (infra/sql/age/migrations/0001-iip-graph.sql), after Drizzle relational
-- migrations have completed (ADR-002 §D1).
--
-- UUID generation is provided by gen_random_uuid(), built-in since PG13 via
-- pgcrypto; uuid-ossp is not installed to reduce extension surface area.
--
-- @rules AC-1
-- @adr ADR-002

CREATE EXTENSION IF NOT EXISTS age WITH VERSION '1.6.0';
CREATE EXTENSION IF NOT EXISTS vector WITH VERSION '0.8.0';
CREATE EXTENSION IF NOT EXISTS pg_trgm;
