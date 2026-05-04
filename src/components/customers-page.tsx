"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCustomers, fetchCustomerById } from "../lib/api";

function fmt(n: number): string { return `₦${Number(n).toLocaleString()}`; }
function fmtDate(iso?: string): string { return iso ? new Date(iso).toLocaleDateString("en-NG", { year:"numeric", month:"short", day:"numeric" }) : "—"; }

type CustomerItem = { id: string; userId: string; totalOrders: number; totalSpentNgn: number; totalSpentUsd: number; avgOrderValueNgn: number; lastOrderAt?: string; tags: string[]; notes?: string; createdAt: string; user?: { id: string; email: string; firstName: string; lastName: string } };

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, s?: string) => {
    setLoading(true);
    try {
      const res = await fetchCustomers(pg, 15, s);
      setCustomers(res.data.items);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, search || undefined); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, load]);

  function goToPage(pg: number) { setPage(pg); load(pg, search || undefined); }

  async function openDetail(c: CustomerItem) {
    setDetailLoading(true); setSelected(c);
    try { const res = await fetchCustomerById(c.id); setSelected(res.data); } catch { /* keep summary */ }
    finally { setDetailLoading(false); }
  }

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"><span>←</span> Back to Customers</button>
        {detailLoading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Profile */}
            <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-white text-2xl font-bold">
                  {selected.user?.firstName?.[0] || "?"}
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">{selected.user?.firstName} {selected.user?.lastName}</h2>
                  <p className="text-zinc-500 text-sm">{selected.user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-zinc-500">Total Orders</p><p className="text-white font-bold text-lg">{selected.totalOrders}</p></div>
                <div><p className="text-zinc-500">Total Spent</p><p className="text-amber-400 font-bold text-lg">{fmt(selected.totalSpentNgn)}</p></div>
                <div><p className="text-zinc-500">Avg Order</p><p className="text-emerald-400 font-bold text-lg">{fmt(selected.avgOrderValueNgn || 0)}</p></div>
                <div><p className="text-zinc-500">Last Order</p><p className="text-white font-medium">{fmtDate(selected.lastOrderAt)}</p></div>
              </div>
            </div>

            {/* Tags */}
            {selected.tags?.length > 0 && (
              <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50">
                <p className="text-zinc-500 text-xs mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((t: string) => <span key={t} className="px-3 py-1 bg-zinc-700 rounded-full text-xs text-zinc-300">{t}</span>)}
                </div>
              </div>
            )}

            {/* Notes */}
            {selected.notes && (
              <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50">
                <p className="text-zinc-500 text-xs mb-1">Notes</p>
                <p className="text-white text-sm">{selected.notes}</p>
              </div>
            )}

            {/* Addresses */}
            {selected.addresses?.length > 0 && (
              <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                <div className="px-5 py-3 border-b border-zinc-700/50"><h3 className="text-white font-semibold">Addresses</h3></div>
                <div className="divide-y divide-zinc-700/50">
                  {selected.addresses.map((a: { id: string; label?: string; line1: string; city: string; state: string; country: string; isDefault: boolean }) => (
                    <div key={a.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        {a.label && <span className="text-white text-sm font-medium">{a.label}</span>}
                        {a.isDefault && <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded-full">Default</span>}
                      </div>
                      <p className="text-zinc-400 text-sm">{a.line1}, {a.city}, {a.state}, {a.country}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {selected.recentOrders?.length > 0 && (
              <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                <div className="px-5 py-3 border-b border-zinc-700/50"><h3 className="text-white font-semibold">Recent Orders</h3></div>
                <div className="divide-y divide-zinc-700/50">
                  {selected.recentOrders.slice(0, 10).map((o: { id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string; items: { id: string }[] }) => (
                    <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-white text-sm font-medium">{o.orderNumber}</span>
                        <span className="text-zinc-500 text-xs ml-2">{fmtDate(o.createdAt)}</span>
                      </div>
                      <span className="text-amber-400 font-bold text-sm">{fmt(o.grandTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Customers</h2>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4" />
      <p className="text-zinc-500 text-xs mb-2 px-1">{total} customer{total !== 1 ? "s" : ""}</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-zinc-500"><div className="text-4xl mb-3">👥</div><p className="font-medium">No customers found</p></div>
        ) : customers.map(c => (
          <button key={c.id} onClick={() => openDetail(c)} className="w-full text-left bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800 transition-all group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold">{c.user?.firstName?.[0] || "?"}</div>
                <div>
                  <span className="text-white font-medium text-sm">{c.user?.firstName} {c.user?.lastName}</span>
                  <p className="text-zinc-500 text-xs">{c.user?.email}</p>
                </div>
              </div>
              <span className="text-amber-400 font-bold text-sm">{fmt(c.totalSpentNgn)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
              <div className="flex gap-3">
                <span>{c.totalOrders} order{c.totalOrders !== 1 ? "s" : ""}</span>
                <span>Since {fmtDate(c.createdAt)}</span>
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
