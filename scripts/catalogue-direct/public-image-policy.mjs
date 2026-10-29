const IMAGE_HOSTS = new Set(['cdn.dongphugia.com.vn', 'cdn.hita.com.vn', 'hita.com.vn', 'vietceramics.com', 'tygjmrhandbffjllxveu.supabase.co'])
export function safeImage(value) {
  if (typeof value !== 'string') return null
  if (/^\/images\/[^\s?#%]+$/.test(value) && !value.includes('..')) return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !IMAGE_HOSTS.has(url.hostname)) return null
    if (url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/storage/v1/object/public/')) return null
    return url.toString()
  } catch { return null }
}
