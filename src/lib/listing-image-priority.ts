export const MOBILE_LISTING_PRIORITY_CARD_COUNT = 2

export function shouldPrioritizeListingCard(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < MOBILE_LISTING_PRIORITY_CARD_COUNT
}
