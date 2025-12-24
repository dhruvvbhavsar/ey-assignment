import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import websocketService from "../services/websocket";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      websocketService.connect(token);
    } else {
      // Only disconnect if we were previously connected
      if (isConnected) {
        websocketService.disconnect();
      }
    }

    return () => {
      websocketService.disconnect();
    };
  }, [isAuthenticated, token]);

  // Set up connection status listeners
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setConnectionStatus("connected");
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
    };

    const handleError = () => {
      setConnectionStatus("error");
    };

    const handleMaxReconnectAttempts = () => {
      setConnectionStatus("failed");
    };

    const unsubConnected = websocketService.subscribe(
      "connected",
      handleConnected,
    );
    const unsubDisconnected = websocketService.subscribe(
      "disconnected",
      handleDisconnected,
    );
    const unsubError = websocketService.subscribe("error", handleError);
    const unsubMaxReconnect = websocketService.subscribe(
      "max_reconnect_attempts",
      handleMaxReconnectAttempts,
    );

    return () => {
      if (typeof unsubConnected === "function") unsubConnected();
      if (typeof unsubDisconnected === "function") unsubDisconnected();
      if (typeof unsubError === "function") unsubError();
      if (typeof unsubMaxReconnect === "function") unsubMaxReconnect();
    };
  }, []);

  // Subscribe to WebSocket events - safe to call even when not connected
  const subscribe = useCallback((event, callback) => {
    if (!websocketService) {
      console.warn("WebSocket service not available");
      return () => {}; // Return no-op unsubscribe function
    }
    return websocketService.subscribe(event, callback);
  }, []);

  // Unsubscribe from WebSocket events
  const unsubscribe = useCallback((event, callback) => {
    if (!websocketService) return;
    websocketService.unsubscribe(event, callback);
  }, []);

  // Send message through WebSocket - only works when connected
  const send = useCallback(
    (data) => {
      if (!websocketService || !isConnected) {
        console.warn("Cannot send message: WebSocket not connected");
        return false;
      }
      return websocketService.send(data);
    },
    [isConnected],
  );

  // Reconnect to WebSocket
  const reconnect = useCallback(() => {
    websocketService.disconnect();
    if (isAuthenticated && token) {
      // Small delay before reconnecting
      setTimeout(() => {
        websocketService.connect(token);
      }, 100);
    }
  }, [isAuthenticated, token]);

  const value = {
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    send,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return a safe default object instead of throwing
    // This allows components to use the hook even before context is available
    return {
      isConnected: false,
      connectionStatus: "disconnected",
      subscribe: () => () => {},
      unsubscribe: () => {},
      send: () => false,
      reconnect: () => {},
    };
  }
  return context;
}

export default WebSocketContext;
