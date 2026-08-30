# LEO-560 isolated raw legacy source

Status: one-time Production-derived raw/reference copy completed and verified
on 2026-08-30. This source is migration input for later reconciliation only.
It is not canonical New Production authority and does not authorize restore,
import, transformation, synchronization, application access, or Production
mutation.

## Immutable source identity

- AWS account and region: `503344933326`, `ap-southeast-1`.
- Legacy database: `dongphugia_production`, PostgreSQL `17.6`.
- Database size at preflight: `774155411` bytes.
- Material business coverage: schema `public`, 57 tables,
  `762322944` bytes. The only other relevant non-system schema observed was
  `extensions`, with zero relations and zero bytes.
- Backup command: PostgreSQL custom-format `pg_dump`, compression level 9,
  schema `public`, no owner and no ACL. No business-data exclusion,
  sanitization, redaction, anonymization, or transformation was present.
- Backup script SHA-256:
  `4445a37bbfa6af361982b45aafc77016f5312c6d427d72b76af4a20a5e496c99`.
- Source object:
  `s3://dongphugia-prod-db-backup-503344933326-ap-southeast-1/daily/target/2026/08/29/dongphugia-target-public-20260829T191902Z.dump`.
- Source timestamp: `2026-08-29T19:19:02Z`.
- Source size: `88499596` bytes.
- Source SHA-256:
  `86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1`.
- Source checksum sidecar: the source object key plus `.sha256`.

The Production application principal retained write capability and
`BYPASSRLS`; it was not treated as a read-only path and was not used for this
copy. The already-created S3 backup object and checksum were used instead. No
new database dump or Production database access was performed during the copy.

## Isolated destination identity

- Bucket:
  `s3://dongphugia-newprod-raw-503344933326-ap-southeast-1`.
- Raw dump:
  `raw/legacy-production/2026-08-29/dongphugia-target-public-20260829T191902Z.dump`.
- Checksum sidecar: the destination raw dump key plus `.sha256`.
- Provenance manifest:
  `raw/legacy-production/2026-08-29/provenance.json`.
- Copy timestamp recorded by provenance: `2026-08-30T00:18:42Z`.
- Destination size: `88499596` bytes.
- Destination SHA-256:
  `86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1`.
- Destination dump version ID:
  `CSyMYJz1glatK32aWl2K8pukzxzXl69c`.
- Checksum sidecar version ID:
  `_sYRi621gNH7GQ2Atzs_Fndu2_GNc7lC`.
- Provenance version ID:
  `a4g5yz8MtfQvnWAlo4p52ot.4nrGKTue`.

The exact dump and sidecar were copied server-side without transformation.
An independent CloudShell download and `sha256sum` of the destination dump
matched the expected checksum. Bucket versioning produced version IDs for the
dump and provenance objects; the exact immutable dump version is also bound in
the destination provenance manifest.

## Isolation and security evidence

- Source and destination use different buckets.
- All four S3 Block Public Access controls are enabled.
- Default bucket encryption and copied objects use SSE-S3/AES256.
- Bucket versioning is enabled.
- Object ownership is `BucketOwnerEnforced`; the bucket ACL had only the
  owner grant.
- Bucket policy is absent and website hosting is absent.
- The bucket is tagged for `LEO-560`, purpose
  `isolated-raw-legacy-source`, and environment `non-production`.
- No cross-account policy, public access, application/runtime credential,
  Public/Admin runtime binding, scheduler, worker, cron, database connection,
  continuous synchronization, or reverse connection to Production was added.
- The executing account principal necessarily had bounded write access for
  this approved copy. No application or runtime write path was configured.

The destination has no retention lifecycle in LEO-560. Deletion, archival
policy, IAM changes, restore, and later migration use remain separate Owner
gates.

## Sanitized execution and validation record

The fail-closed CloudShell procedure performed these checks before reporting
success:

1. Attested account, region, exact source object, source size, source AES256
   encryption, and source sidecar checksum.
2. Refused a destination collision unless the bucket was owned by the account
   and carried the exact LEO-560 purpose tags.
3. Verified Block Public Access, AES256 default encryption, versioning,
   ownership controls, owner-only ACL, absent bucket policy, and absent website
   hosting.
4. Copied only the exact dump and checksum sidecar when absent, refusing to
   overwrite a conflicting destination dump.
5. Verified destination size and encryption, downloaded the destination dump
   to an ephemeral CloudShell directory, and independently calculated the
   expected SHA-256.
6. Created or validated the non-secret provenance manifest and required
   version IDs for both the dump and provenance objects.
7. Removed the task-owned temporary directory through an exit trap. No
   credential, token, connection string, database row, or secret was printed or
   persisted.

Result: checksum, Block Public Access, encryption, versioning, ownership,
provenance, source/destination separation, and temporary cleanup passed. No
Production mutation, restore/import, data inspection, cleanup, deduplication,
taxonomy change, canonical mapping, or transformation occurred.
