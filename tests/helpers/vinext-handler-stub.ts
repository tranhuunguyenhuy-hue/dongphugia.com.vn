// Test resolver only: root CI intentionally does not install apps/public tools.
// Tests importing the real Worker must explicitly mock the Vinext transport.
export default {
    async fetch(): Promise<Response> {
        throw new Error('VINEXT_TEST_MOCK_REQUIRED')
    },
}
