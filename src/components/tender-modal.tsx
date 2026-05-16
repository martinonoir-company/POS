"use client";
import { useState, useCallback } from "react";
import type { PaymentSplit } from "../lib/types";

interface Props {
  grandTotal: number;
  onConfirm: (payments: PaymentSplit[]) => void;
  onCancel: () => void;
  /** True while the sale is being submitted — disables Complete Sale. */
  confirming?: boolean;
}

type Method = "CASH" | "POS_TERMINAL" | "BANK_TRANSFER";

const METHOD_LABELS: Record<Method, string> = {
  CASH: "💵 Cash",
  POS_TERMINAL: "💳 POS Terminal",
  BANK_TRANSFER: "🏦 Bank Transfer",
};

export default function TenderModal({ grandTotal, onConfirm, onCancel, confirming = false }: Props) {
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [activeMethod, setActiveMethod] = useState<Method | null>(null);
  const [amountInput, setAmountInput] = useState("");

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, grandTotal - totalPaid);
  const overpaid = totalPaid > grandTotal ? totalPaid - grandTotal : 0;
  const canConfirm = totalPaid >= grandTotal;

  const addPayment = useCallback(() => {
    if (!activeMethod) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;

    setPayments((prev) => {
      const existing = prev.find((p) => p.method === activeMethod);
      if (existing) {
        return prev.map((p) =>
          p.method === activeMethod ? { ...p, amount: p.amount + amount } : p
        );
      }
      return [...prev, { method: activeMethod, amount }];
    });
    setAmountInput("");
    setActiveMethod(null);
  }, [activeMethod, amountInput]);

  function payFull(method: Method) {
    // Quick-pay the entire remaining amount with this method
    if (remaining <= 0) return;
    setPayments((prev) => {
      const existing = prev.find((p) => p.method === method);
      if (existing) {
        return prev.map((p) =>
          p.method === method ? { ...p, amount: p.amount + remaining } : p
        );
      }
      return [...prev, { method, amount: remaining }];
    });
  }

  function removePayment(method: Method) {
    setPayments((prev) => prev.filter((p) => p.method !== method));
  }

  function resetPayments() {
    setPayments([]);
    setActiveMethod(null);
    setAmountInput("");
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Payment</h2>
            <button
              onClick={onCancel}
              className="text-zinc-500 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <div className="text-3xl font-bold text-amber-400">
            ₦{grandTotal.toLocaleString()}
          </div>
        </div>

        {/* Payment Methods — Quick Pay */}
        <div className="p-6 space-y-4">
          {remaining > 0 && (
            <>
              <p className="text-zinc-400 text-sm">
                {payments.length === 0 ? "Select payment method" : `Remaining: ₦${remaining.toLocaleString()}`}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(METHOD_LABELS) as Method[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => payFull(method)}
                    className="py-4 px-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-amber-500 text-white text-sm font-medium transition-all active:scale-95"
                  >
                    <div className="text-2xl mb-1">{METHOD_LABELS[method].split(" ")[0]}</div>
                    <div>{METHOD_LABELS[method].split(" ").slice(1).join(" ")}</div>
                  </button>
                ))}
              </div>

              {/* Split payment: custom amount */}
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-zinc-500 text-xs mb-2">Or enter a split amount:</p>
                <div className="flex gap-2">
                  <select
                    value={activeMethod || ""}
                    onChange={(e) => setActiveMethod(e.target.value as Method)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Method</option>
                    {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
                      <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                    ))}
                  </select>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₦</span>
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPayment()}
                      placeholder={remaining.toString()}
                      className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    onClick={addPayment}
                    disabled={!activeMethod || !amountInput}
                    className="px-4 py-2 bg-amber-600 text-black font-bold rounded-lg text-sm hover:bg-amber-500 disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Payments summary */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-zinc-400 text-sm font-medium">Payments received:</p>
                <button
                  onClick={resetPayments}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Reset
                </button>
              </div>
              {payments.map((p) => (
                <div
                  key={p.method}
                  className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2"
                >
                  <span className="text-white text-sm">{METHOD_LABELS[p.method]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">
                      ₦{p.amount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => removePayment(p.method)}
                      className="text-zinc-600 hover:text-red-400 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {overpaid > 0 && (
                <div className="flex justify-between text-sm bg-emerald-900/30 rounded-lg px-4 py-2 border border-emerald-800/50">
                  <span className="text-emerald-400">Change</span>
                  <span className="text-emerald-300 font-bold">
                    ₦{overpaid.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirm Button */}
        <div className="p-6 pt-0">
          <button
            onClick={() => {
              // Guard against a double-click landing before `confirming`
              // propagates back as a prop on the next render.
              if (confirming || !canConfirm) return;
              onConfirm(payments);
            }}
            disabled={!canConfirm || confirming}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {confirming
              ? "Processing…"
              : canConfirm
                ? "✓ Complete Sale"
                : `₦${remaining.toLocaleString()} remaining`}
          </button>
        </div>
      </div>
    </div>
  );
}
