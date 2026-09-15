export type RuntimeQueryMarker =
  | 'homepage_banners'
  | 'homepage_featured_tbvs'
  | 'homepage_featured_kitchen'
  | 'homepage_featured_tiles'
  | 'homepage_featured_water'
  | 'homepage_brands_tbvs'
  | 'homepage_subcategories_tbvs'
  | 'homepage_subcategories_kitchen'
  | 'homepage_brands_kitchen'

export async function withRuntimeQueryDiagnostic<T>(
  marker: RuntimeQueryMarker,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`DPG_RUNTIME_QUERY=${marker}`)
    throw error
  }
}
