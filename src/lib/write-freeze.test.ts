import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    WRITE_FREEZE_ERROR_CODE,
    WriteFreezeError,
    isWriteFreezeEnabled,
    toWriteFreezeActionResult,
} from './write-freeze'

afterEach(() => vi.unstubAllEnvs())

describe('toWriteFreezeActionResult', () => {
    it('maps a write-freeze error to the safe server-action contract', () => {
        const result = toWriteFreezeActionResult(
            new WriteFreezeError('secret-operation-name'),
        )

        expect(result).toMatchObject({
            success: false,
            code: WRITE_FREEZE_ERROR_CODE,
            statusCode: 503,
        })
        expect(JSON.stringify(result)).not.toContain('secret-operation-name')
    })

    it('recognizes an Error reconstructed across a server boundary', () => {
        const error = Object.assign(new Error('internal detail'), {
            name: 'WriteFreezeError',
            code: WRITE_FREEZE_ERROR_CODE,
        })

        expect(toWriteFreezeActionResult(error)?.code).toBe(
            WRITE_FREEZE_ERROR_CODE,
        )
    })

    it('does not rewrite unrelated failures', () => {
        expect(
            toWriteFreezeActionResult(
                Object.assign(new Error('duplicate'), { code: 'P2002' }),
            ),
        ).toBeNull()
    })

    it('fails closed for a production candidate until the runtime explicitly enables writes', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DEPLOY_TARGET', 'production')

        expect(isWriteFreezeEnabled()).toBe(true)

        vi.stubEnv('WRITE_FREEZE_MODE', 'false')
        expect(isWriteFreezeEnabled()).toBe(false)
    })
})
