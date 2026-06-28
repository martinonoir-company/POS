"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  POS_WS_NAMESPACE,
  PosServerEvent,
  type DispatchNewPayload,
} from "./pos-session-events";
import { playDispatchAlert } from "./sound-player";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/^http/, "ws");

function wsUrl(): string {
  const root = WS_BASE.replace(/\/pos\/?$/i, "");
  return `${root}${POS_WS_NAMESPACE}`;
}

export interface UseDispatchAlertsResult {
  /** The most recent unacknowledged dispatch alert (drives the modal). */
  current: DispatchNewPayload | null;
  /** Queue length (alerts waiting behind the current one). */
  pending: number;
  /** Live WS connection state. */
  connected: boolean;
  /** Dismiss the current alert and surface the next queued one, if any. */
  dismiss: () => void;
}

/**
 * Subscribes the POS to the global dispatch room and raises an alert for
 * every new paid order that needs branch dispatch.
 *
 * The server auto-joins this socket to the dispatch room on connect (no
 * client join needed). Each `dispatch:new` event plays a chime and enqueues
 * the order; the UI shows one alert at a time and `dismiss()` advances the
 * queue, so a burst of orders never loses an alert.
 *
 * Built to be unbreakable:
 *  - Its own socket, independent of the session socket — failure here never
 *    affects checkout.
 *  - Auto-reconnect with backoff (socket.io built-in).
 *  - All handlers are guarded; sound failures are swallowed.
 *  - Dedupes by orderId so a reconnect/replay can't double-alert.
 */
export function useDispatchAlerts(
  getToken: () => string | null,
  enabled: boolean,
): UseDispatchAlertsResult {
  const [queue, setQueue] = useState<DispatchNewPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setQueue([]);
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

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on(PosServerEvent.DISPATCH_NEW, (p: DispatchNewPayload) => {
      try {
        if (!p?.orderId || seenRef.current.has(p.orderId)) return;
        seenRef.current.add(p.orderId);
        setQueue((q) => [...q, p]);
        playDispatchAlert();
      } catch {
        /* never let an alert handler crash the app */
      }
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    current: queue[0] ?? null,
    pending: Math.max(0, queue.length - 1),
    connected,
    dismiss,
  };
}
