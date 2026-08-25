-- PostgreSQL Baseline v1 extension and namespace inventory.
-- This is disposable/rebuild DDL only; Production adoption is a separate
-- read-only comparison and approval gate.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS plpgsql;
