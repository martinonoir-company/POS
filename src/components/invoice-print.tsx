"use client";
import type { CompletedSale } from "../lib/types";

interface Props {
  sale: CompletedSale;
  onClose: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS_TERMINAL: "POS Terminal",
  BANK_TRANSFER: "Bank Transfer",
};

export default function InvoicePrint({ sale, onClose }: Props) {
  function handlePrint() {
    window.print();
  }

  const invoiceNo = sale.orderNumber || `INV-${sale.transactionId.slice(0, 8).toUpperCase()}`;
  const change = sale.payments.reduce((s, p) => s + p.amount, 0) - sale.grandTotal;

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
      {/* Screen controls (hidden in print) */}
      <div className="print:hidden absolute top-4 right-4 flex gap-2">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400"
        >
          🖨️ Print
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
        >
          Close
        </button>
      </div>

      {/* Invoice — optimized for A4 print */}
      <div
        id="invoice-printable"
        className="bg-white text-black w-full max-w-[210mm] p-8 rounded-lg shadow-2xl print:shadow-none print:rounded-none print:max-w-none print:p-12"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">MARTINO NOIR</h1>
            <p className="text-sm text-gray-600 mt-1">Premium Fashion & Lifestyle</p>
            <p className="text-xs text-gray-500 mt-0.5">hello@martinonoir.com</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">INVOICE</p>
            <p className="text-sm text-gray-600">{invoiceNo}</p>
            <p className="text-sm text-gray-600">
              {new Date(sale.timestamp).toLocaleDateString("en-NG", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(sale.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Customer */}
        {sale.customerName && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Bill To</p>
            <p className="text-sm font-medium">{sale.customerName}</p>
            {sale.customerPhone && (
              <p className="text-sm text-gray-600">{sale.customerPhone}</p>
            )}
          </div>
        )}

        {/* Items Table */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left text-xs font-bold text-gray-500 uppercase py-2 w-8">#</th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase py-2">Item</th>
              <th className="text-center text-xs font-bold text-gray-500 uppercase py-2 w-16">Qty</th>
              <th className="text-right text-xs font-bold text-gray-500 uppercase py-2 w-28">Price</th>
              <th className="text-right text-xs font-bold text-gray-500 uppercase py-2 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => (
              <tr key={item.variantId} className="border-b border-gray-200">
                <td className="py-3 text-sm text-gray-500">{idx + 1}</td>
                <td className="py-3">
                  <p className="text-sm font-medium">{item.productName}</p>
                  {item.variantName !== "Default" && (
                    <p className="text-xs text-gray-500">{item.variantName}</p>
                  )}
                  <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                </td>
                <td className="py-3 text-center text-sm">{item.quantity}</td>
                <td className="py-3 text-right text-sm">₦{item.unitPrice.toLocaleString()}</td>
                <td className="py-3 text-right text-sm font-medium">
                  ₦{(item.unitPrice * item.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>₦{sale.subtotal.toLocaleString()}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount {sale.couponCode && `(${sale.couponCode})`}</span>
                <span>−₦{sale.discountTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2 mt-2">
              <span>Total</span>
              <span>₦{sale.grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="flex justify-end mb-8">
          <div className="w-64 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-500 uppercase">Payment</p>
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{METHOD_LABELS[p.method] || p.method}</span>
                <span>₦{p.amount.toLocaleString()}</span>
              </div>
            ))}
            {change > 0 && (
              <div className="flex justify-between text-sm text-green-700 font-medium">
                <span>Change</span>
                <span>₦{change.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-gray-300 pt-4">
          <p className="text-xs text-gray-500">Thank you for your purchase!</p>
          <p className="text-xs text-gray-400 mt-1">
            Terminal: {sale.terminalId} | TX: {sale.transactionId.slice(0, 12)}
          </p>
        </div>
      </div>
    </div>
  );
}
