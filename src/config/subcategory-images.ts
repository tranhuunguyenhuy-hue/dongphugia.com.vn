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
    'bep-dien-tu':          `${BASE}/bep-dien.png`,
    'bep-gas':              `${BASE}/bep-gas.png`,
    'may-hut-mui':          `${BASE}/may-hut-mui.png`,
    'chau-rua-chen':        `${BASE}/chau-rua-chen.png`,
    'voi-rua-chen':         `${BASE}/voi-rua-chen.png`,
    'may-rua-chen':         `${BASE}/may-rua-chen.png`,
    'lo-nuong':             `${BASE}/lo-vi-song.png`,
    'thiet-bi-bep-khac':    `${BASE}/phu-kien-bep.png`,

    // ── Vật Liệu Nước ────────────────────────────────────────────────────────
    'may-nuoc-nong':        `${BASE}/may-nuoc-nong.png`,
    'loc-nuoc':             `${BASE}/may-loc-nuoc.png`,
    'bon-chua-nuoc':        `${BASE}/bon-nuoc.png`,
    'may-bom-nuoc':         `${BASE}/may-bom-nuoc.png`,

    // ── Gạch Ốp Lát ──────────────────────────────────────────────────────────
    'gach-van-da-marble':   `${BASE}/gach-marble.png`,
    'gach-van-da-tu-nhien': `${BASE}/gach-tu-nhien.png`,
    'gach-van-go':          `${BASE}/gach-van-go.png`,
    'gach-thiet-ke-xi-mang':`${BASE}/gach-xi-mang.png`,
    'gach-trang-tri':       `${BASE}/gach-thiet-ke.png`,
}
