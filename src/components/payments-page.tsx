"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPayments } from "../lib/api";
import type { PaymentRecord } from "../lib/api";

function fmt(minor: number, currency = "NGN"): string {
  const sign = currency === "USD" ? "$" : "₦";
  return `${sign}${(Number(minor) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "bg-emerald-900 text-emerald-300",
  PENDING: "bg-yellow-900 text-yellow-300",
  PROCESSING: "bg-blue-900 text-blue-300",
  FAILED: "bg-red-900 text-red-300",
  CANCELLED: "bg-zinc-700 text-zinc-300",
  REFUNDED: "bg-purple-900 text-purple-300",
};
const METHOD_LABEL: Record<string, string> = {
  CARD: "Card", CASH: "Cash", POS_TRANSFER: "POS Transfer", BANK_TRANSFER: "Bank Transfer",
};
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

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
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, s: string, st: string) => {
    setLoading(true);
    try {
      const res = await fetchPayments(pg, 15, { search: s || undefined, status: st || undefined });
      setPayments(res.data.items);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(1, search, status);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, status, load]);

  function goToPage(pg: number) {
    setPage(pg);
    load(pg, search, status);
  }

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"><span>←</span> Back to Payments</button>
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-white text-xl font-bold">{fmt(selected.amount, selected.currency)}</h2>
                <p className="text-zinc-500 text-sm">Order {selected.orderNumber} · {fmtDate(selected.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status] || "bg-zinc-700 text-zinc-300"}`}>{selected.status}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><p className="text-zinc-500">Method</p><p className="text-white font-medium">{METHOD_LABEL[selected.method] || selected.method}</p></div>
              <div><p className="text-zinc-500">Provider</p><p className="text-white font-medium">{selected.provider}</p></div>
              <div><p className="text-zinc-500">Channel</p><p className="text-white font-medium">{selected.channel}</p></div>
              <div><p className="text-zinc-500">Merchant Ref</p><p className="text-white font-mono text-xs break-all">{selected.merchantReference}</p></div>
              <div><p className="text-zinc-500">Provider Ref</p><p className="text-white font-mono text-xs break-all">{selected.providerReference || "—"}</p></div>
              {selected.terminalSerial && <div><p className="text-zinc-500">Terminal</p><p className="text-white font-mono text-xs">{selected.terminalSerial}</p></div>}
              <div><p className="text-zinc-500">Paid At</p><p className="text-white font-medium">{selected.paidAt ? fmtDate(selected.paidAt) : "—"}</p></div>
            </div>
            {selected.gatewayResponse && (
              <div className="mt-3 bg-zinc-900/60 rounded-lg p-3 border border-zinc-700/50">
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Gateway Response</p>
                <p className="text-zinc-200 text-sm">{selected.gatewayResponse}</p>
              </div>
            )}
            {selected.failureReason && (
              <div className="mt-3 bg-red-950/40 rounded-lg p-3 border border-red-900/50">
                <p className="text-red-400 text-xs uppercase tracking-wide mb-1">Failure Reason</p>
                <p className="text-red-300 text-sm">{selected.failureReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Payments &amp; Transactions</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order # or reference..." className="flex-1 min-w-[200px] px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <p className="text-zinc-500 text-xs mb-2 px-1">{total} payment{total !== 1 ? "s" : ""}</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-zinc-500"><div className="text-4xl mb-3">💳</div><p className="font-medium">No payments found</p></div>
        ) : payments.map((p) => (
          <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800 transition-all group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">{p.orderNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[p.status] || "bg-zinc-700 text-zinc-300"}`}>{p.status}</span>
              </div>
              <span className="text-amber-400 font-bold text-sm">{fmt(p.amount, p.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex gap-3">
                <span>{fmtDate(p.createdAt)}</span>
                <span>{METHOD_LABEL[p.method] || p.method}</span>
                <span>{p.provider}</span>
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
