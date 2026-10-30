'use client'

import { useMemo, useSyncExternalStore } from 'react'

const SEARCH_PARAMS_CHANGE_EVENT = 'dpg:search-params-change'

function subscribe(listener: () => void) {
    if (typeof window === 'undefined') return () => undefined

    window.addEventListener('popstate', listener)
    window.addEventListener(SEARCH_PARAMS_CHANGE_EVENT, listener)
    return () => {
        window.removeEventListener('popstate', listener)
        window.removeEventListener(SEARCH_PARAMS_CHANGE_EVENT, listener)
    }
}

function getBrowserSearch() {
    return window.location.search
}

function getServerSearch(fallback: string) {
    return fallback
}

export function useLiveSearchParams(serverFallback: string) {
    const search = useSyncExternalStore(subscribe, getBrowserSearch, () => getServerSearch(serverFallback))
    return useMemo(() => new URLSearchParams(search), [search])
}

export function notifySearchParamsChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SEARCH_PARAMS_CHANGE_EVENT))
    }
}
