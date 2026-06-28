"use client";
import { formatMoney } from "../lib/money";
import type { DispatchNewPayload } from "../lib/pos-session-events";

/**
 * Large, attention-grabbing modal raised when a new shipping order needs
 * dispatch. Shows the order summary; the close icon dismisses it and "View
 * order details" jumps to the Dispatch tab (and ideally opens that order).
 */
export default function DispatchAlertModal({
  alert,
  pending,
  onClose,
  onViewDetails,
}: {
  alert: DispatchNewPayload;
  pending: number;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-zinc-900 border-2 border-amber-500 rounded-2xl shadow-2xl shadow-amber-500/20 overflow-hidden animate-[pulse_1.5s_ease-in-out_2]">
        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚚</span>
            <div>
              <h2 className="text-lg font-extrabold text-zinc-950 leading-tight">
                New Order Dispatch
              </h2>
              <p className="text-xs text-zinc-800">
                A new {alert.channel.toLowerCase()} order needs to be sorted for pickup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-900 hover:text-zinc-700 text-2xl leading-none font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xl font-bold text-amber-400">
              {alert.orderNumber}
            </span>
            <span className="font-mono text-lg text-white">
              {formatMoney(alert.grandTotal, alert.currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Customer" value={alert.customerName} />
            <Info label="Items" value={`${alert.itemCount} unit${alert.itemCount !== 1 ? "s" : ""}`} />
            <Info
              label="Destination"
              value={
                [alert.city, alert.state].filter(Boolean).join(", ") || "—"
              }
            />
            <Info
              label="Placed"
              value={new Date(alert.createdAt).toLocaleTimeString()}
            />
          </div>

          {pending > 0 && (
            <p className="text-xs text-amber-400/80">
              + {pending} more dispatch alert{pending !== 1 ? "s" : ""} waiting
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700"
            >
              Dismiss
            </button>
            <button
              onClick={onViewDetails}
              className="flex-1 py-3 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400"
            >
              View order details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-zinc-200">{value}</p>
    </div>
  );
}
