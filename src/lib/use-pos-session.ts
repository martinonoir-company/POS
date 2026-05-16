"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { confirmPosSession, fetchPosSession, voidPosSession } from "./api";
import {
  POS_WS_NAMESPACE,
  PosClientEvent,
  PosServerEvent,
  type PosSession,
  type SessionConfirmedPayload,
  type SessionMutationPayload,
  type SessionVoidedPayload,
} from "./pos-session-events";
import type { PaymentSplit } from "./types";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  // Fall back to the API origin with the /pos namespace if the dedicated
  // WS var isn't set. Strip a trailing /api/v1 if the API URL was reused.
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/^http/, "ws");

function wsUrl(): string {
  const root = WS_BASE.replace(/\/pos\/?$/i, "");
  return `${root}${POS_WS_NAMESPACE}`;
}

export interface UsePosSessionResult {
  /** The current open session on this terminal, or null if none. */
  session: PosSession | null;
  /** True while the initial fetch / a confirm / a void is in flight. */
  busy: boolean;
  /** Live WS connection state. */
  connected: boolean;
  /** Error message from the last confirm/void attempt, if any. */
  error: string | null;
  clearError: () => void;
  /** Re-fetch the session from the server (e.g. after a reconnect). */
  refetch: () => Promise<void>;
  /** Complete the sale with the given payment split. */
  confirm: (
    payments: PaymentSplit[],
    customer?: { name?: string; phone?: string },
  ) => Promise<{ ok: boolean; orderNumber?: string; orderId?: string }>;
  /** Void the basket (cashier rejects it). */
  voidSession: (reason?: string) => Promise<boolean>;
}

/**
 * Subscribes the POS web app to the live session on a terminal.
 *
 *  - Connects to /pos with the staff access token in the handshake,
 *    joins the terminal room.
 *  - Fetches the current session on mount; updates it from WS events
 *    (the server's payloads carry the fresh cart + version — source of
 *    truth).
 *  - On reconnect, re-joins the room and refetches.
 *  - `confirm` posts the payment split to the session-confirm endpoint
 *    (which reuses the POS sync pipeline server-side). On success the
 *    session flips to COMPLETED and `session:confirmed` fans out to the
 *    scanner too.
 *  - `voidSession` cancels the basket.
 *
 * Designed to coexist with the existing local-cart checkout: when there's
 * no open session, this hook is inert and the cashier rings up walk-ups
 * locally as before.
 */
