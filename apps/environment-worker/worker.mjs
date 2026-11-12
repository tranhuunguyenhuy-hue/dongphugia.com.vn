import publicWorker from './public-worker/index.js'
import adminWorker from './admin-worker/index.js'
import { createEnvironmentWorker } from './dispatch.mjs'

export default createEnvironmentWorker({ publicWorker, adminWorker })
