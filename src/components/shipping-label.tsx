"use client";
import type { OrderSummary } from "../lib/api";
import OrderBarcode from "./order-barcode";

/**
 * Printable shipping label for a dispatch order — mirrors the invoice-print
 * pattern (full-screen overlay, Print/Close controls hidden in print, an
 * A6-ish printable card).
 *
 * Per spec:
 *   - Sender   = the customer / account name (who placed the order).
 *   - Receiver = the name on the shipping information (delivery recipient,
 *     which can differ when buying for someone else).
 *   - Destination = the shipping address.
 *   - Items list + order barcode for scanning at handoff.
 */
export default function ShippingLabel({
  order,
  onClose,
}: {
  order: OrderSummary;
  onClose: () => void;
}) {
  const addr = order.shippingAddress ?? {};
  const senderName = order.user
    ? `${order.user.firstName} ${order.user.lastName}`.trim()
    : (addr.firstName || addr.lastName
        ? `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim()
        : "Customer");
  const receiverName =
    `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim() || senderName;
  const totalUnits = order.items.reduce((s, i) => s + (i.quantity ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
      {/* Controls (hidden in print) */}
      <div className="print:hidden absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400"
        >
          🖨️ Print label
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
        >
          Close
        </button>
      </div>

      <div
        id="shipping-label-printable"
        className="bg-white text-black w-full max-w-[148mm] p-6 rounded-lg shadow-2xl print:shadow-none print:rounded-none print:max-w-none print:p-8 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">MARTINO NOIR</h1>
            <p className="text-[11px] text-gray-600">Shipping label</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold">ORDER</p>
            <p className="text-sm font-mono">{order.orderNumber}</p>
            <p className="text-[11px] text-gray-500">
              {new Date(order.createdAt).toLocaleDateString("en-NG", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Sender / Receiver */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-gray-300 rounded p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
              From (Sender)
            </p>
            <p className="text-sm font-semibold">{senderName}</p>
            {order.user?.email ? (
              <p className="text-[11px] text-gray-600">{order.user.email}</p>
            ) : null}
            <p className="text-[11px] text-gray-600 mt-1">
              Dispatched by Martino Noir
            </p>
          </div>
          <div className="border-2 border-black rounded p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
              To (Receiver)
            </p>
            <p className="text-sm font-semibold">{receiverName}</p>
            <p className="text-[11px] text-gray-700 leading-snug mt-0.5">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
            </p>
            <p className="text-[11px] text-gray-700">
              {addr.city}
              {addr.state ? `, ${addr.state}` : ""}
              {addr.postalCode ? ` ${addr.postalCode}` : ""}
            </p>
            {addr.country ? (
              <p className="text-[11px] text-gray-700">{addr.country}</p>
            ) : null}
            {addr.phone ? (
              <p className="text-[11px] text-gray-700 mt-1 font-medium">
                ☎ {addr.phone}
              </p>
            ) : null}
          </div>
        </div>

        {/* Items */}
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
            Contents ({totalUnits} item{totalUnits !== 1 ? "s" : ""})
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase py-1">
                  Item
                </th>
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase py-1 w-28">
                  SKU
                </th>
                <th className="text-center text-[10px] font-bold text-gray-500 uppercase py-1 w-12">
                  Qty
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-gray-100">
                  <td className="py-1.5 text-xs">
                    {it.productName}
                    {it.variantName && it.variantName !== "Default"
                      ? ` — ${it.variantName}`
                      : ""}
                  </td>
                  <td className="py-1.5 text-[11px] font-mono text-gray-600">
                    {it.sku}
                  </td>
                  <td className="py-1.5 text-center text-xs">{it.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Barcode */}
        <div className="flex flex-col items-center border-t border-gray-300 pt-3">
          <OrderBarcode value={order.orderNumber} width={300} />
          <p className="text-[10px] text-gray-500 mt-1">
            Scan at handoff to mark this order dispatched.
          </p>
        </div>
      </div>
    </div>
  );
}
