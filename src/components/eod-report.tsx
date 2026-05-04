"use client";

interface Props {
  todaySalesCount: number;
  todayRevenue: number;
  todayDiscounts: number;
  todayItemCount: number;
  paymentBreakdown: Record<string, number>;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "💵 Cash",
  POS_TERMINAL: "💳 POS Terminal",
  BANK_TRANSFER: "🏦 Bank Transfer",
};

export default function EodReport({
  todaySalesCount,
  todayRevenue,
  todayDiscounts,
  todayItemCount,
  paymentBreakdown,
}: Props) {
  const netRevenue = todayRevenue - todayDiscounts;
  const avgTransaction = todaySalesCount > 0 ? netRevenue / todaySalesCount : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">End-of-Day Report</h2>
        <p className="text-zinc-500 text-sm">
          {new Date().toLocaleDateString("en-NG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Transactions</p>
          <p className="text-3xl font-bold text-white mt-1">{todaySalesCount}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Gross Revenue</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">
            ₦{todayRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Discounts Given</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">
            ₦{todayDiscounts.toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Net Revenue</p>
          <p className="text-3xl font-bold text-white mt-1">
            ₦{netRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Items Sold</p>
          <p className="text-2xl font-bold text-white mt-1">{todayItemCount}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-medium">Avg Transaction</p>
          <p className="text-2xl font-bold text-white mt-1">
            ₦{Math.round(avgTransaction).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wide">
          Payment Breakdown
        </h3>
        {Object.keys(paymentBreakdown).length === 0 ? (
          <p className="text-zinc-500 text-sm">No sales today</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(paymentBreakdown).map(([method, amount]) => {
              const pct = netRevenue > 0 ? (amount / netRevenue) * 100 : 0;
              return (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">
                      {METHOD_LABELS[method] || method}
                    </span>
                    <span className="text-white font-bold">
                      ₦{amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print button */}
      <div className="text-center">
        <button
          onClick={() => window.print()}
          className="px-8 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-colors"
        >
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}
