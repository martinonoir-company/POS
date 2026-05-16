"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchCoupons } from "../lib/api";

// Money is stored in minor units (kobo) — divide for display.
function fmt(minor: number): string { return `₦${(Number(minor) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso?: string): string { return iso ? new Date(iso).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

type Coupon = { id: string; code: string; description?: string; discountType: string; discountValue: number; currency?: string; minimumOrderAmount: number; maximumDiscount: number; usageLimit: number; timesUsed: number; status: string; startsAt?: string; expiresAt?: string; createdAt: string };

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-900 text-emerald-300",
  EXPIRED: "bg-red-900 text-red-300",
  DISABLED: "bg-zinc-700 text-zinc-400",
};

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-3 border-t border-zinc-800">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
      <div className="flex gap-1">
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let pg: number;
          if (pages <= 7) pg = i + 1;
          else if (page <= 4) pg = i + 1;
          else if (page >= pages - 3) pg = pages - 6 + i;
          else pg = page - 3 + i;
          return (
            <button key={pg} onClick={() => onChange(pg)} className={`w-8 h-8 text-sm rounded-lg transition-colors ${pg === page ? "bg-amber-500 text-black font-bold" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{pg}</button>
          );
        })}
      </div>
      <button onClick={() => onChange(page + 1)} disabled={page >= pages} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
    </div>
  );
}

export default function DiscountsPage() {
  const [tab, setTab] = useState<"ACTIVE" | "inactive">("ACTIVE");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (pg: number, status?: string) => {
    setLoading(true);
    try {
      const res = await fetchCoupons(pg, 15, status);
      setCoupons(res.data.items);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setPage(1); load(1, tab === "ACTIVE" ? "ACTIVE" : undefined); }, [tab, load]);

  function goToPage(pg: number) {
    setPage(pg);
    load(pg, tab === "ACTIVE" ? "ACTIVE" : undefined);
  }

  const displayCoupons = tab === "inactive" ? coupons.filter(c => c.status !== "ACTIVE") : coupons;

  function discountDisplay(c: Coupon): string {
    if (c.discountType === "PERCENTAGE") return `${c.discountValue}% off`;
    if (c.discountType === "FREE_SHIPPING") return "Free Shipping";
    return `${fmt(c.discountValue)} off`;
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Discounts & Promotions</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["ACTIVE", "inactive"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"}`}>
            {t === "ACTIVE" ? "Active" : "Inactive / Expired"}
          </button>
        ))}
      </div>

      <p className="text-zinc-500 text-xs mb-2 px-1">{total} coupon{total !== 1 ? "s" : ""}</p>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : displayCoupons.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="font-medium">No {tab === "ACTIVE" ? "active" : "inactive"} coupons</p>
          </div>
        ) : displayCoupons.map(c => (
          <div key={c.id} className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm font-mono bg-zinc-700 px-2 py-1 rounded">{c.code}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[c.status] || "bg-zinc-700 text-zinc-400"}`}>{c.status}</span>
              </div>
              <span className="text-amber-400 font-bold text-sm">{discountDisplay(c)}</span>
            </div>
            {c.description && <p className="text-zinc-400 text-xs mb-2">{c.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
              <span>Min: {c.minimumOrderAmount > 0 ? fmt(c.minimumOrderAmount) : "None"}</span>
              {c.maximumDiscount > 0 && <span>Max: {fmt(c.maximumDiscount)}</span>}
              <span>Used: {c.timesUsed}{c.usageLimit > 0 ? `/${c.usageLimit}` : ""}</span>
              <span>Starts: {fmtDate(c.startsAt)}</span>
              <span>Expires: {fmtDate(c.expiresAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pages={pages} onChange={goToPage} />
    </div>
  );
}
