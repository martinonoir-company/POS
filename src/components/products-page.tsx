"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchProducts } from "../lib/api";
import type { Product } from "../lib/types";
import Image from "next/image";

function fmt(n: number): string { return `₦${Number(n).toLocaleString()}`; }

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, s?: string) => {
    setLoading(true);
    try {
      const res = await fetchProducts({ search: s, page: pg, limit: 20 });
      setProducts(res.data.items);
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

  if (selected) {
    const img = selected.media?.[0]?.url;
    return (
      <div className="h-full flex flex-col">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"><span>←</span> Back to Products</button>
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Product Header */}
          <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50 flex gap-5">
            <div className="w-32 h-32 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 relative">
              {img ? <Image src={img} alt={selected.name} fill className="object-cover" unoptimized /> : <div className="flex items-center justify-center h-full text-zinc-700 text-4xl">📦</div>}
            </div>
            <div>
              <h2 className="text-white text-xl font-bold mb-1">{selected.name}</h2>
              {selected.description && <p className="text-zinc-400 text-sm mb-3">{selected.description}</p>}
              <div className="flex gap-4 text-xs text-zinc-500">
                <span>{selected.variants.length} variant{selected.variants.length !== 1 ? "s" : ""}</span>
                <span>{selected.isActive ? "🟢 Active" : "🔴 Inactive"}</span>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <div className="px-5 py-3 border-b border-zinc-700/50"><h3 className="text-white font-semibold">Variants</h3></div>
            <div className="divide-y divide-zinc-700/50">
              {selected.variants.map(v => (
                <div key={v.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white text-sm font-medium">{v.name === "Default" ? selected.name : v.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">SKU: {v.sku}</span>
                    </div>
                    <span className="text-amber-400 font-bold text-sm">{fmt(Number(v.wholesalePriceNgn))}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    {v.barcode && <span>Barcode: {v.barcode}</span>}
                    <span>{v.isActive ? "Active" : "Inactive"}</span>
                    <span>{v.trackInventory ? "Tracks inventory" : "No inventory tracking"}</span>
                    {v.options && Object.entries(v.options).map(([k, val]) => <span key={k}>{k}: {val}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Product Catalog</h2>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4" />
      <p className="text-zinc-500 text-xs mb-2 px-1">{total} product{total !== 1 ? "s" : ""}</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-zinc-500"><div className="text-4xl mb-3">📦</div><p className="font-medium">No products found</p></div>
        ) : products.map(p => {
          const img = p.media?.[0]?.url;
          const activeVariants = p.variants.filter(v => v.isActive);
          return (
            <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800 transition-all group flex items-center gap-4">
              <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 relative">
                {img ? <Image src={img} alt={p.name} fill className="object-cover" unoptimized /> : <div className="flex items-center justify-center h-full text-zinc-700 text-xl">📦</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{p.name}</p>
                <div className="flex gap-3 text-xs text-zinc-500 mt-0.5">
                  <span>{activeVariants.length} variant{activeVariants.length !== 1 ? "s" : ""}</span>
                  {activeVariants[0] && <span>{activeVariants[0].sku}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {activeVariants[0] && <p className="text-amber-400 font-bold text-sm">{fmt(Number(activeVariants[0].wholesalePriceNgn))}</p>}
                <span className="text-zinc-600 text-xs group-hover:text-amber-500 transition-colors">View →</span>
              </div>
            </button>
          );
        })}
      </div>
      <Pagination page={page} pages={pages} onChange={goToPage} />
    </div>
  );
}
