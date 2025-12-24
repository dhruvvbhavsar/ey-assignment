class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.token = null;
    this.pingInterval = null;
  }

  connect(token = null) {
    this.token = token;

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let wsUrl = `${protocol}//${host}/ws/feed`;

    if (token) {
      wsUrl += `?token=${token}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', { connected: true });
      this.startPingInterval();
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnected = false;
      this.stopPingInterval();
      this.emit('disconnected', { code: event.code, reason: event.reason });

      // Attempt to reconnect
      if (event.code !== 1000) { // 1000 = normal closure
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'connected':
        console.log('WebSocket authenticated:', data);
        this.emit('authenticated', data);
        break;

      case 'new_post':
        this.emit('new_post', data);
        break;

      case 'new_comment':
        this.emit('new_comment', { ...data, post_id: message.post_id });
        break;

      case 'new_like':
      case 'unlike':
        this.emit('like_update', { ...data, isLike: type === 'new_like' });
        break;

      case 'post_deleted':
        this.emit('post_deleted', data);
        break;

      case 'comment_deleted':
        this.emit('comment_deleted', data);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown WebSocket message type:', type, data);
        this.emit(type, data);
    }
  }

  startPingInterval() {
    this.stopPingInterval();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect(this.token);
      }
    }, delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, callback);
    };
  }

  unsubscribe(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;
