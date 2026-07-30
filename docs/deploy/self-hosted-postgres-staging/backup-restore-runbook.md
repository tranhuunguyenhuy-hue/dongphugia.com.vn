# Self-hosted PostgreSQL backup and restore runbook

Status: plan only. Do not create cron jobs, run backups, or snapshot EBS during
this gate.

## Backup objectives

- Nightly logical backup with `pg_dump`.
- Retention: 7 daily + 4 weekly.
- Pre-cutover logical backup before any final migration/cutover.
- EBS snapshot before high-risk operations.
- Restore drill is mandatory before accepting self-hosted DB as staging source
  of truth.

## Backup storage

Initial staging location:

- Docker volume: `dpg_staging_postgres_backups`
- Mounted in DB container at `/backups`
- Backed by the existing encrypted EBS root volume.

Production hardening follow-up:

- Copy backups off-host to object storage or another encrypted destination.
- Add immutable/offline copy before production go-live.

## Nightly logical backup command shape

Run through a future approved Coolify scheduled task, host systemd timer, or SSM
command. Do not print secrets. Do not use shell debug output.

```bash
set -euo pipefail

backup_dir="/backups/daily"
mkdir -p "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${backup_dir}/dongphugia-staging-${timestamp}.dump"
checksum_file="${backup_file}.sha256"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  --file="$backup_file"

sha256sum "$backup_file" > "$checksum_file"
```

## Retention policy

Daily:

- Keep the newest 7 files matching `/backups/daily/*.dump`.

Weekly:

- Promote one successful daily backup each week to `/backups/weekly/`.
- Keep the newest 4 weekly backups.

Do not delete a backup until its replacement has a matching checksum and a
successful restore drill has been performed at least once for the backup system.

## Pre-cutover logical backup

Before final migration/cutover:

1. Freeze writes or enter the approved final-delta mode.
2. Take a source Supabase logical backup after confirming the project ref.
3. Take a target self-hosted logical backup.
4. Record counts/checksums from `reconciliation-queries.sql`.
5. Store backup filenames and SHA-256 checksums in the cutover evidence ledger.

## EBS snapshot

Before high-risk DB service changes:

1. Confirm AWS account and instance/volume IDs.
2. Confirm the EBS volume is the existing encrypted staging volume.
3. Create a manual pre-change snapshot only after explicit approval.
4. Record snapshot ID and timestamp.
5. Do not rely on EBS snapshot as the only backup; logical restore must work.

## Restore drill

Required before accepting the self-hosted DB foundation:

1. Create a disposable restore target, not the live staging DB.
2. Restore the latest logical backup.
3. Run `reconciliation-queries.sql`.
4. Confirm:
   - schema loads;
   - row counts match;
   - sequence values are safe for new inserts;
   - key checksums match;
   - excluded tables stay excluded when expected;
   - no admin session data is restored.
5. Time the restore and document RTO/RPO evidence.

## Failure handling

If backup fails:

- do not delete older backups;
- alert PM/operator;
- capture the non-secret error;
- check disk space, container health, DB readiness, and permissions;
- do not proceed to cutover while backup age is stale.

If restore drill fails:

- do not cut over;
- keep Supabase as source of truth;
- classify root cause as schema mismatch, data conflict, sequence issue,
  resource pressure, or operator command error;
- fix through a reviewed change set, not ad hoc SQL.
