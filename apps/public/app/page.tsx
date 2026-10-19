import CanonicalHomePage, {
  metadata,
  revalidate,
} from '@/app/(public)/page'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export { metadata, revalidate }

export default CanonicalHomePage
