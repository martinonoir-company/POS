"use client";
import { useState, useCallback } from "react";
import type { CartItem } from "./types";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"COUPON" | "MANUAL" | "">("");
  const [discountAppliedAt, setDiscountAppliedAt] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) => {
          if (i.variantId !== item.variantId) return i;
          const newQty = i.quantity + 1;
          // Enforce stock limit (-1 means unlimited / no tracking)
          if (i.maxStock >= 0 && newQty > i.maxStock) return i;
          return { ...i, quantity: newQty };
        });
      }
      // Don't add if out of stock
      if (item.maxStock === 0) return prev;
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.variantId !== variantId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.variantId !== variantId) return i;
        // Enforce stock limit (-1 means unlimited / no tracking)
        const clamped = i.maxStock >= 0 ? Math.min(qty, i.maxStock) : qty;
        return { ...i, quantity: clamped };
      })
    );
  }, []);

  /** Apply a validated coupon — clears any manual discount */
  const applyCoupon = useCallback((code: string, amount: number) => {
    setCouponCode(code);
    setDiscountAmount(amount);
    setDiscountType("COUPON");
    setDiscountAppliedAt(new Date().toISOString());
  }, []);

  /** Apply a manual discount — clears any coupon */
  const applyManualDiscount = useCallback((amount: number) => {
    setCouponCode("");
    setDiscountAmount(amount);
    setDiscountType("MANUAL");
    setDiscountAppliedAt(new Date().toISOString());
  }, []);

  /** Clear all discount/coupon */
  const clearDiscount = useCallback(() => {
    setCouponCode("");
    setDiscountAmount(0);
    setDiscountType("");
    setDiscountAppliedAt("");
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode("");
    setDiscountAmount(0);
    setDiscountType("");
    setDiscountAppliedAt("");
    setCustomerName("");
    setCustomerPhone("");
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items,
    subtotal,
    grandTotal,
    discountAmount,
    discountType,
    discountAppliedAt,
    couponCode,
    customerName,
    customerPhone,
    itemCount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    setCouponCode,
    setDiscountAmount,
    applyCoupon,
    applyManualDiscount,
    clearDiscount,
    setCustomerName,
    setCustomerPhone,
  };
}
