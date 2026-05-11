"use client";
import type { PosSession } from "../lib/pos-session-events";

interface Props {
  session: PosSession;
  connected: boolean;
  busy: boolean;
  error: string | null;
  /** Open the tender modal to complete the sale. Only when AWAITING_PAYMENT. */
  onCompleteSale: () => void;
  /** Cancel the basket. */
  onVoid: () => void;
  /** Dismiss the panel after the sale completed / was voided. */
  onDismiss: () => void;
}

function formatMinor(minor: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : "₦";
  return `${symbol}${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Live panel showing a scanner-built basket on this terminal.
 *
 * States:
 *  - ACTIVE            — floor staff is still scanning. Read-only here;
 *                        the cashier waits for "Ready for payment".
 *  - AWAITING_PAYMENT  — the basket was handed over. Cashier takes
 *                        payment ("Complete sale") or cancels it ("Void").
 *  - COMPLETED         — sale done; shows the order number; "Dismiss".
 *  - VOIDED            — basket cancelled; "Dismiss".
 *
 * Coexists with the local-cart checkout — this panel only appears when a
 * scanner session exists; otherwise the cashier rings up walk-ups as
 * before.
 */
export default function ScannerBasketPanel({
  session,
  connected,
  busy,
  error,
  onCompleteSale,
  onVoid,
  onDismiss,
}: Props) {
  const { cart, status } = session;
  const itemCount = cart.items.reduce((s, l) => s + l.quantity, 0);
  const currency = cart.currency;

  const statusBadge =
    status === "AWAITING_PAYMENT" ? (
      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold">
        Ready for payment
      </span>
    ) : status === "ACTIVE" ? (
      <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 text-[11px] font-semibold">
        Scanning…
      </span>
    ) : status === "COMPLETED" ? (
      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
        Completed
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-zinc-600/30 text-zinc-300 text-[11px] font-semibold">
        Voided
      </span>
    );

  return (
    <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-800/30">
        <div className="flex items-center gap-2">
          <span className="text-base">📲</span>
          <span className="text-sm font-bold text-amber-100">Scanner basket</span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
          />
          <span className="text-[10px] text-amber-300/70">
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="max-h-56 overflow-y-auto">
        {cart.items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-amber-300/60">
            No items scanned yet.
          </p>
        ) : (
          <ul className="divide-y divide-amber-900/20">
            {cart.items.map((line) => (
              <li
                key={line.clientLineId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <div className="w-9 h-9 rounded-md bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-600 text-sm">🏷️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-50 truncate">
                    {line.productName}
                  </p>
                  <p className="text-[10px] text-amber-300/60 truncate">
                    {line.variantName ?? `SKU ${line.sku}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-amber-300/60">
                    {formatMinor(line.unitPrice, currency)} × {line.quantity}
                  </p>
                  <p className="text-xs font-bold text-amber-100">
                    {formatMinor(line.unitPrice * line.quantity, currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="px-4 py-3 border-t border-amber-800/30 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-amber-300/70">
            Subtotal · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="text-amber-100">
            {formatMinor(cart.totals.subtotal, currency)}
          </span>
        </div>
        {cart.totals.discountTotal > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-amber-300/70">Discount</span>
            <span className="text-emerald-300">
              −{formatMinor(cart.totals.discountTotal, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-amber-900/30">
          <span className="text-amber-50">Total</span>
          <span className="text-amber-300 text-base">
            {formatMinor(cart.totals.grandTotal, currency)}
          </span>
        </div>
      </div>

      {/* Order number once completed */}
      {status === "COMPLETED" && session.resultOrderNumber && (
        <div className="px-4 py-2 bg-emerald-950/30 border-t border-emerald-900/30">
          <p className="text-xs text-emerald-300">
            Order <span className="font-mono font-bold">#{session.resultOrderNumber}</span> created.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-950/30 border-t border-red-900/30">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-amber-800/30 flex gap-2">
        {status === "ACTIVE" && (
          <>
            <p className="flex-1 text-[11px] text-amber-300/60 self-center">
              Waiting for the floor staff to finish scanning…
            </p>
            <button
              onClick={onVoid}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-40"
            >
              Void
            </button>
          </>
        )}
        {status === "AWAITING_PAYMENT" && (
          <>
            <button
              onClick={onCompleteSale}
              disabled={busy || cart.items.length === 0}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors disabled:opacity-40 active:scale-[0.98]"
            >
              ✓ Complete sale · {formatMinor(cart.totals.grandTotal, currency)}
            </button>
            <button
              onClick={onVoid}
              disabled={busy}
              className="px-3 py-2.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-40"
            >
              Void
            </button>
          </>
        )}
        {(status === "COMPLETED" || status === "VOIDED") && (
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
