/**
 * @file utils.js
 * @description Shared utility functions for the hita.com.vn INAX crawler.
 * All helpers are pure Node.js — no external dependencies required.
 *
 * Design notes referenced from crawl spec:
 *   D-14 atomicWrite — write to .tmp then rename (prevents partial JSON on crash)
 *   D-16 withRetry  — exponential backoff: 1s → 2s → 4s
 */

import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

/**
 * Atomically write JSON data to a file.
 * Writes to `<filePath>.tmp` first, then renames to `filePath` so that
 * a crash mid-write never leaves a corrupt file (spec D-14).
 *
 * @param {string} filePath - Absolute or relative destination path.
 * @param {unknown} data    - Value to serialize as JSON.
 * @returns {void}
 */
export function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath); // atomic OS-level swap
}

/**
 * Load a JSON file from disk.
 * Returns an empty object `{}` when the file does not exist, so callers
 * can safely destructure without an extra existence check.
 *
 * @param {string} filePath - Path to the JSON file.
 * @returns {object} Parsed JSON object, or `{}` if the file is missing.
 */
export function loadProgress(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.warn(`[loadProgress] Failed to parse ${filePath}, returning {}`);
    return {};
  }
}

/**
 * Atomically append a log entry to a JSON array stored in `logPath`.
 *
 * The file is expected to contain a JSON array (or be absent).
 * The entry is appended, then the whole array is written back atomically
 * via `atomicWrite` to prevent data loss on crash.
 *
 * @param {string} logPath  - Path to the crawl-log.json file.
 * @param {object} entry    - Log entry object to append.
 * @returns {void}
 */
export function appendLog(logPath, entry) {
  let entries = [];

  if (fs.existsSync(logPath)) {
    try {
      const raw = fs.readFileSync(logPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      console.warn(`[appendLog] Could not parse ${logPath}, starting fresh array.`);
    }
  }

  entries.push(entry);
  atomicWrite(logPath, entries);
}

// ---------------------------------------------------------------------------
// Async / flow helpers
// ---------------------------------------------------------------------------

/**
 * Promise-based sleep / delay.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with exponential backoff retries (spec D-16).
 *
 * Retry schedule (baseDelayMs = 1000):
 *   Attempt 1 → immediate
 *   Attempt 2 → wait 1 s
 *   Attempt 3 → wait 2 s
 *   Attempt 4 → wait 4 s  (then throws)
 *
 * @template T
 * @param {() => Promise<T>} fn              - Async function to execute.
 * @param {number} [maxRetries=3]            - Maximum retry attempts after first failure.
 * @param {number} [baseDelayMs=1000]        - Base delay in ms; doubles each retry.
 * @returns {Promise<T>}
 * @throws Will re-throw the last error after all retries are exhausted.
 */
export async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;
  let delay = baseDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`[withRetry] Attempt ${attempt + 1}/${maxRetries} failed: ${err.message}. Retrying in ${delay}ms…`);
        await sleep(delay);
        delay *= 2; // exponential backoff: 1s → 2s → 4s
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a potentially relative URL against a base origin.
 *
 * Handles four cases:
 *   1. Absolute URL        → returned as-is
 *   2. Protocol-relative   → prepend `https:` (e.g. `//cdn.hita.com.vn/…`)
 *   3. Root-relative path  → prepend `base` origin (e.g. `/storage/…` → `https://hita.com.vn/storage/…`)
 *   4. Relative path       → resolved against `base`
 *
 * @param {string} raw                           - Raw URL string from the DOM.
 * @param {string} [base='https://hita.com.vn'] - Base URL to resolve against.
 * @returns {string} Fully-qualified absolute URL, or empty string if `raw` is falsy.
 */
export function resolveUrl(raw, base = 'https://hita.com.vn') {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Protocol-relative: //cdn.hita.com.vn/…
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  // Already absolute
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Root-relative or relative path
  return new URL(trimmed, base).href;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Vietnamese currency string into an integer (đồng).
 *
 * Strips all non-digit characters (thousands separators ".", currency symbol "đ",
 * whitespace, etc.) and returns the resulting integer.
 *
 * @param {string|null|undefined} str - Raw price string, e.g. "9.940.800đ".
 * @returns {number|null} Integer price in VND, or `null` if `str` is falsy / not parseable.
 *
 * @example
 * parseVND("9.940.800đ")    // → 9940800
 * parseVND("17.440.000 đ")  // → 17440000
 * parseVND("")              // → null
 * parseVND(null)            // → null
 */
export function parseVND(str) {
  if (!str) return null;
  const digits = String(str).replace(/[^\d]/g, '');
  return digits.length > 0 ? parseInt(digits, 10) : null;
}
