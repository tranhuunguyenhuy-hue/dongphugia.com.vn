-- Disposable-only negative proof. The transaction must roll back both objects.
CREATE TABLE public.deployment_pipeline_probe_failure (probe_id text PRIMARY KEY);
SELECT 1 / 0;
