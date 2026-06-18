"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { configureApi } from "../lib/api";
import { useCart } from "../lib/use-cart";
import { useSales } from "../lib/use-sales";
import { useOnline } from "../lib/use-online";
import { usePosSession } from "../lib/use-pos-session";
import {
  queueTransaction,
  getPendingCount,
  startSyncHeartbeat,
  getTerminalId,
} from "../lib/sync";
import {
  syncTransactions,
  posTerminalPayment,
  reconcilePayment,
  validateAgentCode,
} from "../lib/api";
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
import ScannerBasketPanel from "../components/scanner-basket-panel";

export default function POSPage() {
  const auth = useAuth();
  const cart = useCart();
  const sales = useSales();
  const online = useOnline();
  // Live scanner-built basket on this terminal (PR #13). Enabled once
  // authenticated; inert when there's no open session.
  const posSession = usePosSession(
    getTerminalId(),
    auth.getToken,
    auth.isAuthenticated,
  );

  const [activeTab, setActiveTab] = useState<TabId>("pos");
  const [showTender, setShowTender] = useState(false);
  /** "local" = walk-up cart rung at the till; "session" = scanner basket. */
  const [tenderSource, setTenderSource] = useState<"local" | "session">("local");
  // True while a sale is being submitted — drives the tender modal's
  // disabled "Processing…" state. The ref is a synchronous guard: state
  // updates are async, so a fast double-click could slip past `confirming`
  // before React re-renders; the ref blocks the second call immediately.
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  // Live status of a card payment on the Moniepoint terminal, surfaced in
  // the tender modal. null = no card payment in progress.
  const [terminalStatus, setTerminalStatus] = useState<
    | null
    | { phase: "waiting"; message: string }
    | { phase: "failed"; message: string }
  >(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  /** Order number from the last completed scanner session, for a toast. */
  const [sessionSaleNote, setSessionSaleNote] = useState<string | null>(null);

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

  /** Walk-up sale rung directly at the till (local cart). */
  function handleCheckout() {
    if (cart.items.length === 0) return;
    setTenderSource("local");
    setShowTender(true);
  }

  /** Complete a scanner-built basket (the floor staff handed it over). */
  function handleCompleteSessionSale() {
    if (
      !posSession.session ||
      posSession.session.status !== "AWAITING_PAYMENT" ||
      posSession.session.cart.items.length === 0
    ) {
      return;
    }
    setTenderSource("session");
    setShowTender(true);
  }

  /** Cancel a scanner-built basket. */
  async function handleVoidSession() {
    if (!posSession.session) return;
    const ok = window.confirm(
      "Cancel this scanner basket? The floor staff will need to re-scan if it was a mistake.",
    );
    if (!ok) return;
    await posSession.voidSession("Voided at the till");
  }

  /** Dismiss the scanner-basket panel after it completed / was voided. */
  function handleDismissSessionPanel() {
    // The hook re-fetches on the next WS event / reconnect; clearing the
    // local note + relying on a subsequent /pos-sessions GET (which 404s
    // once the session is closed) lets the panel disappear. We trigger a
    // refetch so a brand-new session opened by the scanner shows up.
    setSessionSaleNote(null);
    void posSession.refetch();
  }

  /**
   * Drive a card payment on the Moniepoint terminal for an order.
   *
   * Pushes the card-leg amount to the physical device, then polls the
   * server (which polls Moniepoint) until the transaction settles.
   * Resolves true only on a confirmed SUCCEEDED card payment; false on a
   * failed/cancelled/timed-out attempt — in which case the order stays
   * PENDING_PAYMENT and the cashier can retry.
   *
   * The POS never talks to Moniepoint directly — every call is to our
   * server.
   */
  async function runTerminalPayment(
    orderId: string,
    cardAmountMinor: number,
  ): Promise<boolean> {
    setTerminalStatus({
      phase: "waiting",
      message: "Sending payment to the card terminal…",
    });
    let merchantReference: string;
    try {
      const pushed = await posTerminalPayment({
        orderId,
        amount: cardAmountMinor,
        terminalCode: getTerminalId(),
      });
      merchantReference = pushed.data.merchantReference;
    } catch (err) {
      setTerminalStatus({
        phase: "failed",
        message:
          err instanceof Error
            ? err.message
            : "Could not start the card payment.",
      });
      return false;
    }

    setTerminalStatus({
      phase: "waiting",
      message: "Waiting for the customer to complete payment on the terminal…",
    });

    // Poll the server for the authoritative outcome. ~2 minutes total
    // (40 × 3s) — long enough for a customer to tap/insert and enter a PIN.
    const MAX_ATTEMPTS = 40;
    const INTERVAL_MS = 3000;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      try {
        const res = await reconcilePayment(merchantReference);
        const status = res.data.status;
        if (status === "SUCCEEDED") {
          setTerminalStatus(null);
          return true;
        }
        if (status === "FAILED" || status === "CANCELLED") {
          setTerminalStatus({
            phase: "failed",
            message:
              res.data.failureReason ??
              "The card payment was declined or cancelled.",
          });
          return false;
        }
        // PENDING / PROCESSING — keep waiting.
      } catch {
        // Transient reconcile error — keep polling; the device may still
        // be processing.
      }
    }

    setTerminalStatus({
      phase: "failed",
      message:
        "Timed out waiting for the card terminal. Check the device, then retry.",
    });
    return false;
  }

  /** Payment confirmed from the tender modal — route by source. */
  async function handlePaymentConfirm(
    payments: PaymentSplit[],
    agentCode?: string,
  ) {
    // Re-entry guard: a double-click (or any second invocation while the
    // first is still in flight) is dropped. Without this, the walk-up path
    // below mints a fresh transactionId per call, so each click produced a
    // separate order — the "three orders for one sale" bug.
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      await runPaymentConfirm(payments, agentCode);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  }

  async function runPaymentConfirm(
    payments: PaymentSplit[],
    agentCode?: string,
  ) {
    if (tenderSource === "session") {
      const cardLeg = payments.find((p) => p.method === "POS_TERMINAL");
      if (cardLeg && !online) {
        setTerminalStatus({
          phase: "failed",
          message:
            "Card payments need an internet connection to reach the terminal. Use cash, or try again when back online.",
        });
        return;
      }

      const res = await posSession.confirm(payments, {
        name: cart.customerName || undefined,
        phone: cart.customerPhone || undefined,
        agentCode,
      });
      if (!res.ok) {
        // The error is shown in the ScannerBasketPanel; the tender modal
        // closes and the cashier can retry from the panel.
        setShowTender(false);
        return;
      }

      // Card leg: the session order is PENDING_PAYMENT — charge the
      // terminal and only treat the sale as complete once it confirms.
      if (cardLeg && res.orderId) {
        const approved = await runTerminalPayment(res.orderId, cardLeg.amount);
        if (!approved) {
          // Card not approved — keep the tender modal open with the
          // failure shown so the cashier can retry.
          return;
        }
      }

      setShowTender(false);
      setTerminalStatus(null);
      setSessionSaleNote(
        res.orderNumber ? `Order #${res.orderNumber} completed.` : "Sale completed.",
      );
      updatePendingCount();
      return;
    }

    // ── Local walk-up sale ──
    const cardLeg = payments.find((p) => p.method === "POS_TERMINAL");

    // A card payment must be approved on the physical terminal, which the
    // server reaches online. Block a card sale while offline.
    if (cardLeg && !online) {
      setTerminalStatus({
        phase: "failed",
        message:
          "Card payments need an internet connection to reach the terminal. Use cash, or try again when back online.",
      });
      return;
    }

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
      agentCode,
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
          // A card sale cannot be queued offline — without a synced order
          // there is nothing to charge the terminal against.
          if (cardLeg) {
            setTerminalStatus({
              phase: "failed",
              message:
                result.failed[0]?.reason ??
                "Could not create the order. The card was not charged.",
            });
            return;
          }
          // Cash-only — safe to queue for retry.
          await queueTransaction(transaction);
        }
      } catch (err) {
        if (cardLeg) {
          setTerminalStatus({
            phase: "failed",
            message:
              err instanceof Error
                ? err.message
                : "Could not reach the server. The card was not charged.",
          });
          return;
        }
        // Cash-only — queue for retry.
        await queueTransaction(transaction);
      }
    } else {
      // Offline — queue (cash-only; the card guard above already returned).
      await queueTransaction(transaction);
    }

    // ── Card payment: charge the physical terminal, confirm before done ──
    // The order exists at PENDING_PAYMENT; pushing the card leg to the
    // device and getting a SUCCEEDED reconcile is what flips it to PAID.
    if (cardLeg && sale.orderId) {
      const approved = await runTerminalPayment(sale.orderId, cardLeg.amount);
      if (!approved) {
        // Card declined / cancelled / timed out. The order stays
        // PENDING_PAYMENT; the cashier can retry from the tender modal,
        // which shows the failure via `terminalStatus`. Do NOT complete
        // the sale or clear the cart.
        return;
      }
      // Approved — clear the failure banner if any lingered.
      setTerminalStatus(null);
    }

    sales.addSale(sale);
    setCompletedSale(sale);
    setShowTender(false);
    setTerminalStatus(null);
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

            {/* Right: Scanner basket (when present) + local cart */}
            <div className="w-96 border-l border-zinc-800 p-4 flex flex-col gap-3 bg-zinc-900/50 overflow-y-auto">
              {/* Scanner-built basket — appears only when a session exists */}
              {posSession.session && (
                <ScannerBasketPanel
                  session={posSession.session}
                  connected={posSession.connected}
                  busy={posSession.busy}
                  error={posSession.error}
                  onCompleteSale={handleCompleteSessionSale}
                  onVoid={handleVoidSession}
                  onDismiss={handleDismissSessionPanel}
                />
              )}

              {/* Toast: a scanner sale just completed */}
              {sessionSaleNote && (
                <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-emerald-300">{sessionSaleNote}</span>
                  <button
                    onClick={() => setSessionSaleNote(null)}
                    className="text-emerald-500 hover:text-emerald-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Local walk-up cart */}
              <div className="flex-1 flex flex-col min-h-0">
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
          grandTotal={
            // Both the session cart totals and the local cart are in MINOR
            // units (kobo) — the tender modal works in minor units too.
            tenderSource === "session"
              ? posSession.session?.cart.totals.grandTotal ?? 0
              : cart.grandTotal
          }
          onConfirm={handlePaymentConfirm}
          onCancel={() => {
            setShowTender(false);
            setTerminalStatus(null);
          }}
          confirming={confirming}
          terminalStatus={terminalStatus}
          onValidateAgentCode={validateAgentCode}
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
