"use client";
import type { CartItem } from "../lib/types";

interface Props {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  onUpdateQuantity: (variantId: string, qty: number) => void;
  onRemoveItem: (variantId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  itemCount: number;
}

export default function CartPanel({
  items,
  subtotal,
  discountAmount,
  grandTotal,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  itemCount,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 px-4">
        <div className="text-5xl mb-4">🛒</div>
        <p className="text-lg font-medium">Cart is empty</p>
        <p className="text-sm mt-1">Scan a barcode or select a product</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-white font-bold text-lg">
          Current Sale{" "}
          <span className="text-zinc-500 text-sm font-normal">({itemCount} items)</span>
        </h2>
        <button
          onClick={onClearCart}
          className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-900/30"
        >
          Clear All
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {items.map((item) => (
          <div
            key={item.variantId}
            className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-white text-sm font-medium truncate">
                  {item.productName}
                </p>
                {item.variantName !== "Default" && (
                  <p className="text-zinc-400 text-xs truncate">{item.variantName}</p>
                )}
                <p className="text-zinc-500 text-xs">{item.sku}</p>
              </div>
              <button
                onClick={() => onRemoveItem(item.variantId)}
                className="text-zinc-600 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex items-center justify-between">
              {/* Quantity controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
                  className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-lg font-bold transition-colors"
                >
                  −
                </button>
                <span className="w-10 text-center text-white font-bold text-sm">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
                  disabled={item.maxStock >= 0 && item.quantity >= item.maxStock}
                  className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
                {item.maxStock >= 0 && (
                  <span className={`text-xs ml-1 ${item.quantity >= item.maxStock ? "text-red-400" : "text-zinc-500"}`}>
                    {item.quantity >= item.maxStock ? "max" : `/${item.maxStock}`}
                  </span>
                )}
              </div>
              {/* Line total */}
              <p className="text-amber-400 font-bold text-sm">
                ₦{(item.unitPrice * item.quantity).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-zinc-700 pt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Subtotal</span>
          <span className="text-white font-medium">₦{subtotal.toLocaleString()}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">Discount</span>
            <span className="text-emerald-400 font-medium">
              −₦{discountAmount.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold pt-1">
          <span className="text-white">Total</span>
          <span className="text-amber-400">₦{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <button
        onClick={onCheckout}
        className="mt-4 w-full py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-lg rounded-xl transition-all duration-150 active:scale-[0.98]"
      >
        Charge ₦{grandTotal.toLocaleString()}
      </button>
    </div>
  );
}
