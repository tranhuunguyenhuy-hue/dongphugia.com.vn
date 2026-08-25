-- Disposable-only proof migration. It is never added to the canonical
-- PostgreSQL migration chain and is deleted with the isolated target.
CREATE TABLE public.deployment_pipeline_probe (
  probe_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
