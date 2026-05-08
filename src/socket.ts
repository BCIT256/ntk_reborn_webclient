"use client";

import { ClientToServer, ServerToClient } from "./protocol";

class GameSocket {
  private socket: WebSocket | null = null;
  private url: string = "ws://localhost:2010";
  private onMessageCallbacks: ((data: ServerToClient) => void)[] = [];
  private onConnectionLostCallbacks: (() => void)[] = [];

  /** The entity_id of the local player, set by LoginSuccess. */
  public localEntityId: number | null = null;

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
      // Reset retry state on successful connection
      this.retryCount = 0;
      this.reconnectStartTime = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data: ServerToClient = JSON.parse(event.data);
        console.log("INCOMING:", data.type, data.payload);
        if (data.type === "LoginSuccess") {
          this.localEntityId = data.payload.entity_id;
        }
        this.onMessageCallbacks.forEach(cb => cb(data));
      } catch (e) {
        console.error("Failed to parse incoming packet:", event.data);
      }
    };

    this.socket.onclose = () => {
      console.log("Disconnected from server.");
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

  /**
   * Sends a message to the server.
   * The 'packet' object already contains 'type' and 'payload' properties
   * which matches the Rust backend's #[serde(tag = "type", content = "payload")] requirement.
   */
  send(packet: ClientToServer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(packet);
      console.log("OUTGOING:", message);
      this.socket.send(message);
    } else {
      console.warn("Socket not open. Packet dropped:", packet);
    }
  }

  onMessage(callback: (data: ServerToClient) => void) {
    this.onMessageCallbacks.push(callback);
  }
}

export const socket = new GameSocket();