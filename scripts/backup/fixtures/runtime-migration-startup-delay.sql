-- Deterministic regression fixture: keep the socket-only initialization
-- server alive long enough to prove it is not the final TCP listener.
select pg_sleep(10);
