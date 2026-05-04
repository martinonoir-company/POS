"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOrders, fetchOrderById } from "../lib/api";
import type { OrderSummary, OrderQueryParams } from "../lib/api";

function fmt(n: number): string { return `₦${Number(n).toLocaleString()}`; }
function fmtDate(iso: string): string { return new Date(iso).toLocaleDateString("en-NG", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); }
const STATUS_COLORS: Record<string, string> = { DRAFT:"bg-zinc-700 text-zinc-300", PENDING_PAYMENT:"bg-yellow-900 text-yellow-300", PAID:"bg-emerald-900 text-emerald-300", PROCESSING:"bg-blue-900 text-blue-300", SHIPPED:"bg-indigo-900 text-indigo-300", DELIVERED:"bg-emerald-900 text-emerald-300", CANCELLED:"bg-red-900 text-red-300", RETURNED:"bg-red-900 text-red-300", REFUNDED:"bg-purple-900 text-purple-300" };
const PM_OPTIONS = [{ value:"", label:"All Methods" },{ value:"CASH", label:"Cash" },{ value:"POS_TERMINAL", label:"POS Terminal" },{ value:"BANK_TRANSFER", label:"Bank Transfer" },{ value:"PAYSTACK", label:"Paystack" },{ value:"STRIPE", label:"Stripe" },{ value:"MONIEPOINT", label:"Moniepoint" }];

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-3 border-t border-zinc-800">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
      <div className="flex gap-1">
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let pg: number;
          if (pages <= 7) pg = i + 1; else if (page <= 4) pg = i + 1; else if (page >= pages - 3) pg = pages - 6 + i; else pg = page - 3 + i;
          return <button key={pg} onClick={() => onChange(pg)} className={`w-8 h-8 text-sm rounded-lg transition-colors ${pg === page ? "bg-amber-500 text-black font-bold" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{pg}</button>;
        })}
      </div>
      <button onClick={() => onChange(page + 1)} disabled={page >= pages} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
    </div>
  );
}

export default function PaymentsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<OrderSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, filters: OrderQueryParams) => {
    setLoading(true);
    try {
      const params: OrderQueryParams = { page: pg, limit: 15, channel: "POS", ...filters };
      const res = await fetchOrders(params);
      setOrders(res.data.items);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(1, { search: search || undefined, startDate: startDate || undefined, endDate: endDate || undefined });
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, startDate, endDate, paymentMethod, load]);

  function goToPage(pg: number) { setPage(pg); load(pg, { search: search || undefined, startDate: startDate || undefined, endDate: endDate || undefined }); }

  async function openDetail(order: OrderSummary) {
    setDetailLoading(true); setSelected(order);
    try { const res = await fetchOrderById(order.id); setSelected(res.data); } catch { /* keep summary */ }
    finally { setDetailLoading(false); }
  }

  // Filter by payment method client-side (server doesn't support this filter directly)
  const filtered = paymentMethod ? orders.filter(o => o.paymentMethod === paymentMethod) : orders;

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"><span>←</span> Back to Payments</button>
        {detailLoading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-white text-xl font-bold">{selected.orderNumber}</h2>
                  <p className="text-zinc-500 text-sm">{fmtDate(selected.createdAt)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status] || "bg-zinc-700 text-zinc-300"}`}>{selected.status.replace(/_/g, " ")}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-zinc-500">Payment</p><p className="text-white font-medium">{selected.paymentMethod?.replace(/_/g, " ") || "—"}</p></div>
                <div><p className="text-zinc-500">Channel</p><p className="text-white font-medium">{selected.channel}</p></div>
                <div><p className="text-zinc-500">Subtotal</p><p className="text-white font-medium">{fmt(selected.subtotal)}</p></div>
                <div><p className="text-zinc-500">Grand Total</p><p className="text-amber-400 font-bold">{fmt(selected.grandTotal)}</p></div>
              </div>
            </div>
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
              <div className="px-5 py-3 border-b border-zinc-700/50"><h3 className="text-white font-semibold">Items</h3></div>
              <div className="divide-y divide-zinc-700/50">
                {selected.items.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-white text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-zinc-500 text-xs">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm">{item.quantity} × {fmt(item.unitPrice)}</p>
                      <p className="text-amber-400 font-bold text-sm">{fmt(item.lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Payments & Transactions</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order #..." className="flex-1 min-w-[200px] px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm">
          {PM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm" />
        <span className="text-zinc-500 self-center text-sm">to</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm" />
      </div>
      <p className="text-zinc-500 text-xs mb-2 px-1">{total} transaction{total !== 1 ? "s" : ""}</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-500"><div className="text-4xl mb-3">💳</div><p className="font-medium">No transactions found</p></div>
        ) : filtered.map(o => (
          <button key={o.id} onClick={() => openDetail(o)} className="w-full text-left bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800 transition-all group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">{o.orderNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || "bg-zinc-700 text-zinc-300"}`}>{o.status.replace(/_/g, " ")}</span>
              </div>
              <span className="text-amber-400 font-bold text-sm">{fmt(o.grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex gap-3">
                <span>{fmtDate(o.createdAt)}</span>
                <span>{o.paymentMethod?.replace(/_/g, " ") || "—"}</span>
                <span>{o.items.length} item{o.items.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="text-zinc-600 group-hover:text-amber-500 transition-colors">View →</span>
            </div>
          </button>
        ))}
      </div>
      <Pagination page={page} pages={pages} onChange={goToPage} />
    </div>
  );
}