export function usePosSession(
  terminalCode: string,
  getToken: () => string | null,
  enabled: boolean,
): UsePosSessionResult {
  const [session, setSession] = useState<PosSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);

  const clearError = useCallback(() => setError(null), []);

  const refetch = useCallback(async () => {
    try {
      const s = await fetchPosSession(terminalCode);
      if (mountedRef.current) setSession(s);
    } catch {
      // Leave the last known state; transient.
    }
  }, [terminalCode]);

  // ── Socket lifecycle ──
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setSession(null);
      return;
    }
    const token = getToken();
    if (!token) return;

    const socket = io(wsUrl(), {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 12000,
    });
    socketRef.current = socket;

    const join = () =>
      socket.emit(PosClientEvent.JOIN_TERMINAL, { terminalCode });

    socket.on("connect", () => {
      if (mountedRef.current) setConnected(true);
      join();
    });
    socket.io.on("reconnect", () => {
      join();
      void refetch();
    });
    socket.on("disconnect", () => {
      if (mountedRef.current) setConnected(false);
    });
    socket.on("connect_error", () => {
      if (mountedRef.current) setConnected(false);
    });

    const applyMutation = (p: SessionMutationPayload) => {
      setSession((prev) =>
        prev && prev.id === p.sessionId
          ? { ...prev, cart: p.cart, version: p.version }
          : prev,
      );
    };
    socket.on(PosServerEvent.SESSION_OPENED, () => void refetch());
    socket.on(PosServerEvent.ITEM_ADDED, applyMutation);
    socket.on(PosServerEvent.ITEM_UPDATED, applyMutation);
    socket.on(PosServerEvent.ITEM_REMOVED, applyMutation);
    socket.on(PosServerEvent.TOTALS_CHANGED, applyMutation);
    socket.on(PosServerEvent.PAYMENT_INTENT, (p: SessionMutationPayload) => {
      setSession((prev) =>
        prev && prev.id === p.sessionId
          ? { ...prev, cart: p.cart, version: p.version, status: "AWAITING_PAYMENT" }
          : prev,
      );
    });
    socket.on(PosServerEvent.CONFIRMED, (p: SessionConfirmedPayload) => {
      setSession((prev) =>
        prev && prev.id === p.sessionId
          ? {
              ...prev,
              version: p.version,
              status: "COMPLETED",
              resultOrderId: p.orderId,
              resultOrderNumber: p.orderNumber,
            }
          : prev,
      );
    });
    socket.on(PosServerEvent.VOIDED, (p: SessionVoidedPayload) => {
      setSession((prev) =>
        prev && prev.id === p.sessionId
          ? { ...prev, version: p.version, status: "VOIDED" }
          : prev,
      );
    });

    socket.connect();
    void refetch();

    return () => {
      mountedRef.current = false;
      try {
        socket.emit(PosClientEvent.LEAVE_TERMINAL, { terminalCode });
      } catch {
        /* ignore */
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalCode, enabled]);

  // ── Confirm ──
  const confirm = useCallback(
    async (
      payments: PaymentSplit[],
      customer?: { name?: string; phone?: string },
    ): Promise<{ ok: boolean; orderNumber?: string; orderId?: string }> => {
      const current = session;
      if (!current) {
        setError("No open session to complete.");
        return { ok: false };
      }
      setBusy(true);
      setError(null);
      // One-shot version-conflict retry: a stale version → refetch + retry.
      const attempt = async (
        version: number,
        isRetry: boolean,
      ): Promise<{ ok: boolean; orderNumber?: string; orderId?: string }> => {
        try {
          const res = await confirmPosSession(terminalCode, {
            version,
            payments,
            customerName: customer?.name,
            customerPhone: customer?.phone,
          });
          if (mountedRef.current) setSession(res.data);
          return {
            ok: true,
            orderNumber: res.data.resultOrderNumber ?? undefined,
            orderId: res.data.resultOrderId ?? undefined,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to complete sale";
          if (!isRetry && /version|conflict/i.test(msg)) {
            const fresh = await fetchPosSession(terminalCode);
            if (fresh) {
              setSession(fresh);
              return attempt(fresh.version, true);
            }
          }
          setError(msg);
          return { ok: false };
        }
      };
      const result = await attempt(current.version, false);
      if (mountedRef.current) setBusy(false);
      return result;
    },
    [session, terminalCode],
  );

  // ── Void ──
  const voidSession = useCallback(
    async (reason?: string): Promise<boolean> => {
      const current = session;
      if (!current) return false;
      setBusy(true);
      setError(null);
      const attempt = async (version: number, isRetry: boolean): Promise<boolean> => {
        try {
          const res = await voidPosSession(terminalCode, { version, reason });
          if (mountedRef.current) setSession(res.data);
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to void session";
          if (!isRetry && /version|conflict/i.test(msg)) {
            const fresh = await fetchPosSession(terminalCode);
            if (fresh) {
              setSession(fresh);
              return attempt(fresh.version, true);
            }
          }
          setError(msg);
          return false;
        }
      };
      const ok = await attempt(current.version, false);
      if (mountedRef.current) setBusy(false);
      return ok;
    },
    [session, terminalCode],
  );

  return {
    session,
    busy,
    connected,
    error,
    clearError,
    refetch,
    confirm,
    voidSession,
  };
}
