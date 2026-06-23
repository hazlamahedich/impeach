-- AGE graph boot migration: create the iip_graph named graph.
--
-- DO NOT run this file via /docker-entrypoint-initdb.d/.
--
-- This migration runs OUTSIDE Drizzle's migration system. AGE DDL is outside
-- Drizzle's awareness (ADR-002). It is applied by the Story 1.3 boot runner
-- AFTER relational Drizzle migrations have completed (ADR-002 §Decision #5;
-- STR-12). AGE graph constructs may reference relational tables and constraints,
-- so the relational schema must exist first.
--
-- SUPERUSER-ONLY: CREATE EXTENSION age + create_graph() require superuser
-- privileges. The boot runner must connect as a superuser.
--
-- EXPLICIT COMMIT: In non-autocommit clients, create_graph() is NOT visible to
-- other sessions until an explicit COMMIT boundary. The boot runner must run
-- this script in its own transaction and COMMIT before any other session
-- queries iip_graph.
--
-- @rules AC-2, AC-6
-- @adr ADR-002

-- AGE extension version installed by the ADR-002 artifact (PG16/v1.6.0-rc0).
-- PostgreSQL reports the installed extension version as '1.6.0' (the -rc0 suffix
-- is upstream Git tag metadata, not the catalog version string).
CREATE EXTENSION IF NOT EXISTS age WITH VERSION '1.6.0';

-- Load AGE parser hooks for this session. shared_preload_libraries=age is
-- baked into the image CMD, but LOAD is idempotent and ensures the hooks are
-- available even if the server config is overridden.
LOAD 'age';

-- Set search_path so AGE functions resolve.
SET search_path = ag_catalog, "$user", public;

-- Create the named graph. Idempotent — the NOTICE on re-run is harmless.
SELECT create_graph('iip_graph');

-- Explicit COMMIT boundary: make iip_graph visible to other sessions.
-- The boot runner must run this script in autocommit mode (or END/COMMIT the
-- transaction) so the graph is visible to subsequent sessions and to Drizzle.
COMMIT;
