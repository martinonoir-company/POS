"use client";
import { useCallback, useEffect, useState } from "react";
import {
  fetchDispatchQueue,
  markOrderDispatched,
  type OrderSummary,
} from "../lib/api";
import { formatMoney } from "../lib/money";
import OrderBarcode from "./order-barcode";
import ShippingLabel from "./shipping-label";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Dispatched", value: "DISPATCHED" },
];

const PAGE_SIZE = 15;

/**
 * Dispatch queue tab. Lists storefront/mobile orders that ship from the
 * branch (so staff sort them for AAJ pickup), with status filtering and
 * pagination like the other tabs. Selecting an order opens its details +
 * the scannable order barcode; scanning (or the manual button) marks it
 * DISPATCHED.
 */
export default function DispatchPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDispatchQueue({
        page,
        limit: PAGE_SIZE,
        dispatchStatus: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dispatch queue");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Dispatch</h1>
          <p className="text-xs text-zinc-500">
            {total.toLocaleString()} shipping order{total !== 1 ? "s" : ""} for branch pickup
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              statusFilter === f.value
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
          className="ml-auto"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #…"
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </form>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-950/40 border border-red-900/50 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Order #</th>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Destination</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-left px-3 py-2 font-medium">Dispatch</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-600 text-xs">
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-600 text-xs">
                  No dispatch orders.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const addr = o.shippingAddress;
                const name = addr
                  ? `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim()
                  : o.user
                    ? `${o.user.firstName} ${o.user.lastName}`
                    : "—";
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="border-t border-zinc-800 hover:bg-zinc-800/40 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-amber-400">
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{name}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">
                      {addr ? `${addr.city ?? ""}${addr.state ? `, ${addr.state}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-200">
                      {formatMoney(o.grandTotal, o.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <DispatchBadge status={o.dispatchStatus} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <DispatchDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onDispatched={(updated) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updated.id ? updated : o)),
            );
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}

function DispatchBadge({ status }: { status?: string | null }) {
  if (status === "DISPATCHED") {
    return (
      <span className="rounded bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
        Dispatched
      </span>
    );
  }
  return (
    <span className="rounded bg-orange-500/15 text-orange-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
      Pending
    </span>
  );
}

function DispatchDetailModal({
  order,
  onClose,
  onDispatched,
}: {
  order: OrderSummary;
  onClose: () => void;
  onDispatched: (o: OrderSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLabel, setShowLabel] = useState(false);
  const addr = order.shippingAddress;
  const done = order.dispatchStatus === "DISPATCHED";

  async function handleMark() {
    setBusy(true);
    setError(null);
    try {
      const res = await markOrderDispatched(order.orderNumber);
      onDispatched(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark dispatched");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white font-mono">{order.orderNumber}</h2>
            <p className="text-xs text-zinc-500">{order.channel} · {order.status}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="mb-3">
          <DispatchBadge status={order.dispatchStatus} />
        </div>

        {/* Ship to */}
        {addr && (
          <div className="mb-3 rounded-lg bg-zinc-800/50 p-3 text-xs text-zinc-300 space-y-0.5">
            <p className="text-zinc-500 uppercase tracking-wide text-[10px] mb-1">Ship to</p>
            <p className="font-medium text-white">
              {addr.firstName} {addr.lastName}
            </p>
            <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
            <p>{addr.city}{addr.state ? `, ${addr.state}` : ""}</p>
            {addr.phone && <p className="text-zinc-500">{addr.phone}</p>}
          </div>
        )}

        {/* Items */}
        <div className="mb-3">
          <p className="text-zinc-500 uppercase tracking-wide text-[10px] mb-1">
            Items ({order.items.length})
          </p>
          <div className="space-y-1">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between text-xs text-zinc-300">
                <span className="truncate pr-2">
                  {it.quantity}× {it.productName}
                  {it.variantName ? ` (${it.variantName})` : ""}
                </span>
                <span className="font-mono text-zinc-500">{it.sku}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barcode — staff scans this to mark dispatched */}
        <div className="mb-4 flex flex-col items-center bg-white rounded-lg p-3">
          <OrderBarcode value={order.orderNumber} width={280} />
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-950/40 border border-red-900/50 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {done ? (
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-3 py-2.5 text-center text-sm text-emerald-300">
            ✓ Dispatched{order.dispatchedAt ? ` · ${new Date(order.dispatchedAt).toLocaleString()}` : ""}
          </div>
        ) : (
          <button
            onClick={handleMark}
            disabled={busy}
            className="w-full py-3 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 disabled:opacity-60"
          >
            {busy ? "Marking…" : "Mark as dispatched"}
          </button>
        )}

        {/* Print shipping label — like the invoice print on a completed sale */}
        <button
          onClick={() => setShowLabel(true)}
          className="mt-2 w-full py-3 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 font-semibold text-sm hover:bg-zinc-700"
        >
          🖨️ Print shipping label
        </button>

        <p className="mt-2 text-center text-[11px] text-zinc-600">
          Or scan the order barcode to mark it dispatched.
        </p>
      </div>

      {showLabel && (
        <ShippingLabel order={order} onClose={() => setShowLabel(false)} />
      )}
    </div>
  );
}
