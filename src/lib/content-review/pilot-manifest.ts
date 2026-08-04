import { hashObject } from './hash'

export const LEO_489_PILOT_MANIFEST_CHECKSUM =
    'bd4e6c66b452776ae7687f5719219f9ceddc2c0b3323ff3fb72d4840591782d8' as const

export type PilotMediaClass = 'HITA_HOSTED' | 'DESC_HITA' | 'EMBEDDED' | 'PLAIN_CONTROL'

export interface PilotManifestEntry {
    id: number
    sku: string
    brandSlug: string
    mediaClass: PilotMediaClass
}

export const LEO_489_PILOT_MANIFEST = Object.freeze([
    { id: 2698, sku: 'M16004', brandSlug: 'american-standard', mediaClass: 'HITA_HOSTED' },
    { id: 2705, sku: 'AC-7110501', brandSlug: 'american-standard', mediaClass: 'HITA_HOSTED' },
    { id: 2706, sku: 'AC-7110400', brandSlug: 'american-standard', mediaClass: 'HITA_HOSTED' },
    { id: 2368, sku: 'WF-9089-CHROME', brandSlug: 'american-standard', mediaClass: 'HITA_HOSTED' },
    { id: 1833, sku: 'AT1157', brandSlug: 'atmor', mediaClass: 'DESC_HITA' },
    { id: 1406, sku: 'MT5140', brandSlug: 'caesar', mediaClass: 'DESC_HITA' },
    { id: 7597, sku: 'BFV-3003-1C', brandSlug: 'inax', mediaClass: 'DESC_HITA' },
    { id: 3901, sku: 'SW6181HSG', brandSlug: 'moen', mediaClass: 'DESC_HITA' },
    { id: 5653, sku: 'CS326DT10#XW', brandSlug: 'toto', mediaClass: 'DESC_HITA' },
    { id: 26395, sku: 'V93', brandSlug: 'viglacera', mediaClass: 'DESC_HITA' },
    { id: 7862, sku: 'INAX-20B/CRB-1', brandSlug: 'inax', mediaClass: 'EMBEDDED' },
    { id: 7859, sku: 'INAX-255/VIZ-1', brandSlug: 'inax', mediaClass: 'EMBEDDED' },
    { id: 308, sku: 'SFV-802S', brandSlug: 'inax', mediaClass: 'EMBEDDED' },
    { id: 317, sku: 'SFV-900SX', brandSlug: 'inax', mediaClass: 'EMBEDDED' },
    { id: 7376, sku: 'TX707AC', brandSlug: 'toto', mediaClass: 'EMBEDDED' },
    { id: 7868, sku: 'EGR-V2SP/G3', brandSlug: 'inax', mediaClass: 'PLAIN_CONTROL' },
    { id: 9123, sku: '61-1361-VN', brandSlug: 'inax', mediaClass: 'PLAIN_CONTROL' },
    { id: 9135, sku: 'A-SFV1013SX-1-1', brandSlug: 'inax', mediaClass: 'PLAIN_CONTROL' },
    { id: 2666, sku: 'TBW07001A/TBV01407B/TBN01001B', brandSlug: 'toto', mediaClass: 'PLAIN_CONTROL' },
    { id: 5343, sku: 'AT-30H', brandSlug: 'atmor', mediaClass: 'PLAIN_CONTROL' },
] as const satisfies readonly PilotManifestEntry[])

export function pilotManifestEntryHash(entries: readonly PilotManifestEntry[] = LEO_489_PILOT_MANIFEST): string {
    return hashObject(entries)
}

function sameManifest(left: readonly PilotManifestEntry[], right: readonly PilotManifestEntry[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right)
}

export function validatePilotManifest(value: unknown): PilotManifestEntry[] {
    if (!Array.isArray(value) || value.length !== LEO_489_PILOT_MANIFEST.length) {
        throw new Error('LEO-489 manifest must contain exactly 20 entries')
    }
    const entries = value as PilotManifestEntry[]
    if (!sameManifest(entries, LEO_489_PILOT_MANIFEST)) {
        throw new Error('LEO-489 manifest identities do not match the approved contract')
    }
    return entries
}
