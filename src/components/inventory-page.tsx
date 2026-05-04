"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchInventoryLevels, fetchMovements } from "../lib/api";

function fmtDate(iso?: string): string { return iso ? new Date(iso).toLocaleDateString("en-NG", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"; }

type StockItem = { variantId: string; warehouseCode: string; onHand: number; reserved: number; available: number; lastMovementAt: string; sku: string; variantName: string; barcode: string; productName: string; productId: string };
type Movement = { id: string; variantId: string; kind: string; quantity: number; warehouseCode: string; referenceId?: string; referenceType?: string; reason?: string; createdBy?: string; createdAt: string };

const KIND_COLORS: Record<string, string> = {
  RECEIPT: "text-emerald-400", RETURN: "text-emerald-400", TRANSFER_IN: "text-emerald-400",
  SALE: "text-red-400", ADJUSTMENT: "text-amber-400", TRANSFER_OUT: "text-red-400",
  RESERVE: "text-blue-400", RELEASE: "text-blue-400",
};

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

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Movement detail
  const [selectedVariant, setSelectedVariant] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movPage, setMovPage] = useState(1);
  const [movPages, setMovPages] = useState(1);
  const [movTotal, setMovTotal] = useState(0);
  const [movLoading, setMovLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, s?: string, low?: boolean) => {
    setLoading(true);
    try {
      const res = await fetchInventoryLevels(pg, 20, s, low);
      setItems(res.data.items);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, search || undefined, lowStockOnly); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, lowStockOnly, load]);

  function goToPage(pg: number) { setPage(pg); load(pg, search || undefined, lowStockOnly); }

  async function openMovements(item: StockItem) {
    setSelectedVariant(item); setMovLoading(true); setMovPage(1);
    try {
      const res = await fetchMovements(item.variantId, 1, 20);
      setMovements(res.data.items);
      setMovPages(res.data.pages);
      setMovTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setMovLoading(false); }
  }

  async function goToMovPage(pg: number) {
    if (!selectedVariant) return;
    setMovPage(pg); setMovLoading(true);
    try {
      const res = await fetchMovements(selectedVariant.variantId, pg, 20);
      setMovements(res.data.items);
      setMovPages(res.data.pages);
    } catch (err) { console.error(err); }
    finally { setMovLoading(false); }
  }

  if (selectedVariant) {
    return (
      <div className="h-full flex flex-col">
        <button onClick={() => setSelectedVariant(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 text-sm"><span>←</span> Back to Inventory</button>

        {/* Stock Summary */}
        <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50 mb-4">
          <h2 className="text-white text-lg font-bold mb-1">{selectedVariant.productName}</h2>
          <p className="text-zinc-400 text-sm mb-3">{selectedVariant.variantName !== "Default" ? selectedVariant.variantName : ""} · {selectedVariant.sku}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded-lg p-3 text-center">
              <p className="text-zinc-500 text-xs">On Hand</p>
              <p className="text-white text-2xl font-bold">{selectedVariant.onHand}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3 text-center">
              <p className="text-zinc-500 text-xs">Reserved</p>
              <p className="text-amber-400 text-2xl font-bold">{selectedVariant.reserved}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3 text-center">
              <p className="text-zinc-500 text-xs">Available</p>
              <p className={`text-2xl font-bold ${selectedVariant.available <= 5 ? "text-red-400" : "text-emerald-400"}`}>{selectedVariant.available}</p>
            </div>
          </div>
        </div>

        {/* Movement History */}
        <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/50 flex-1 flex flex-col">
          <div className="px-5 py-3 border-b border-zinc-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold">Movement History</h3>
            <span className="text-zinc-500 text-xs">{movTotal} movement{movTotal !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-700/50">
            {movLoading ? (
              <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
            ) : movements.length === 0 ? (
              <div className="text-center py-16 text-zinc-500"><p>No movement history</p></div>
            ) : movements.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className={`font-bold text-sm ${KIND_COLORS[m.kind] || "text-white"}`}>{m.kind.replace(/_/g, " ")}</span>
                  {m.reason && <p className="text-zinc-500 text-xs mt-0.5">{m.reason}</p>}
                  {m.referenceType && <p className="text-zinc-600 text-xs">{m.referenceType} {m.referenceId ? `#${m.referenceId.slice(0, 8)}` : ""}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${["RECEIPT","RETURN","TRANSFER_IN","RELEASE"].includes(m.kind) ? "text-emerald-400" : "text-red-400"}`}>
                    {["RECEIPT","RETURN","TRANSFER_IN","RELEASE"].includes(m.kind) ? "+" : "-"}{m.quantity}
                  </p>
                  <p className="text-zinc-500 text-xs">{fmtDate(m.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={movPage} pages={movPages} onChange={goToMovPage} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-white font-bold text-xl mb-4">Inventory & Stock</h2>
      <div className="flex gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or SKU..." className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        <button onClick={() => setLowStockOnly(!lowStockOnly)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${lowStockOnly ? "bg-red-900/50 text-red-300 border border-red-700" : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"}`}>
          ⚠ Low Stock
        </button>
      </div>
      <p className="text-zinc-500 text-xs mb-2 px-1">{total} item{total !== 1 ? "s" : ""}</p>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-700/50">
        <div className="col-span-4">Product</div>
        <div className="col-span-2">SKU</div>
        <div className="col-span-2 text-center">On Hand</div>
        <div className="col-span-2 text-center">Reserved</div>
        <div className="col-span-2 text-center">Available</div>
      </div>

      <div className="flex-1 overflow-y-auto mb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-500"><div className="text-4xl mb-3">📊</div><p className="font-medium">No stock data</p></div>
        ) : items.map(i => (
          <button key={i.variantId} onClick={() => openMovements(i)} className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group text-left">
            <div className="col-span-4">
              <p className="text-white font-medium truncate">{i.productName}</p>
              {i.variantName !== "Default" && <p className="text-zinc-500 text-xs truncate">{i.variantName}</p>}
            </div>
            <div className="col-span-2 text-zinc-400 self-center text-xs font-mono">{i.sku}</div>
            <div className="col-span-2 text-center self-center text-white font-medium">{i.onHand}</div>
            <div className="col-span-2 text-center self-center text-amber-400 font-medium">{i.reserved}</div>
            <div className={`col-span-2 text-center self-center font-bold ${i.available <= 5 ? "text-red-400" : "text-emerald-400"}`}>{i.available}</div>
          </button>
        ))}
      </div>
      <Pagination page={page} pages={pages} onChange={goToPage} />
    </div>
  );
}
