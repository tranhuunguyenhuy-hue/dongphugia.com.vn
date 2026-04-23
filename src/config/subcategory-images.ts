/**
 * Hardcoded subcategory thumbnail map — Option A
 * Priority: this map → DB thumbnail_url → emoji fallback
 *
 * To add new images: drop file in /public/images/assets-v2/ and add slug here.
 * Other categories (thiet-bi-bep, vat-lieu-nuoc, gach-op-lat) use null
 * until owner provides assets.
 */

const BASE = '/images/assets-v2'

export const SUBCATEGORY_IMAGES: Record<string, string | null> = {
    // ── Thiết Bị Vệ Sinh ─────────────────────────────────────────────────────
    'bon-cau':              `${BASE}/thumb-toilet.png`,
    'lavabo':               `${BASE}/thumb-lavabo.png`,
    'sen-tam':              `${BASE}/thumb-shower.png`,
    'bon-tam':              `${BASE}/thumb-bathtub.png`,
    'phu-kien-phong-tam':   `${BASE}/thumb-accessories.png`,
    'voi-chau':             `${BASE}/thumb-lavabo-faucet.png`,
    'bon-tieu':             `${BASE}/thumb-urinal.png`,
    'voi-nuoc':             `${BASE}/thumb-outdoor-faucet.png`,
    'nap-bon-cau':          `${BASE}/thumb-toilet-lid.png`,
    'phu-kien-bon-cau':     null,   // TODO: add image when available
    'than-bon-cau':         null,   // TODO: add image when available

    // ── Thiết Bị Bếp ─────────────────────────────────────────────────────────
    // TODO: add when assets are provided
    'bep-tu':               null,
    'may-hut-mui':          null,
    'chau-rua-bat':         null,
    'voi-rua-bat':          null,

    // ── Vật Liệu Nước ────────────────────────────────────────────────────────
    // TODO: add when assets are provided
    'may-nuoc-nong':        null,
    'may-loc-nuoc':         null,
    'bon-chua':             null,
    'may-bom':              null,

    // ── Gạch Ốp Lát ──────────────────────────────────────────────────────────
    // TODO: add when assets are provided
    'gach-op-tuong':        null,
    'gach-lat-nen':         null,
    'gach-van-da':          null,
}
