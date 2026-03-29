'use server'

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

// Sleep helper
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Retry with exponential backoff for 429 rate limit errors
async function generateWithRetry(model: GenerativeModel, prompt: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests')
      if (is429 && i < maxRetries - 1) {
        const delays = [15000, 30000, 60000]
        console.log(`Rate limited (429). Retry ${i + 1}/${maxRetries - 1} after ${delays[i] / 1000}s...`)
        await sleep(delays[i])
      } else {
        throw err
      }
    }
  }
  throw new Error('Max retries exceeded')
}

export interface CrawledProduct {
  name: string
  sku: string
  description?: string
  features?: string
  specifications?: Record<string, string>
  price?: string
  images: string[]
  color?: string
  material?: string
  origin?: string
  warranty?: string
  productType?: string
}

// Strip HTML to reduce token usage — keep only text + structural tags
function stripHtml(html: string): string {
  // Remove script, style, svg, noscript blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Keep img src and a href for link/image extraction
  // Remove all other HTML tags but keep content
  text = text
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[IMG:$1]')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[LINK:$1]$2[/LINK]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate to ~15k chars to stay within free tier token limits
  if (text.length > 15000) {
    text = text.substring(0, 15000) + '\n...[TRUNCATED]'
  }
  return text
}

export async function fetchAndExtractLinks(url: string): Promise<{
  success: boolean
  links?: string[]
  message?: string
}> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }
    const html = await res.text()
    const stripped = stripHtml(html)

    // Extract base URL for resolving relative links
    const urlObj = new URL(url)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    const prompt = `You are a web scraper. Given the following webpage content from ${url}, extract ALL product detail page URLs.

Rules:
- Only return URLs that lead to INDIVIDUAL product pages (not category/filter pages)
- Convert relative URLs to absolute using base: ${baseUrl}
- Return ONLY a JSON array of URL strings, nothing else
- If no product links found, return empty array []

Webpage content:
${stripped}`

    const responseText = await generateWithRetry(model, prompt)

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { success: true, links: [] }

    const links: string[] = JSON.parse(jsonMatch[0])

    // Deduplicate
    const unique = [...new Set(links.filter(l => l.startsWith('http')))]

    return { success: true, links: unique }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function fetchAndExtractProduct(url: string): Promise<{
  success: boolean
  data?: CrawledProduct
  message?: string
}> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }
    const html = await res.text()
    const stripped = stripHtml(html)

    // Also extract raw image URLs from HTML for better coverage
    const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+)"/gi
    const rawImages: string[] = []
    let match
    while ((match = imgRegex.exec(html)) !== null) {
      if (!match[1].includes('icon') && !match[1].includes('logo') && !match[1].includes('svg')) {
        rawImages.push(match[1])
      }
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    const prompt = `You are a product data extractor for a Vietnamese construction materials website. Extract product information from this webpage.

Return a JSON object with these fields:
{
  "name": "Product name (Vietnamese)",
  "sku": "Product SKU/model number",
  "description": "Product description (Vietnamese)",
  "features": "Key features as bullet points (Vietnamese)",
  "specifications": {"key": "value"} object of technical specs,
  "price": "Price string or empty if not shown",
  "images": ["url1", "url2"] array of product image URLs (full absolute URLs only),
  "color": "Color name (Vietnamese)",
  "material": "Material type (Vietnamese, e.g. Sứ, Inox, Nhựa)",
  "origin": "Country of origin (Vietnamese, e.g. Nhật Bản, Việt Nam)",
  "warranty": "Warranty info",
  "productType": "Product type (Vietnamese, e.g. Bồn cầu, Lavabo, Vòi sen, Sen tắm, Phụ kiện)"
}

Rules:
- Extract as much info as possible from the page
- If a field is not found, use empty string "" or null
- SKU: look for model number, mã sản phẩm, product code
- images: only include product photos, not icons or logos
- Return ONLY the JSON object, no markdown

Additional image URLs found in HTML: ${JSON.stringify(rawImages.slice(0, 10))}

Webpage content:
${stripped}`

    const responseText = await generateWithRetry(model, prompt)

    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: false, message: 'Could not parse AI response' }

    const data: CrawledProduct = JSON.parse(jsonMatch[0])

    // Merge rawImages if AI missed some
    if (data.images.length === 0 && rawImages.length > 0) {
      data.images = rawImages.slice(0, 5)
    }

    // Generate SKU if missing
    if (!data.sku) {
      data.sku = 'SKU-' + Date.now().toString(36).toUpperCase()
    }

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function downloadAndUploadImage(
  imageUrl: string,
  folder: string = 'tbvs'
): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

    const buffer = Buffer.from(await res.arrayBuffer())

    const { error } = await supabase.storage
      .from('images')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) return { success: false, message: error.message }

    const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(fileName)
    return { success: true, url: publicUrl.publicUrl }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Parse XML sitemap and extract product URLs — no AI needed, saves quota
export async function fetchProductUrlsFromSitemap(sitemapUrl: string): Promise<{
  success: boolean
  urls?: string[]
  total?: number
  message?: string
}> {
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }

    const xml = await res.text()

    // Extract all <loc> URLs from sitemap XML
    const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi
    const urls: string[] = []
    let match
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1].trim()
      // Filter out category/archive pages — keep only product detail pages
      // INAX product pages: /vi/products/[category]/[slug]/
      if (url.includes('/products/') || url.includes('/san-pham/')) {
        urls.push(url)
      }
    }

    const unique = [...new Set(urls)]
    return { success: true, urls: unique, total: unique.length }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
