import publicWorker from './public/server/index.js'
import adminWorker from './admin/server/index.mjs'
import { createCombinedProductionWorker } from './combined-dispatch.mjs'

export default createCombinedProductionWorker({ publicWorker, adminWorker })
