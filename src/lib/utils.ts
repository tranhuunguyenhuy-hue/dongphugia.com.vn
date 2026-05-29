import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(str: string) {
  if (!str) return ''
  return String(str)
    .replace(/[đĐ]/g, 'd') // đ/Đ doesn't decompose with NFKD — map explicitly
    .normalize('NFKD') // split accented characters into base + diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

export function formatPrice(price: number | string) {
  if (!price) return 'Liên hệ'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price))
}

/**
 * Generate a unique order number in the format DPG-YYYYMMDD-XXXXXX.
 * Uses zero-padded 6-digit random suffix (1M combinations/day — sufficient for volume).
 * LEO-421: unified format across REST API and server actions.
 */
export function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
  return `DPG-${dateStr}-${random}`
}
