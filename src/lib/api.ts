import type { Product, StockLevel, SyncBatchResult, PosTransaction, QuoteResult, PaymentSplit } from "./types";
import type { PosSession } from "./pos-session-events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

type TokenGetter = () => string | null;
type RefreshFn = () => Promise<boolean>;

let _getToken: TokenGetter = () => null;
let _refresh: RefreshFn = async () => false;
let _onUnauthorized: (() => void) | null = null;

export function configureApi(
  getToken: TokenGetter,
  refresh: RefreshFn,
  onUnauthorized: () => void
) {
  _getToken = getToken;
  _refresh = refresh;
  _onUnauthorized = onUnauthorized;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = _getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const ok = await _refresh();
    if (ok) return request<T>(path, options, false);
    _onUnauthorized?.();
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let errBody: { message?: string | string[]; error?: string };
    try { errBody = await res.json(); } catch { errBody = { message: res.statusText }; }
    const msg = Array.isArray(errBody.message) ? errBody.message.join(", ") : errBody.message;
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Products ──

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export async function fetchProducts(params: ProductQueryParams = {}): Promise<{
  data: { items: Product[]; total: number; page: number; limit: number; pages: number };
}> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("limit", String(params.limit ?? 24));
  q.set("isActive", "true");
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.categoryId) q.set("categoryId", params.categoryId);
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.sortOrder) q.set("sortOrder", params.sortOrder);
  return request(`/products?${q.toString()}`);
}

// ── Stock ──

export async function fetchAllStock(page = 1, limit = 200): Promise<{
  data: { items: StockLevel[]; total: number };
}> {
  return request(`/pos/stock?page=${page}&limit=${limit}`);
}

export async function fetchVariantStock(variantId: string): Promise<{
  data: StockLevel | null;
}> {
  return request(`/pos/stock/${variantId}`);
}

// ── POS Sync ──

export async function syncTransactions(
  terminalId: string,
  transactions: PosTransaction[]
): Promise<{ data: SyncBatchResult }> {
  return request("/pos/sync", {
    method: "POST",
    body: JSON.stringify({ terminalId, transactions }),
  });
}

// ── POS Sessions (scanner-built baskets) ──
//
// The scanner builds the basket and flips it to AWAITING_PAYMENT. The POS
// web app subscribes to the terminal room, renders the live cart, and —
// when the cashier takes payment — calls `confirm` with the split. The
// confirm endpoint reuses the existing POS sync pipeline server-side
// (order created PAID, inventory SALE movements, audit trail), so the
// downstream effects are identical to a locally-rung sale.

/** Fetch the current open session for a terminal. Resolves to null on 404. */
export async function fetchPosSession(terminalCode: string): Promise<PosSession | null> {
  try {
    const res = await request<{ data: PosSession }>(
      `/pos-sessions/${encodeURIComponent(terminalCode)}`,
    );
    return res.data;
  } catch (err) {
    // 404 → no open session. Anything else re-throws.
    if (err instanceof Error && /not found|no open session/i.test(err.message)) {
      return null;
    }
    // The request() helper throws Error without a status code; treat a
    // "not found"-shaped message as null, otherwise surface it.
    if (err instanceof Error && err.message.toLowerCase().includes("session")) {
      return null;
    }
    throw err;
  }
}

