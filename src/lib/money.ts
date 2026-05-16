/**
 * POS money helpers.
 *
 * The single rule for the whole POS app:
 *   - money is stored and computed INTERNALLY in MINOR units (kobo) —
 *     this matches the database (variant prices are bigint kobo), the
 *     server pricing engine, the scanner-session totals, and order rows.
 *   - it is divided by 100 ONLY for display.
 *
 * The one boundary that speaks MAJOR units is the POS-sync transaction
 * DTO (`payments[].amount`, `discountAmount`) — convert with
 * `minorToMajor` exactly there, and nowhere else.
 */

/** Format a minor-unit amount (kobo) for display, e.g. 25500 -> "₦255.00". */
export function formatNaira(minor: number): string {
  const symbol = "₦";
  return `${symbol}${(Number(minor) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a minor-unit amount with a currency, e.g. USD -> "$2.55". */
export function formatMoney(minor: number, currency = "NGN"): string {
  const symbol = currency === "USD" ? "$" : "₦";
  return `${symbol}${(Number(minor) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Convert a major-unit value the cashier typed (e.g. "255") to minor units. */
export function majorToMinor(major: number | string): number {
  const n = typeof major === "string" ? parseFloat(major) : major;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convert minor units to major units — used only at the POS-sync DTO boundary. */
export function minorToMajor(minor: number): number {
  return Number(minor) / 100;
}
