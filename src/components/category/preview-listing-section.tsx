import type { PreviewListingSectionProps } from './preview-listing-section.types'

// The legacy Production adapter never enables snapshotMode. Cloudflare maps
// this component name to its Preview-only implementation in tsconfig paths.
export function PreviewListingSection(_props: PreviewListingSectionProps) {
  return null
}
