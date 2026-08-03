import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.BASE_URL || 'https://staging.dongphugia.vn'
const parsedBaseUrl = new URL(baseUrl)
const isProduction = parsedBaseUrl.hostname === 'www.dongphugia.vn' || parsedBaseUrl.hostname === 'dongphugia.vn'
const allowProduction = __ENV.ALLOW_PRODUCTION_READONLY_LOAD === 'true'

if (parsedBaseUrl.protocol !== 'https:') {
    throw new Error('BASE_URL must use HTTPS')
}

if (isProduction && (!allowProduction || !__ENV.PM_WINDOW_ID)) {
    throw new Error('Production load requires ALLOW_PRODUCTION_READONLY_LOAD=true and PM_WINDOW_ID')
}

if (parsedBaseUrl.hostname === 'cdn.dongphugia.com.vn') {
    throw new Error('Bunny CDN is not a load-test target')
}

const targetRps = Math.max(1, Number(__ENV.TARGET_RPS || 5))
const duration = __ENV.DURATION || '30s'
const paths = [
    '/',
    '/gach-op-lat',
    '/tim-kiem?q=voi',
    '/lien-he',
]

export const options = {
    discardResponseBodies: true,
    scenarios: {
        readonly: {
            executor: 'constant-arrival-rate',
            rate: targetRps,
            timeUnit: '1s',
            duration,
            preAllocatedVUs: Math.max(10, targetRps * 2),
            maxVUs: Math.max(20, targetRps * 5),
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.99'],
    },
}

export default function () {
    const path = paths[(__ITER + __VU) % paths.length]
    const response = http.get(new URL(path, parsedBaseUrl).toString(), {
        tags: { route: path.split('?')[0] },
    })

    check(response, {
        'read-only route returns 2xx': (res) => res.status >= 200 && res.status < 300,
    })
    sleep(0.1)
}
