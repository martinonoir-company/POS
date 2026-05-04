"use client";
import { useState } from "react";
import { getQuote } from "../lib/api";
import type { CartItem } from "../lib/types";

interface Props {
  items: CartItem[];
  couponCode: string;
  discountAmount: number;
  discountType: string;
  onApplyCoupon: (code: string, amount: number) => void;
  onApplyManualDiscount: (amount: number) => void;
  onClearDiscount: () => void;
}

export default function DiscountRow({
  items,
  couponCode,
  discountAmount,
  discountType,
  onApplyCoupon,
  onApplyManualDiscount,
  onClearDiscount,
}: Props) {
  const [couponInput, setCouponInput] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [couponMessage, setCouponMessage] = useState("");

  const hasDiscount = discountAmount > 0;
  const isCouponActive = hasDiscount && discountType === "COUPON";

  async function handleApplyCoupon() {
    if (!couponInput.trim() || items.length === 0) return;
    setCouponStatus("loading");
    try {
      const res = await getQuote(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice })),
        couponInput.trim()
      );
      if (res.data.coupon) {
        onApplyCoupon(couponInput.trim(), res.data.coupon.discountAmount);
        setCouponStatus("valid");
        setCouponMessage(
          `${res.data.coupon.discountType === "PERCENTAGE" ? `${res.data.coupon.discountAmount}%` : `₦${res.data.coupon.discountAmount.toLocaleString()}`} off`
        );
        setManualInput("");
      } else {
        setCouponStatus("invalid");
        setCouponMessage("Invalid or expired coupon");
      }
    } catch {
      setCouponStatus("invalid");
      setCouponMessage("Could not validate coupon");
    }
  }

  function handleRemoveDiscount() {
    setCouponInput("");
    setManualInput("");
    setCouponStatus("idle");
    setCouponMessage("");
    onClearDiscount();
  }

  function handleApplyManual() {
    const val = parseFloat(manualInput);
    if (isNaN(val) || val <= 0) return;
    onApplyManualDiscount(val);
    setCouponInput("");
    setCouponStatus("idle");
    setCouponMessage("");
  }

  return (
    <div className="border-t border-zinc-700 pt-3 space-y-2">
      {/* Active discount display */}
      {hasDiscount && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${isCouponActive ? "bg-emerald-900/30 border border-emerald-800/50" : "bg-amber-900/30 border border-amber-800/50"}`}>
          <div>
            <span className={isCouponActive ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
              {isCouponActive ? `🏷️ Coupon: ${couponCode}` : "💰 Manual Discount"}
            </span>
            <span className="text-white font-bold ml-2">−₦{discountAmount.toLocaleString()}</span>
          </div>
          <button onClick={handleRemoveDiscount} className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">✕ Remove</button>
        </div>
      )}

      {/* Coupon input — only show if no discount is active */}
      {!hasDiscount && (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
              placeholder="Coupon code"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={!couponInput.trim() || couponStatus === "loading"}
              className="px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 transition-colors disabled:opacity-40"
            >
              {couponStatus === "loading" ? "..." : "Apply"}
            </button>
          </div>
          {couponMessage && (
            <p className={`text-xs ${couponStatus === "valid" ? "text-emerald-400" : "text-red-400"}`}>
              {couponMessage}
            </p>
          )}

          {/* OR divider */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-zinc-600 text-xs">OR</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {/* Manual discount input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₦</span>
              <input
                type="number"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyManual()}
                placeholder="Manual discount"
                className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              onClick={handleApplyManual}
              disabled={!manualInput || parseFloat(manualInput) <= 0}
              className="px-3 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 transition-colors disabled:opacity-40"
            >
              Set
            </button>
          </div>
        </>
      )}
    </div>
  );
}
