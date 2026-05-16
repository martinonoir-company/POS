"use client";
import type { CompletedSale } from "../lib/types";
import { formatNaira } from "../lib/money";

interface Props {
  sale: CompletedSale;
  onNewSale: () => void;
  onPrintInvoice: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS_TERMINAL: "POS Terminal",
  BANK_TRANSFER: "Bank Transfer",
};

export default function ReceiptView({ sale, onNewSale, onPrintInvoice }: Props) {
  const change = sale.payments.reduce((s, p) => s + p.amount, 0) - sale.grandTotal;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Success header */}
        <div className="bg-emerald-900/30 border-b border-emerald-800/50 p-6 text-center">
          <div className="text-5xl mb-2">✓</div>
          <h2 className="text-2xl font-bold text-emerald-400">Sale Complete</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {sale.synced ? `Order: ${sale.orderNumber}` : "Queued for sync"}
          </p>
        </div>

        {/* Receipt */}
        <div className="p-6 space-y-4" id="receipt-content">
          {/* Business Info */}
          <div className="text-center border-b border-zinc-800 pb-3">
            <p className="text-white font-bold text-lg">MARTINO NOIR</p>
            <p className="text-zinc-500 text-xs">Point of Sale Receipt</p>
            <p className="text-zinc-500 text-xs">
              {new Date(sale.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {sale.items.map((item) => (
              <div key={item.variantId} className="flex justify-between text-sm">
                <div className="flex-1 min-w-0 mr-2">
                  <span className="text-white">{item.productName}</span>
                  {item.variantName !== "Default" && (
                    <span className="text-zinc-500 ml-1">({item.variantName})</span>
                  )}
                  <span className="text-zinc-500 ml-2">×{item.quantity}</span>
                </div>
                <span className="text-zinc-300 whitespace-nowrap">
                  {formatNaira(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-zinc-800 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-white">{formatNaira(sale.subtotal)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400">
                  Discount {sale.couponCode && `(${sale.couponCode})`}
                </span>
                <span className="text-emerald-400">−{formatNaira(sale.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1">
              <span className="text-white">Total</span>
              <span className="text-amber-400">{formatNaira(sale.grandTotal)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="border-t border-zinc-800 pt-3 space-y-1">
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-zinc-400">{METHOD_LABELS[p.method] || p.method}</span>
                <span className="text-white">{formatNaira(p.amount)}</span>
              </div>
            ))}
            {change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400 font-medium">Change</span>
                <span className="text-emerald-400 font-bold">{formatNaira(change)}</span>
              </div>
            )}
          </div>

          {/* Customer */}
          {sale.customerName && (
            <div className="border-t border-zinc-800 pt-3 text-sm text-zinc-400">
              Customer: {sale.customerName}
              {sale.customerPhone && ` (${sale.customerPhone})`}
            </div>
          )}

          {/* Transaction ID */}
          <div className="text-center text-zinc-600 text-xs pt-2">
            TX: {sale.transactionId.slice(0, 8)}...{sale.transactionId.slice(-4)}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onPrintInvoice}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors text-sm"
          >
            🖨️ Print Invoice
          </button>
          <button
            onClick={onNewSale}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors text-sm"
          >
            New Sale →
          </button>
        </div>
      </div>
    </div>
  );
}
