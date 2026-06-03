import type { AnalysisWsMessage, UUID } from "../types/api";

const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, "") || "ws://localhost:8000";

export interface AnalysisWsHandlers {
  onMessage: (message: AnalysisWsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
}

export function connectAnalysisWs(
  analysisId: UUID,
  handlers: AnalysisWsHandlers
): WebSocket {
  const socket = new WebSocket(`${WS_BASE_URL}/ws/analyses/${analysisId}`);

  socket.onopen = () => {
    handlers.onOpen?.();
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as AnalysisWsMessage;
      handlers.onMessage(message);
    } catch {
      handlers.onMessage({
        error: "Failed to parse WebSocket message"
      });
    }
  };

  socket.onerror = (event) => {
    handlers.onError?.(event);
  };

  socket.onclose = () => {
    handlers.onClose?.();
  };

  return socket;
}