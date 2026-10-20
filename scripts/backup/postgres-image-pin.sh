DPG_APPROVED_POSTGRES_IMAGE='postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'

dpg_resolve_postgres_image() {
  if [[ "${POSTGRES_IMAGE+x}" == 'x' ]]; then
    [[ "$POSTGRES_IMAGE" == "$DPG_APPROVED_POSTGRES_IMAGE" ]] || return 1
  fi
  printf '%s\n' "$DPG_APPROVED_POSTGRES_IMAGE"
}
