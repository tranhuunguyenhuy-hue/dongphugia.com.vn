export function logPerf(label: string) {
    if (process.env.NODE_ENV === 'development') {
        console.time(label)
        return () => console.timeEnd(label)
    }
    return () => {}
}
