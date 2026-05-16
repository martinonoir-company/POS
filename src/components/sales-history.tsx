"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOrders, fetchOrderById } from "../lib/api";
import type { OrderSummary, OrderQueryParams } from "../lib/api";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_PAYMENT", label: "Pending Payment" },
  { value: "PAID", label: "Paid" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RETURNED", label: "Returned" },
  { value: "REFUNDED", label: "Refunded" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-700 text-zinc-300",
  PENDING_PAYMENT: "bg-yellow-900 text-yellow-300",
  PAID: "bg-emerald-900 text-emerald-300",
  PROCESSING: "bg-blue-900 text-blue-300",
  SHIPPED: "bg-indigo-900 text-indigo-300",
  DELIVERED: "bg-emerald-900 text-emerald-300",
  CANCELLED: "bg-red-900 text-red-300",
  RETURN_REQUESTED: "bg-orange-900 text-orange-300",
  RETURN_APPROVED: "bg-orange-900 text-orange-300",
  RETURNED: "bg-red-900 text-red-300",
  REFUNDED: "bg-purple-900 text-purple-300",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(minor: number): string {
  // Order amounts are stored in minor units (kobo) — divide for display.
  return `₦${(Number(minor) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

export default function SalesHistory() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail view
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrders = useCallback(async (pg: number, filters: OrderQueryParams) => {
    setLoading(true);
    try {
      const res = await fetchOrders({
        page: pg,
        limit: PAGE_SIZE,
        channel: "POS",
        ...filters,
      });
      setOrders(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadOrders(1, {});
  }, [loadOrders]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadOrders(1, { search, status: status || undefined, startDate: startDate || undefined, endDate: endDate || undefined });
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, loadOrders, status, startDate, endDate]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    loadOrders(1, {});
  }

  function goToPage(pg: number) {
    if (pg < 1 || pg > totalPages) return;
    setPage(pg);
    loadOrders(pg, {
      search: search || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }

  async function openDetail(order: OrderSummary) {
    setDetailLoading(true);
    setSelectedOrder(order);
    try {
      const res = await fetchOrderById(order.id);
      setSelectedOrder(res.data);
    } catch {
      // Keep the summary version if detail fails
    } finally {
      setDetailLoading(false);
    }
  }

  // Preset date filters
  function setToday() {
    const today = getTodayISO();
    setStartDate(today);
    setEndDate(today);
  }
  function setThisWeek() {
    setStartDate(getWeekAgoISO());
    setEndDate(getTodayISO());
  }
  function setThisMonth() {
    const d = new Date();
    setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setEndDate(getTodayISO());
  }

  // ── Detail View ──
  if (selectedOrder) {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => setSelectedOrder(null)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"
        >
          <span>←</span> Back to Sales History
        </button>

        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Header */}
            <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-white text-xl font-bold">{selectedOrder.orderNumber}</h2>
                  <p className="text-zinc-500 text-sm">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[selectedOrder.status] || "bg-zinc-700 text-zinc-300"}`}>
                  {selectedOrder.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500">Channel</p>
                  <p className="text-white font-medium">{selectedOrder.channel}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Payment</p>
                  <p className="text-white font-medium">{selectedOrder.paymentMethod?.replace(/_/g, " ") || "—"}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Currency</p>
                  <p className="text-white font-medium">{selectedOrder.currency}</p>
                </div>
                {selectedOrder.couponCode && (
                  <div>
                    <p className="text-zinc-500">Coupon</p>
                    <p className="text-amber-400 font-medium">{selectedOrder.couponCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
              <div className="px-5 py-3 border-b border-zinc-700/50">
                <h3 className="text-white font-semibold">Items ({selectedOrder.items.length})</h3>
              </div>
              <div className="divide-y divide-zinc-700/50">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-white text-sm font-medium truncate">{item.productName}</p>
                      {item.variantName && item.variantName !== "Default" && (
                        <p className="text-zinc-400 text-xs">{item.variantName}</p>
                      )}
                      <p className="text-zinc-500 text-xs">{item.sku}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-sm">
                        {item.quantity} × {formatMoney(item.unitPrice)}
                      </p>
                      <p className="text-amber-400 font-bold text-sm">{formatMoney(item.lineTotal)}</p>
                      {Number(item.discountAmount) > 0 && (
                        <p className="text-emerald-400 text-xs">-{formatMoney(item.discountAmount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Subtotal</span>
                <span className="text-white">{formatMoney(selectedOrder.subtotal)}</span>
              </div>
              {Number(selectedOrder.discountTotal) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400">Discount</span>
                  <span className="text-emerald-400">-{formatMoney(selectedOrder.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-zinc-700 pt-2">
                <span className="text-white">Total</span>
                <span className="text-amber-400">{formatMoney(selectedOrder.grandTotal)}</span>
              </div>
            </div>

            {/* Discount Audit Trail */}
            {Number(selectedOrder.discountTotal) > 0 && (
              <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
                <h3 className="text-white font-semibold mb-3">Discount Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Type</p>
                    <p className="text-white font-medium">
                      {selectedOrder.discountType === "COUPON" ? `🏷️ Coupon (${selectedOrder.couponCode})` : selectedOrder.discountType === "MANUAL" ? "💰 Manual Discount" : selectedOrder.couponCode ? `🏷️ Coupon (${selectedOrder.couponCode})` : "Discount"}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Amount</p>
                    <p className="text-emerald-400 font-bold">-{formatMoney(selectedOrder.discountTotal)}</p>
                  </div>
                  {selectedOrder.discountAppliedByName && (
                    <div>
                      <p className="text-zinc-500 text-xs">Applied By</p>
                      <p className="text-white font-medium">{selectedOrder.discountAppliedByName}</p>
                    </div>
                  )}
                  {selectedOrder.discountAppliedAt && (
                    <div>
                      <p className="text-zinc-500 text-xs">Applied At</p>
                      <p className="text-white">{formatDate(selectedOrder.discountAppliedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-zinc-500 text-xs">Total Before Discount</p>
                    <p className="text-white">{formatMoney(selectedOrder.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Total After Discount</p>
                    <p className="text-amber-400 font-bold">{formatMoney(selectedOrder.grandTotal)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status History */}
            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                <div className="px-5 py-3 border-b border-zinc-700/50">
                  <h3 className="text-white font-semibold">Status History</h3>
                </div>
                <div className="divide-y divide-zinc-700/50">
                  {selectedOrder.statusHistory.map((h, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-zinc-500">{h.fromStatus.replace(/_/g, " ")}</span>
                        <span className="text-zinc-600 mx-2">→</span>
                        <span className="text-white font-medium">{h.toStatus.replace(/_/g, " ")}</span>
                        {h.reason && <span className="text-zinc-500 ml-2">({h.reason})</span>}
                      </div>
                      <span className="text-zinc-500 text-xs">{formatDate(h.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {(selectedOrder.customerNote || selectedOrder.staffNote) && (
              <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50 space-y-2">
                {selectedOrder.customerNote && (
                  <div>
                    <p className="text-zinc-500 text-xs">Customer Note</p>
                    <p className="text-white text-sm">{selectedOrder.customerNote}</p>
                  </div>
                )}
                {selectedOrder.staffNote && (
                  <div>
                    <p className="text-zinc-500 text-xs">Staff Note</p>
                    <p className="text-white text-sm">{selectedOrder.staffNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Sales History</h2>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number..."
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />

        <div className="flex flex-wrap gap-2">
          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-zinc-500 self-center text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />

          {/* Preset buttons */}
          <div className="flex gap-1">
            <button onClick={setToday} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-amber-500 text-xs transition-colors">Today</button>
            <button onClick={setThisWeek} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-amber-500 text-xs transition-colors">This Week</button>
            <button onClick={setThisMonth} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-amber-500 text-xs transition-colors">This Month</button>
          </div>

          {/* Clear */}
          {(search || status || startDate || endDate) && (
            <button onClick={clearFilters} className="px-3 py-2 text-red-400 hover:text-red-300 text-xs transition-colors">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-zinc-500 text-xs">
          {total} sale{total !== 1 ? "s" : ""}
          {(startDate || endDate) && ` • ${startDate || "..."} to ${endDate || "..."}`}
        </p>
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400" />
        )}
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => openDetail(order)}
            className="w-full text-left bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800 transition-all duration-150 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">{order.orderNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[order.status] || "bg-zinc-700 text-zinc-300"}`}>
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-amber-400 font-bold text-sm">{formatMoney(order.grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-3">
                <span>{formatDate(order.createdAt)}</span>
                <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                {order.paymentMethod && <span>{order.paymentMethod.replace(/_/g, " ")}</span>}
              </div>
              <span className="text-zinc-600 group-hover:text-amber-500 transition-colors">View →</span>
            </div>
          </button>
        ))}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">No sales found</p>
            {(search || status || startDate || endDate) && (
              <p className="text-sm mt-1">Try adjusting your filters</p>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-3 border-t border-zinc-800">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pg: number;
              if (totalPages <= 7) {
                pg = i + 1;
              } else if (page <= 4) {
                pg = i + 1;
              } else if (page >= totalPages - 3) {
                pg = totalPages - 6 + i;
              } else {
                pg = page - 3 + i;
              }
              return (
                <button
                  key={pg}
                  onClick={() => goToPage(pg)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    pg === page
                      ? "bg-amber-500 text-black font-bold"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
