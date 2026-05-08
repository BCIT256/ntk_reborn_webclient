"use client";

import { ClientToServer, ServerToClient } from "./protocol";

class GameSocket {
  private socket: WebSocket | null = null;
  private url: string = "ws://localhost:2010";
  private onMessageCallbacks: ((data: ServerToClient) => void)[] = [];
  private onConnectionLostCallbacks: (() => void)[] = [];
  private onConnectCallbacks: (() => void)[] = [];
  private onDisconnectCallbacks: (() => void)[] = [];

  /** The entity_id of the local player, set by LoginSuccess. */
  public localEntityId: number | null = null;

  /** Whether the WebSocket is currently open. */
  public connected: boolean = false;

  private retryCount = 0;
  private reconnectStartTime = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RETRIES = 10;
  private readonly MAX_RECONNECT_MS = 90_000;
  private readonly RETRY_DELAY_MS = 5_000;

  connect() {
    console.log(`Connecting to ${this.url}...`);

    if (this.reconnectStartTime === 0) {
      this.reconnectStartTime = Date.now();
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("Connected to server.");
      this.connected = true;
      // Reset retry state on successful connection
      this.retryCount = 0;
      this.reconnectStartTime = 0;
      this.onConnectCallbacks.forEach(cb => cb());
    };

    this.socket.onmessage = (event) => {
      try {
        const data: ServerToClient = JSON.parse(event.data);
        // Log type only; omit payload to avoid leaking sensitive data to console
        console.log("INCOMING:", data.type);
        if (data.type === "LoginSuccess") {
          this.localEntityId = data.payload.entity_id;
        }
        this.onMessageCallbacks.forEach(cb => cb(data));
      } catch (e) {
        console.error("Failed to parse incoming packet");
      }
    };

    this.socket.onclose = () => {
      console.log("Disconnected from server.");
      this.connected = false;
      this.localEntityId = null;
      this.onDisconnectCallbacks.forEach(cb => cb());
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  }

  private scheduleReconnect() {
    this.retryCount++;
    const elapsed = Date.now() - this.reconnectStartTime;

    if (this.retryCount > this.MAX_RETRIES || elapsed > this.MAX_RECONNECT_MS) {
      console.warn(
        `Giving up reconnection after ${this.retryCount} retries / ${Math.round(elapsed / 1000)}s`
      );
      this.resetRetryState();
      this.onConnectionLostCallbacks.forEach(cb => cb());
      return;
    }

    console.log(
      `Reconnect attempt ${this.retryCount}/${this.MAX_RETRIES} ` +
        `(${Math.round(elapsed / 1000)}s / ${this.MAX_RECONNECT_MS / 1000}s elapsed)`
    );
    this.reconnectTimer = setTimeout(() => this.connect(), this.RETRY_DELAY_MS);
  }

  private resetRetryState() {
    this.retryCount = 0;
    this.reconnectStartTime = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  onConnectionLost(callback: () => void) {
    this.onConnectionLostCallbacks.push(callback);
  }

  /** Called when the WebSocket connects (onopen). */
  onConnect(callback: () => void) {
    this.onConnectCallbacks.push(callback);
  }

  /** Called when the WebSocket disconnects (onclose, before reconnect). */
  onDisconnect(callback: () => void) {
    this.onDisconnectCallbacks.push(callback);
  }

  /** Packet types whose payloads should be redacted from console logs. */
  private SENSITIVE_PACKET_TYPES = new Set(["LoginRequest"]);

  /**
   * Sends a message to the server.
   * The 'packet' object already contains 'type' and 'payload' properties
   * which matches the Rust backend's #[serde(tag = "type", content = "payload")] requirement.
   */
  send(packet: ClientToServer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(packet);
      if (this.SENSITIVE_PACKET_TYPES.has(packet.type)) {
        console.log("OUTGOING:", packet.type, "[payload redacted]");
      } else {
        console.log("OUTGOING:", message);
      }
      this.socket.send(message);
    } else {
      console.warn("Socket not open. Packet dropped:", packet.type);
    }
  }

  onMessage(callback: (data: ServerToClient) => void) {
    this.onMessageCallbacks.push(callback);
  }
}

export const socket = new GameSocket();