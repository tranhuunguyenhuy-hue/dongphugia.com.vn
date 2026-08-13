import { PublishingApiError } from './errors'

const RFC3339_WITH_OFFSET =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/

const MIN_SCHEDULE_DELAY_MS = 5 * 60 * 1000
const MAX_SCHEDULE_DELAY_MS = 365 * 24 * 60 * 60 * 1000

export class ScheduleValidationError extends PublishingApiError {
    constructor(code: string) {
        super(422, code, 'Scheduled Publication time is invalid', [
            { field: 'publication', code },
        ])
        this.name = 'ScheduleValidationError'
    }
}

function parseOffsetMinutes(offset: string): number {
    if (offset === 'Z') return 0
    const sign = offset[0] === '-' ? -1 : 1
    const hours = Number(offset.slice(1, 3))
    const minutes = Number(offset.slice(4, 6))
    if (hours > 23 || minutes > 59) {
        throw new ScheduleValidationError('SCHEDULE_TIME_INVALID')
    }
    return sign * (hours * 60 + minutes)
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
    let formatter: Intl.DateTimeFormat
    try {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'longOffset',
            hour: '2-digit',
        })
    } catch {
        throw new ScheduleValidationError('SCHEDULE_TIMEZONE_INVALID')
    }

    const offset = formatter
        .formatToParts(date)
        .find(({ type }) => type === 'timeZoneName')?.value
    if (!offset) {
        throw new ScheduleValidationError('SCHEDULE_TIMEZONE_INVALID')
    }
    if (offset === 'GMT') return 0

    const match = offset.match(/^GMT([+-])(\d{2}):?(\d{2})$/)
    if (!match) {
        throw new ScheduleValidationError('SCHEDULE_TIMEZONE_INVALID')
    }
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3]))
}

export function validateScheduledPublication(
    input: { publishAt: string; publicationTimezone: string },
    now = new Date(),
): { scheduledFor: Date; scheduledTimezone: string } {
    const match = input.publishAt.match(RFC3339_WITH_OFFSET)
    if (!match) {
        throw new ScheduleValidationError('SCHEDULE_TIME_INVALID')
    }

    const offsetMinutes = parseOffsetMinutes(match[3])
    const scheduledFor = new Date(input.publishAt)
    if (!Number.isFinite(scheduledFor.getTime())) {
        throw new ScheduleValidationError('SCHEDULE_TIME_INVALID')
    }

    const localRoundTrip = new Date(
        scheduledFor.getTime() + offsetMinutes * 60 * 1000,
    )
        .toISOString()
        .slice(0, 19)
    if (localRoundTrip !== `${match[1]}T${match[2]}`) {
        throw new ScheduleValidationError('SCHEDULE_TIME_INVALID')
    }

    const timezoneOffset = getTimezoneOffsetMinutes(
        scheduledFor,
        input.publicationTimezone,
    )
    if (timezoneOffset !== offsetMinutes) {
        throw new ScheduleValidationError(
            'SCHEDULE_TIMEZONE_OFFSET_MISMATCH',
        )
    }

    const delay = scheduledFor.getTime() - now.getTime()
    if (delay < MIN_SCHEDULE_DELAY_MS) {
        throw new ScheduleValidationError('SCHEDULE_TOO_SOON')
    }
    if (delay > MAX_SCHEDULE_DELAY_MS) {
        throw new ScheduleValidationError('SCHEDULE_TOO_FAR')
    }

    return {
        scheduledFor,
        scheduledTimezone: input.publicationTimezone,
    }
}
