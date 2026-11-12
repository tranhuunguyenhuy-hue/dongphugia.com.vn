// Public immutable data identity only. No database URL/key enters this module.
declare const __DPG_PUBLIC_CATALOGUE_CHECKPOINT__: string | null
export function publicSnapshotCheckpoint():string|null {
  const value=typeof __DPG_PUBLIC_CATALOGUE_CHECKPOINT__==='undefined'
    ? process.env.PUBLIC_CATALOGUE_CHECKPOINT : __DPG_PUBLIC_CATALOGUE_CHECKPOINT__
  if(!value)return null
  if(!/^[a-f0-9]{40}$/.test(value)) throw new Error('PUBLIC_CATALOGUE_CHECKPOINT_INVALID')
  return value
}
export function usesProductionPublishedCatalogue() {
  return (process.env.APP_ENV === 'preview' || process.env.APP_ENV === 'staging')
    && process.env.PUBLIC_CATALOGUE_SOURCE === 'production-published-snapshot'
}
export function usesPublicSnapshot() { return publicSnapshotCheckpoint()!==null || usesProductionPublishedCatalogue() }
