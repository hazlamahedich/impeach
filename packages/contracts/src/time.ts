/**
 * UTC time helper (PC-8).
 *
 * Centralises all "now" generation so domain code never calls naive
 * `new Date()` directly. Returns an ISO-8601 UTC string with millisecond
 * precision.
 *
 * @rules PC-8
 */
export function now(): string {
  return new Date().toISOString();
}
