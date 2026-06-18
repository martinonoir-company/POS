// ── Shared Types for POS PWA ──

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  variants: ProductVariant[];
  media: ProductMedia[];
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  retailPriceNgn: string;
  retailPriceUsd: string;
  wholesalePriceNgn: string;
  wholesalePriceUsd: string;
  compareAtPriceNgn?: string | null;
  compareAtPriceUsd?: string | null;
  costPriceNgn?: string | null;
  weightKg?: string | null;
  isActive: boolean;
  trackInventory: boolean;
  options: Record<string, string>;
  barcode: string | null;
  sortOrder: number;
}

export interface ProductMedia {
  id: string;
  url: string;
  alt?: string;
  altText?: string;
  type: string;
  sortOrder: number;
}

export interface StockLevel {
  variantId: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  lastMovementAt?: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  options: Record<string, string>;
  /** Available stock — used to enforce qty limits. -1 = unlimited (no tracking). */
  maxStock: number;
}

export interface PaymentSplit {
  method: 'CASH' | 'POS_TERMINAL' | 'BANK_TRANSFER';
  amount: number;
}

export interface PosTransaction {
  transactionId: string;
  terminalId: string;
  staffId?: string;
  staffName?: string;
  items: { variantId: string; quantity: number; unitPrice: number }[];
  payments: PaymentSplit[];
  currency: string;
  timestamp: string;
  couponCode?: string;
  discountAmount?: number;
  discountType?: 'COUPON' | 'MANUAL';
  discountAppliedAt?: string;
  customerName?: string;
  customerPhone?: string;
  /** Marketing-agent referral code entered at the till (optional). */
  agentCode?: string;
}

export interface CompletedSale {
  transactionId: string;
  orderNumber?: string;
  orderId?: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  payments: PaymentSplit[];
  couponCode?: string;
  customerName?: string;
  customerPhone?: string;
  timestamp: string;
  synced: boolean;
  terminalId: string;
}

export interface SyncBatchResult {
  terminalId: string;
  processedAt: string;
  successful: { transactionId: string; orderId: string; orderNumber: string }[];
  failed: { transactionId: string; reason: string }[];
  skipped: { transactionId: string; reason: string }[];
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
}

export interface QuoteResult {
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  coupon?: { code: string; discountType: string; discountAmount: number };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}
