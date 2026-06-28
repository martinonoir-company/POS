/**
 * Realtime event contract for the /pos Socket.IO namespace.
 *
 * Mirrors server/src/modules/realtime/pos-events.ts and the scanner's
 * copy. Keep all three in sync. Rooms are keyed by terminal CODE; both
 * the POS web app and the scanner join the same room. The server is the
 * source of truth — REST writes, the gateway notifies.
 */

export const POS_WS_NAMESPACE = "/pos";

export type PosSessionStatus =
  | "ACTIVE"
  | "AWAITING_PAYMENT"
  | "COMPLETED"
  | "VOIDED";

/** One line in the live POS-session cart. Prices are MINOR units. */
export interface PosSessionLine {
  clientLineId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  options: Record<string, string> | null;
  maxStock: number;
  scannedByStaffId: string;
  scannedAt: string;
}

export interface PosSessionCart {
  items: PosSessionLine[];
  currency: "NGN" | "USD";
  totals: {
    subtotal: number;
    discountTotal: number;
    grandTotal: number;
  };
  couponCode?: string | null;
  discountAmount?: number;
  discountType?: "COUPON" | "MANUAL" | null;
}

export interface PosSession {
  id: string;
  terminalId: string;
  branchId: string;
  openedByStaffId: string;
  status: PosSessionStatus;
  cart: PosSessionCart;
  version: number;
  openedAt: string;
  closedAt?: string | null;
  resultOrderId?: string | null;
  resultOrderNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Events the SERVER emits into a terminal room. */
export const PosServerEvent = {
  SESSION_OPENED: "session:opened",
  ITEM_ADDED: "session:item-added",
  ITEM_UPDATED: "session:item-updated",
  ITEM_REMOVED: "session:item-removed",
  TOTALS_CHANGED: "session:totals-changed",
  PAYMENT_INTENT: "session:payment-intent",
  CONFIRMED: "session:confirmed",
  VOIDED: "session:voided",
  /** A new paid order that needs branch dispatch (storefront/mobile). */
  DISPATCH_NEW: "dispatch:new",
} as const;
export type PosServerEvent =
  (typeof PosServerEvent)[keyof typeof PosServerEvent];

/** Events the CLIENT sends to the gateway (control plane only). */
export const PosClientEvent = {
  JOIN_TERMINAL: "terminal:join",
  LEAVE_TERMINAL: "terminal:leave",
} as const;
export type PosClientEvent =
  (typeof PosClientEvent)[keyof typeof PosClientEvent];

// ── Event payloads ──

export interface SessionOpenedPayload {
  sessionId: string;
  terminalCode: string;
  branchCode: string;
  version: number;
  cart: PosSessionCart;
  openedByStaffId: string;
}

export interface SessionMutationPayload {
  sessionId: string;
  terminalCode: string;
  version: number;
  cart: PosSessionCart;
}

export interface SessionConfirmedPayload {
  sessionId: string;
  terminalCode: string;
  version: number;
  orderId: string;
  orderNumber: string;
}

export interface SessionVoidedPayload {
  sessionId: string;
  terminalCode: string;
  version: number;
  reason?: string;
}

/** Payload for the dispatch:new alert pushed to all POS terminals. */
export interface DispatchNewPayload {
  orderId: string;
  orderNumber: string;
  channel: string;
  currency: string;
  grandTotal: number;
  itemCount: number;
  customerName: string;
  city?: string;
  state?: string;
  createdAt: string;
}
