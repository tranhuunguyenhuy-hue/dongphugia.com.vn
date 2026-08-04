export interface ContentGenerationInput {
    sku: string
    name: string
    cleanedHtml: string
}

export interface ContentGenerationOutput {
    html: string
    adapter: string
    mode: 'mock'
}

export interface ContentGenerationAdapter {
    readonly name: string
    generate(input: ContentGenerationInput): Promise<ContentGenerationOutput>
}

/**
 * Offline adapter used by the source-only proposal pipeline. It deliberately
 * performs no network or paid-model calls and is deterministic for a given input.
 */
export class MockContentGenerationAdapter implements ContentGenerationAdapter {
    readonly name = 'mock_deterministic_v1'

    async generate(input: ContentGenerationInput): Promise<ContentGenerationOutput> {
        return {
            html: input.cleanedHtml,
            adapter: this.name,
            mode: 'mock',
        }
    }
}
