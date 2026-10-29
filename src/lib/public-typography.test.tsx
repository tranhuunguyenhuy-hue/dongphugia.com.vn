import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const fontLoaders = vi.hoisted(() => ({
  Be_Vietnam_Pro: vi.fn((options: { variable: string }) => ({ variable: `${options.variable}-generated` })),
  Playfair_Display: vi.fn((options: { variable: string }) => ({ variable: `${options.variable}-generated` })),
}))

vi.mock('next/font/google', () => fontLoaders)
vi.mock('@/app/(public)/layout', () => ({
  default: ({ children }: { children: unknown }) => children,
}))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/components/seo/json-ld', () => ({ JsonLd: () => null }))
vi.mock('@/lib/seo/schema', () => ({ buildOrganizationSchema: () => ({}) }))
vi.mock('@/lib/site', () => ({
  getSiteRuntimeConfig: () => ({ siteUrl: 'https://canonical.example', allowIndexing: false }),
}))
vi.mock('@next/third-parties/google', () => ({ GoogleTagManager: () => null }))
vi.mock('@/components/analytics/web-vitals-reporter', () => ({ WebVitalsReporter: () => null }))
vi.mock('../../apps/public/src/config/env', () => ({
  getPublicAppEnvironment: () => ({ origin: 'https://preview.example', previewNoindex: true }),
}))

import PublicRootLayout, { viewport as previewViewport } from '../../apps/public/app/layout'
import LegacyRootLayout, { viewport as legacyViewport } from '../app/layout'
import { publicFontClasses, publicViewport } from '@/lib/public-typography'

describe('shared public typography and viewport', () => {
  it('preserves canonical Google font loader options', () => {
    expect(fontLoaders.Be_Vietnam_Pro).toHaveBeenCalledWith({
      variable: '--font-sans',
      subsets: ['latin', 'vietnamese'],
      weight: ['400', '700'],
      display: 'swap',
      preload: false,
    })
    expect(fontLoaders.Playfair_Display).toHaveBeenCalledWith({
      variable: '--font-display',
      subsets: ['latin', 'vietnamese'],
      weight: 'variable',
      style: 'normal',
      display: 'swap',
      preload: false,
    })
    expect(publicFontClasses).toBe('--font-sans-generated --font-display-generated')
  })

  it('renders the Preview layout with canonical font classes and exports the shared viewport', () => {
    const child = createElement('main', null, 'preview child')
    const html = renderToStaticMarkup(createElement(PublicRootLayout, null, child))

    expect(html).toContain('data-application="public"')
    expect(html).toContain('class="--font-sans-generated --font-display-generated antialiased font-sans"')
    expect(html).toContain('<main>preview child</main>')
    expect(previewViewport).toBe(publicViewport)
  })

  it('keeps the legacy layout on the same font classes and viewport object', () => {
    const html = renderToStaticMarkup(createElement(LegacyRootLayout, null, createElement('main', null, 'legacy child')))

    expect(html).toContain('class="--font-sans-generated --font-display-generated antialiased font-sans"')
    expect(legacyViewport).toBe(publicViewport)
  })

  it('retains the canonical mobile viewport and theme colors', () => {
    expect(publicViewport).toEqual({
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
      ],
    })
  })
})
