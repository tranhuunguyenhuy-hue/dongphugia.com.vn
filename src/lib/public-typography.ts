import type { Viewport } from 'next'
import { Be_Vietnam_Pro, Playfair_Display } from 'next/font/google'

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
  // Keep two static cuts on the critical path. Browser font matching maps the
  // intermediate 500/600 styles to the nearest loaded brand weight.
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})

const playfairDisplay = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin', 'vietnamese'],
  weight: 'variable',
  style: 'normal',
  display: 'swap',
  preload: false,
})

export const publicFontClasses = `${beVietnamPro.variable} ${playfairDisplay.variable}`

export const publicViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
  ],
}