/** Complete the sale: take payment for a scanner-built basket. */
export async function confirmPosSession(
  terminalCode: string,
  body: {
    version: number;
    payments: PaymentSplit[];
    customerName?: string;
    customerPhone?: string;
    agentCode?: string;
  },
): Promise<{ data: PosSession }> {
  return request(`/pos-sessions/${encodeURIComponent(terminalCode)}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Void the session (cashier rejects the basket). */
export async function voidPosSession(
  terminalCode: string,
  body: { version: number; reason?: string },
): Promise<{ data: PosSession }> {
  return request(`/pos-sessions/${encodeURIComponent(terminalCode)}/void`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Price Quote (coupon validation) ──

export async function getQuote(
  items: { variantId: string; quantity: number; unitPrice: number }[],
  couponCode?: string,
  currency = "NGN"
): Promise<{ data: QuoteResult }> {
  return request("/orders/quote", {
    method: "POST",
    body: JSON.stringify({
      items: items.map((i) => ({
        variantId: i.variantId,
        sku: "",
        productName: "",
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      context: {
        currency,
        country: "NG",
        state: "Lagos",
        couponCode,
        // Lets the server reject coupons not scoped to the POS channel.
        channel: "POS",
      },
    }),
  });
}

// ── Orders (Sales History) ──

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  channel: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    variantName?: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    discountAmount: number;
    imageUrl?: string;
    options?: Record<string, string>;
  }[];
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  shippingAddress?: Record<string, string> | null;
  couponCode?: string | null;
  discountType?: string | null;
  discountAppliedBy?: string | null;
  discountAppliedByName?: string | null;
  discountAppliedAt?: string | null;
  customerNote?: string | null;
  staffNote?: string | null;
  paidAt?: string | null;
  statusHistory?: { fromStatus: string; toStatus: string; createdAt: string; reason?: string }[];
}

export async function fetchOrders(params: OrderQueryParams = {}): Promise<{
  data: { items: OrderSummary[]; total: number; page: number; limit: number; pages: number };
}> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("limit", String(params.limit ?? 15));
  q.set("channel", params.channel ?? "POS");
  if (params.status) q.set("status", params.status);
  if (params.startDate) q.set("startDate", params.startDate);
  if (params.endDate) q.set("endDate", params.endDate);
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.sortOrder) q.set("sortOrder", params.sortOrder);
  return request(`/orders?${q.toString()}`);
}

export async function fetchOrderById(id: string): Promise<{ data: OrderSummary }> {
  return request(`/orders/${id}`);
}

// ── POS Pages API ──

export async function fetchAnalytics(startDate?: string, endDate?: string, channel?: string): Promise<{ data: {
  orderCount: number; totalRevenue: number; totalDiscount: number; avgOrderValue: number;
  paymentBreakdown: { method: string; count: number; total: number }[];
  topProducts: { productName: string; sku: string; totalQty: number; totalRevenue: number }[];
  dailyRevenue: { date: string; orders: number; revenue: number }[];
} }> {
  const q = new URLSearchParams();
  if (startDate) q.set("startDate", startDate);
  if (endDate) q.set("endDate", endDate);
  if (channel) q.set("channel", channel);
  return request(`/pos/pages/analytics/summary?${q.toString()}`);
}

export async function fetchCoupons(page = 1, limit = 15, status?: string): Promise<{ data: {
  items: { id: string; code: string; description?: string; discountType: string; discountValue: number; currency?: string; minimumOrderAmount: number; maximumDiscount: number; usageLimit: number; usageLimitPerCustomer: number; timesUsed: number; status: string; startsAt?: string; expiresAt?: string; createdAt: string }[];
  total: number; page: number; limit: number; pages: number;
} }> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);
  return request(`/pos/pages/coupons?${q.toString()}`);
}

export async function fetchCustomers(page = 1, limit = 15, search?: string): Promise<{ data: {
  items: { id: string; userId: string; totalOrders: number; totalSpentNgn: number; totalSpentUsd: number; avgOrderValueNgn: number; lastOrderAt?: string; tags: string[]; notes?: string; createdAt: string; user?: { id: string; email: string; firstName: string; lastName: string } }[];
  total: number; page: number; limit: number; pages: number;
} }> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search?.trim()) q.set("search", search.trim());
  return request(`/pos/pages/customers?${q.toString()}`);
}

export async function fetchCustomerById(id: string): Promise<{ data: {
  id: string; userId: string; totalOrders: number; totalSpentNgn: number; tags: string[]; notes?: string; createdAt: string;
  user?: { id: string; email: string; firstName: string; lastName: string };
  addresses?: { id: string; label?: string; line1: string; city: string; state: string; country: string; isDefault: boolean }[];
  recentOrders?: OrderSummary[];
} }> {
  return request(`/pos/pages/customers/${id}`);
}

export async function fetchInventoryLevels(page = 1, limit = 20, search?: string, lowStockOnly?: boolean): Promise<{ data: {
  items: { variantId: string; warehouseCode: string; onHand: number; reserved: number; available: number; lastMovementAt: string; sku: string; variantName: string; barcode: string; productName: string; productId: string }[];
  total: number; page: number; limit: number; pages: number;
} }> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search?.trim()) q.set("search", search.trim());
  if (lowStockOnly) q.set("lowStockOnly", "true");
  return request(`/pos/pages/inventory?${q.toString()}`);
}

export async function fetchMovements(variantId: string, page = 1, limit = 20): Promise<{ data: {
  items: { id: string; variantId: string; kind: string; quantity: number; warehouseCode: string; referenceId?: string; referenceType?: string; reason?: string; createdBy?: string; createdAt: string }[];
  total: number; page: number; limit: number; pages: number;
} }> {
  return request(`/pos/pages/inventory/${variantId}/movements?page=${page}&limit=${limit}`);
}

// ── Payments (real payment records, not orders) ──

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: "PAYSTACK" | "MONIEPOINT" | "CASH";
  channel: "STOREFRONT" | "MOBILE" | "POS";
  method: "CARD" | "CASH" | "POS_TRANSFER" | "BANK_TRANSFER";
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";
  amount: number;
  currency: string;
  merchantReference: string;
  providerReference?: string | null;
  terminalSerial?: string | null;
  gatewayResponse?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment records for the POS Payments tab. Queries the real `payments`
 * table, scoped to the POS channel.
 */
export async function fetchPayments(
  page = 1,
  limit = 15,
  opts: { status?: string; search?: string } = {},
): Promise<{ data: {
  items: PaymentRecord[];
  total: number; page: number; limit: number; pages: number;
} }> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit), channel: "POS" });
  if (opts.status) q.set("status", opts.status);
  if (opts.search?.trim()) q.set("search", opts.search.trim());
  return request(`/payments?${q.toString()}`);
}

// ── Marketing agents ──

/**
 * Validate a marketing-agent code at the till. Server returns the agent
 * name for cashier confirmation. Throws on a 4xx, so callers should
 * catch and surface res.error to the UI.
 */
export async function validateAgentCode(
  code: string,
): Promise<{ ok: true; agentName: string } | { ok: false; error: string }> {
  try {
    const res = await request<{
      data: { agentId: string; code: string; agentName: string };
    }>("/agents/validate-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return { ok: true, agentName: res.data.agentName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not verify code",
    };
  }
}

/** Result of starting a POS payment (cash leg or terminal push). */
export interface PosPaymentResult {
  paymentId: string;
  merchantReference: string;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";
  amount: number;
  failureReason?: string | null;
}

/**
 * Push a card payment to the Moniepoint terminal paired with this POS
 * terminal. Returns once the transaction is on the device (PROCESSING);
 * poll `reconcilePayment` until it settles SUCCEEDED or FAILED.
 * `amount` is in minor units (kobo).
 */
export async function posTerminalPayment(input: {
  orderId: string;
  amount: number;
  terminalCode: string;
}): Promise<{ data: PosPaymentResult }> {
  return request("/payments/pos/terminal", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Reconcile a payment with its provider and return the current status.
 * Server-mediated — the POS never calls Moniepoint directly. Safe to
 * call repeatedly while polling a terminal payment.
 */
export async function reconcilePayment(
  merchantReference: string,
): Promise<{ data: PosPaymentResult }> {
  return request(`/payments/reconcile/${encodeURIComponent(merchantReference)}`, {
    method: "POST",
  });
}
