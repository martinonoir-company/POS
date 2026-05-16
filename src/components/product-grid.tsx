"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { Product, ProductVariant, StockLevel, CartItem } from "../lib/types";
import { fetchProducts, fetchAllStock } from "../lib/api";
import { formatNaira } from "../lib/money";

interface Props {
  onAddToCart: (item: CartItem) => void;
}

const PAGE_SIZE = 8;

export default function ProductGrid({ onAddToCart }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, StockLevel>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const scanRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load products from server (with search + pagination)
  const loadProducts = useCallback(async (pg: number, query: string) => {
    setLoading(true);
    try {
      const res = await fetchProducts({
        page: pg,
        limit: PAGE_SIZE,
        search: query || undefined,
        sortBy: "name",
        sortOrder: "ASC",
      });
      setProducts(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stock levels (one-time, all variants)
  const loadStock = useCallback(async () => {
    try {
      const stockRes = await fetchAllStock(1, 1000);
      const map: Record<string, StockLevel> = {};
      for (const sl of stockRes.data.items) {
        map[sl.variantId] = sl;
      }
      setStockMap(map);
    } catch (err) {
      console.error("Failed to load stock:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadProducts(1, "");
    loadStock();
    scanRef.current?.focus();
  }, [loadProducts, loadStock]);

  // Debounced search — fires server request 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadProducts(1, search);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, loadProducts]);

  // Handle barcode scan (Enter key — exact match by barcode/SKU)
  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const q = search.trim().toLowerCase();
      if (!q) return;
      // Try exact barcode/SKU match in currently loaded products
      for (const p of products) {
        for (const v of p.variants) {
          if (v.barcode?.toLowerCase() === q || v.sku.toLowerCase() === q) {
            addVariant(p, v);
            setSearch("");
            return;
          }
        }
      }
      // If not found locally, let the debounced server search handle it
    }
  }

  function goToPage(pg: number) {
    if (pg < 1 || pg > totalPages) return;
    setPage(pg);
    loadProducts(pg, search);
  }

  function addVariant(product: Product, variant: ProductVariant) {
    const img = product.media?.[0]?.url || null;
    const stock = getStock(variant.id);
    onAddToCart({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      unitPrice: Number(variant.wholesalePriceNgn),
      quantity: 1,
      imageUrl: img,
      options: variant.options || {},
      maxStock: variant.trackInventory ? stock : -1,
    });
  }

  function getStock(variantId: string): number {
    const sl = stockMap[variantId];
    return sl ? sl.onHand - sl.reserved : 0;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search / Scan Bar */}
      <div className="mb-3 relative">
        <input
          ref={scanRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleScanKeyDown}
          placeholder="Scan barcode or search by name / SKU..."
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => { setSearch(""); scanRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xl"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-zinc-500 text-xs">
          {total} product{total !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </p>
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400" />
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-2">
        {products.map((product) =>
          product.variants
            .filter((v) => v.isActive)
            .map((variant) => {
              const stock = getStock(variant.id);
              const img = product.media?.[0]?.url;
              const price = Number(variant.wholesalePriceNgn);
              return (
                <button
                  key={variant.id}
                  onClick={() => addVariant(product, variant)}
                  disabled={variant.trackInventory && stock <= 0}
                  className={`rounded-xl text-left transition-all duration-150 border group flex flex-col ${
                    variant.trackInventory && stock <= 0
                      ? "opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-900"
                      : "border-zinc-700 bg-zinc-800/80 hover:border-amber-500 hover:bg-zinc-800 active:scale-[0.97]"
                  }`}
                >
                  {/* Image */}
                  <div className="h-28 bg-zinc-900 relative overflow-hidden rounded-t-xl flex-shrink-0 w-full">
                    {img ? (
                      <Image src={img} alt={product.name} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-700 text-3xl">
                        📦
                      </div>
                    )}
                    {/* Stock badge */}
                    {variant.trackInventory && (
                      <span
                        className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                          stock <= 0
                            ? "bg-red-900 text-red-300"
                            : stock <= 5
                            ? "bg-amber-900 text-amber-300"
                            : "bg-emerald-900 text-emerald-300"
                        }`}
                      >
                        {stock <= 0 ? "Out" : stock}
                      </span>
                    )}
                  </div>
                  {/* Info — always visible */}
                  <div className="p-2.5 w-full">
                    <p className="text-white font-semibold text-sm leading-snug truncate">
                      {product.name}
                    </p>
                    {variant.name !== "Default" && (
                      <p className="text-zinc-400 text-xs truncate mt-0.5">{variant.name}</p>
                    )}
                    <p className="text-amber-400 font-bold text-sm mt-1">
                      {formatNaira(price)}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">{variant.sku}</p>
                  </div>
                </button>
              );
            })
        )}
        {!loading && products.length === 0 && (
          <div className="col-span-full text-center py-16 text-zinc-500">
            {search ? `No products match "${search}"` : "No products available"}
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
