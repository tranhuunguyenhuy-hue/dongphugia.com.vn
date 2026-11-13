declare module 'vinext/server/fetch-handler' {
  interface FetchHandler {
    fetch(request: Request, environment: unknown, context: unknown): Promise<Response>
  }

  const handler: FetchHandler
  export default handler
}
