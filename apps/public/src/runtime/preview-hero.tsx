import { HeroBanner as CanonicalHeroBanner } from '../../../../src/components/home/hero-banner'
import type { PublicHomeBanner } from '@dpg/app-contracts'

// The legacy fallback bitmap contains stale prices. Production supplies the
// existing price-free kitchen asset; Preview keeps its isolated empty state.
export function HeroBanner(props:{banners:readonly PublicHomeBanner[]}) {
  return process.env.APP_ENV === 'production' && props.banners.length > 0
    ? <CanonicalHeroBanner {...props} /> : null
}
