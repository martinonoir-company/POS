"use client";
import { useState, useCallback, useEffect } from "react";
import type { CompletedSale } from "./types";

const STORAGE_KEY = "mn_pos_sales";

function loadSales(): CompletedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSales(sales: CompletedSale[]) {
  // Keep only last 500 sales in localStorage
  const trimmed = sales.slice(0, 500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function useSales() {
  const [sales, setSales] = useState<CompletedSale[]>([]);

  useEffect(() => {
    setSales(loadSales());
  }, []);

  const addSale = useCallback((sale: CompletedSale) => {
    setSales((prev) => {
      const updated = [sale, ...prev];
      saveSales(updated);
      return updated;
    });
  }, []);

  const markSynced = useCallback((transactionId: string, orderNumber: string, orderId: string) => {
    setSales((prev) => {
      const updated = prev.map((s) =>
        s.transactionId === transactionId
          ? { ...s, synced: true, orderNumber, orderId }
          : s
      );
      saveSales(updated);
      return updated;
    });
  }, []);

  // Today's sales
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySales = sales.filter((s) => new Date(s.timestamp) >= todayStart);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
  const todayDiscounts = todaySales.reduce((sum, s) => sum + s.discountTotal, 0);
  const todayItemCount = todaySales.reduce(
    (sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0),
    0
  );

  // Payment breakdown
  const paymentBreakdown = todaySales.reduce(
    (acc, s) => {
      for (const p of s.payments) {
        acc[p.method] = (acc[p.method] || 0) + p.amount;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    sales,
    todaySales,
    todayRevenue,
    todayDiscounts,
    todayItemCount,
    paymentBreakdown,
    addSale,
    markSynced,
  };
}
