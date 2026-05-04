"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { configureApi } from "../lib/api";
import { useCart } from "../lib/use-cart";
import { useSales } from "../lib/use-sales";
import { useOnline } from "../lib/use-online";
import {
  queueTransaction,
  getPendingCount,
  startSyncHeartbeat,
  getTerminalId,
} from "../lib/sync";
import { syncTransactions } from "../lib/api";
import type { PaymentSplit, CompletedSale, PosTransaction } from "../lib/types";

import LoginForm from "../components/login-form";
import Header from "../components/header";
import type { TabId } from "../components/header";
import ProductGrid from "../components/product-grid";
import CartPanel from "../components/cart-panel";
import DiscountRow from "../components/discount-row";
import TenderModal from "../components/tender-modal";
import ReceiptView from "../components/receipt-view";
import InvoicePrint from "../components/invoice-print";
import SalesHistory from "../components/sales-history";
import EodReport from "../components/eod-report";
import ReportsPage from "../components/reports-page";
import DiscountsPage from "../components/discounts-page";
import PaymentsPage from "../components/payments-page";
import CustomersPage from "../components/customers-page";
import ProductsPage from "../components/products-page";
import InventoryPage from "../components/inventory-page";

export default function POSPage() {
  const auth = useAuth();
  const cart = useCart();
  const sales = useSales();
  const online = useOnline();

  const [activeTab, setActiveTab] = useState<TabId>("pos");
  const [showTender, setShowTender] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Configure API with auth tokens
  useEffect(() => {
    if (auth.isAuthenticated) {
      configureApi(auth.getToken, auth.refresh, auth.logout);
    }
  }, [auth.isAuthenticated, auth.getToken, auth.refresh, auth.logout]);

  // Sync heartbeat
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const cleanup = startSyncHeartbeat((result) => {
      // Mark synced sales in local history
      for (const s of result.successful) {
        sales.markSynced(s.transactionId, s.orderNumber, s.orderId);
      }
      updatePendingCount();
    }, 30000);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  // Update pending count periodically
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    updatePendingCount();
    const timer = setInterval(updatePendingCount, 5000);
    return () => clearInterval(timer);
  }, [auth.isAuthenticated, updatePendingCount]);

  // ── Checkout Flow ──

  function handleCheckout() {
    if (cart.items.length === 0) return;
    setShowTender(true);
  }

  async function handlePaymentConfirm(payments: PaymentSplit[]) {
    const txId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const transaction: PosTransaction = {
      transactionId: txId,
      terminalId: getTerminalId(),
      staffId: auth.user?.id,
      staffName: auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : undefined,
      items: cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      payments,
      currency: "NGN",
      timestamp,
      couponCode: cart.couponCode || undefined,
      discountAmount: cart.discountAmount || undefined,
      discountType: cart.discountType || undefined,
      discountAppliedAt: cart.discountAppliedAt || undefined,
      customerName: cart.customerName || undefined,
      customerPhone: cart.customerPhone || undefined,
    };

    const sale: CompletedSale = {
      transactionId: txId,
      items: [...cart.items],
      subtotal: cart.subtotal,
      discountTotal: cart.discountAmount,
      grandTotal: cart.grandTotal,
      payments,
      couponCode: cart.couponCode || undefined,
      customerName: cart.customerName || undefined,
      customerPhone: cart.customerPhone || undefined,
      timestamp,
      synced: false,
      terminalId: getTerminalId(),
    };

    if (online) {
      // Try immediate sync
      try {
        const res = await syncTransactions(getTerminalId(), [transaction]);
        const result = res.data;
        if (result.successful.length > 0) {
          sale.synced = true;
          sale.orderNumber = result.successful[0].orderNumber;
          sale.orderId = result.successful[0].orderId;
        } else {
          // Failed — queue for retry
          await queueTransaction(transaction);
        }
      } catch {
        // Network error — queue
        await queueTransaction(transaction);
      }
    } else {
      // Offline — queue
      await queueTransaction(transaction);
    }

    sales.addSale(sale);
    setCompletedSale(sale);
    setShowTender(false);
    cart.clearCart();
    updatePendingCount();
  }

  function handleNewSale() {
    setCompletedSale(null);
    setShowInvoice(false);
  }

  function handlePrintInvoice() {
    setShowInvoice(true);
  }

  // ── Auth Gate ──

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginForm onLogin={auth.login} />;
  }

  // ── Main POS Interface ──

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header
        user={auth.user!}
        pendingCount={pendingCount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={auth.logout}
      />

      <main className="flex-1 overflow-hidden">
        {activeTab === "pos" && (
          <div className="flex h-[calc(100vh-56px)]">
            {/* Left: Product Grid */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <ProductGrid onAddToCart={cart.addItem} />
            </div>

            {/* Right: Cart Panel */}
            <div className="w-96 border-l border-zinc-800 p-4 flex flex-col bg-zinc-900/50">
              {/* Customer info */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={cart.customerName}
                  onChange={(e) => cart.setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <input
                  type="tel"
                  value={cart.customerPhone}
                  onChange={(e) => cart.setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-28 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Cart items + totals */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <CartPanel
                  items={cart.items}
                  subtotal={cart.subtotal}
                  discountAmount={cart.discountAmount}
                  grandTotal={cart.grandTotal}
                  onUpdateQuantity={cart.updateQuantity}
                  onRemoveItem={cart.removeItem}
                  onClearCart={cart.clearCart}
                  onCheckout={handleCheckout}
                  itemCount={cart.itemCount}
                />
              </div>

              {/* Discount row */}
              {cart.items.length > 0 && (
                <DiscountRow
                  items={cart.items}
                  couponCode={cart.couponCode}
                  discountAmount={cart.discountAmount}
                  discountType={cart.discountType}
                  onApplyCoupon={cart.applyCoupon}
                  onApplyManualDiscount={cart.applyManualDiscount}
                  onClearDiscount={cart.clearDiscount}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "sales" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <SalesHistory />
          </div>
        )}

        {activeTab === "reports" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <ReportsPage />
          </div>
        )}

        {activeTab === "discounts" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <DiscountsPage />
          </div>
        )}

        {activeTab === "payments" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <PaymentsPage />
          </div>
        )}

        {activeTab === "customers" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <CustomersPage />
          </div>
        )}

        {activeTab === "products" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <ProductsPage />
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-56px)] overflow-hidden flex flex-col">
            <InventoryPage />
          </div>
        )}

        {activeTab === "eod" && (
          <div className="p-6 max-w-4xl mx-auto">
            <EodReport
              todaySalesCount={sales.todaySales.length}
              todayRevenue={sales.todayRevenue}
              todayDiscounts={sales.todayDiscounts}
              todayItemCount={sales.todayItemCount}
              paymentBreakdown={sales.paymentBreakdown}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {showTender && (
        <TenderModal
          grandTotal={cart.grandTotal}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowTender(false)}
        />
      )}

      {completedSale && !showInvoice && (
        <ReceiptView
          sale={completedSale}
          onNewSale={handleNewSale}
          onPrintInvoice={handlePrintInvoice}
        />
      )}

      {completedSale && showInvoice && (
        <InvoicePrint
          sale={completedSale}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  );
}
