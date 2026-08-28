-- LEO-538: record the separately approved owner-side reconciliation source.
-- This changes only the target-side evidence constraint; it grants no access.

alter table dpg_control.leo538_restore_manifest
  drop constraint if exists leo538_restore_manifest_source_authority_check;

alter table dpg_control.leo538_restore_manifest
  add constraint leo538_restore_manifest_source_authority_check check (
    source_authority in (
      'codex_production_readonly',
      'owner-blog-readonly',
      'owner-reconciliation-readonly'
    )
  );
