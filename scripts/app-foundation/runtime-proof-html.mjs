export function assertNoindexHtml(html, expectedTitle) {
  if (!/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']\s*\/?>(?:<\/meta>)?/i.test(html)) {
    throw new Error('RUNTIME_PROOF_HTML_NOINDEX_FAILED')
  }

  const head = /<head(?:\s[^>]*)?>([\s\S]*?)<\/head\s*>/i.exec(html)?.[1]
  const titles = head ? [...head.matchAll(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/gi)] : []
  if (!expectedTitle || titles.length !== 1 || titles[0]?.[1] !== expectedTitle) {
    throw new Error('RUNTIME_PROOF_SSR_METADATA_FAILED')
  }
}
