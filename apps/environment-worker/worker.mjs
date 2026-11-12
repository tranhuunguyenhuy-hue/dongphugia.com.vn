import publicWorker from './public-worker/index.js'
import { createEnvironmentWorker } from './dispatch.mjs'

export default createEnvironmentWorker({ publicWorker })
