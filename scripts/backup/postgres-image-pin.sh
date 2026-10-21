DPG_APPROVED_POSTGRES_IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'

dpg_resolve_postgres_image() {
  if [[ "${POSTGRES_IMAGE+x}" == 'x' ]]; then
    [[ "$POSTGRES_IMAGE" == "$DPG_APPROVED_POSTGRES_IMAGE" ]] || return 1
  fi
  printf '%s\n' "$DPG_APPROVED_POSTGRES_IMAGE"
}
