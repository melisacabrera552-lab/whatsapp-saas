// Meta's WhatsApp per-message pricing, effective 2026-10-01.
//
// Shared by the client dashboard and the agency overview so the quota and the
// rate are defined exactly once. Ref: YCloud pricing update 2026-10-01.

/**
 * Free service messages Meta grants per business phone number per calendar
 * month. Does not roll over and is not shared between numbers.
 */
export const FREE_SERVICE_MESSAGES_PER_MONTH = 1_000;

/**
 * Indicative Argentina utility/service rate in USD per delivered message.
 * Meta refreshes its rate card quarterly — this is an estimate, not a bill.
 */
export const SERVICE_MESSAGE_USD = 0.012;

/** Date per-message billing for service messages starts: 2026-10-01. */
const PRICING_START = Date.UTC(2026, 9, 1);

/** False until 2026-10-01 — before that, service messages are still free. */
export function isPricingActive(): boolean {
  return Date.now() >= PRICING_START;
}

/** Messages above the free quota, i.e. the ones Meta actually charges for. */
export function countBillable(serviceMessages: number): number {
  return Math.max(0, serviceMessages - FREE_SERVICE_MESSAGES_PER_MONTH);
}

/** Estimated USD for a month's worth of service messages. */
export function estimateCostUsd(serviceMessages: number): number {
  return countBillable(serviceMessages) * SERVICE_MESSAGE_USD;
}

/** Start of the current calendar month, in UTC — matches Meta's quota reset. */
export function currentMonthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the previous calendar month, in UTC. */
export function previousMonthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/**
 * Straight-line projection: holds the month-to-date daily average to the end
 * of the month. Rough on the 1st, reliable by the second week.
 */
export function projectToMonthEnd(countSoFar: number, now = new Date()): number {
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Math.round((countSoFar / now.getUTCDate()) * daysInMonth);
}
