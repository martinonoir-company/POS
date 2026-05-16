"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "../lib/api";

// Money is stored in minor units (kobo) — divide for display.
function fmt(minor: number): string { return `₦${(Number(minor) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function getTodayISO(): string { return new Date().toISOString().split("T")[0]; }
function getWeekAgoISO(): string { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; }
function getMonthStartISO(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }

type AnalyticsData = {
  orderCount: number; totalRevenue: number; totalDiscount: number; avgOrderValue: number;
  paymentBreakdown: { method: string; count: number; total: number }[];
  topProducts: { productName: string; sku: string; totalQty: number; totalRevenue: number }[];
  dailyRevenue: { date: string; orders: number; revenue: number }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getMonthStartISO());
  const [endDate, setEndDate] = useState(getTodayISO());
  const [activePreset, setActivePreset] = useState<string>("month");

  const load = useCallback(async (s: string, e: string) => {
    setLoading(true);
    try {
      const res = await fetchAnalytics(s, e);
      setData(res.data);
    } catch (err) { console.error("Analytics failed:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(startDate, endDate); }, [load, startDate, endDate]);

  function preset(id: string, s: string, e: string) { setActivePreset(id); setStartDate(s); setEndDate(e); }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <h2 className="text-white font-bold text-xl mb-4">Reports & Analytics</h2>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { id: "today", label: "Today", s: getTodayISO(), e: getTodayISO() },
          { id: "week", label: "This Week", s: getWeekAgoISO(), e: getTodayISO() },
          { id: "month", label: "This Month", s: getMonthStartISO(), e: getTodayISO() },
        ].map(p => (
          <button key={p.id} onClick={() => preset(p.id, p.s, p.e)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePreset === p.id ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"}`}
          >{p.label}</button>
        ))}
        <input type="date" value={startDate} onChange={e => { setActivePreset(""); setStartDate(e.target.value); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm" />
        <span className="text-zinc-500 self-center text-sm">to</span>
        <input type="date" value={endDate} onChange={e => { setActivePreset(""); setEndDate(e.target.value); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue", value: fmt(data.totalRevenue), color: "text-amber-400" },
              { label: "Orders", value: String(data.orderCount), color: "text-white" },
              { label: "Avg Order Value", value: fmt(data.avgOrderValue), color: "text-emerald-400" },
              { label: "Total Discounts", value: fmt(data.totalDiscount), color: "text-red-400" },
            ].map(c => (
              <div key={c.label} className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50">
                <p className="text-zinc-500 text-xs mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Payment Breakdown */}
          <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <div className="px-5 py-3 border-b border-zinc-700/50">
              <h3 className="text-white font-semibold">Payment Methods</h3>
            </div>
            <div className="divide-y divide-zinc-700/50">
              {data.paymentBreakdown.length === 0 ? (
                <p className="px-5 py-4 text-zinc-500 text-sm">No data</p>
              ) : data.paymentBreakdown.map(p => (
                <div key={p.method} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-medium">{p.method.replace(/_/g, " ")}</span>
                    <span className="text-zinc-500 text-xs ml-2">{p.count} order{p.count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-amber-400 font-bold text-sm">{fmt(p.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <div className="px-5 py-3 border-b border-zinc-700/50">
              <h3 className="text-white font-semibold">Top Selling Products</h3>
            </div>
            <div className="divide-y divide-zinc-700/50">
              {data.topProducts.length === 0 ? (
                <p className="px-5 py-4 text-zinc-500 text-sm">No data</p>
              ) : data.topProducts.map((p, i) => (
                <div key={p.sku} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 font-bold">{i + 1}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{p.productName}</p>
                      <p className="text-zinc-500 text-xs">{p.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{p.totalQty} sold</p>
                    <p className="text-amber-400 font-bold text-xs">{fmt(p.totalRevenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Revenue */}
          {data.dailyRevenue.length > 0 && (
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
              <div className="px-5 py-3 border-b border-zinc-700/50">
                <h3 className="text-white font-semibold">Daily Revenue</h3>
              </div>
              <div className="p-5 overflow-x-auto">
                <div className="flex items-end gap-1 h-32 min-w-[400px]">
                  {data.dailyRevenue.map(d => {
                    const max = Math.max(...data.dailyRevenue.map(x => Number(x.revenue)), 1);
                    const h = Math.max(4, (Number(d.revenue) / max) * 100);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmt(d.revenue)} (${d.orders} orders)`}>
                        <div className="w-full bg-amber-500/80 rounded-t" style={{ height: `${h}%` }} />
                        <span className="text-zinc-600 text-[9px] rotate-45 origin-left whitespace-nowrap">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-zinc-500 text-center py-16">Failed to load analytics</p>
      )}
    </div>
  );
}
