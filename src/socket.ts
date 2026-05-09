"use client";

import { ClientToServer, ServerToClient } from "./protocol";
import { eventBus } from "./utils/eventBus";

/** Event types that must be buffered until GameApp flushes them. */
const BUFFERED_EVENT_TYPES = new Set<string>([
  "SpawnCharacter",
  "EntityMove",
  "EntityRemove",
  "ChatNormal",
]);

export const entityNameCache = new Map<number, string>();

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

  /**
   * Buffer for game-critical events that arrive before GameApp
   * has subscribed to the eventBus. Once GameApp calls flushEventBuffer(),
   * these are replayed and subsequent events go directly to the eventBus.
   */
  private eventBuffer: ServerToClient[] = [];
  private bufferActive: boolean = true;

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log("Socket already open or connecting. Aborting connect attempt.");
      return;
    }

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
          this.localEntityId = Number(data.payload.entity_id);
        }

        // ─── Forward ALL server packets to the EventBus ──────────────
        this.forwardToEventBus(data);

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

  /**
   * Bridges incoming server packets to the EventBus so all game systems
   * (entity manager, UI, chat, etc.) receive events immediately.
   *
   * Critical game events (SpawnCharacter, EntityMove, EntityRemove, ChatNormal)
   * are ALSO buffered until flushEventBuffer() is called, so GameApp can
   * receive events that arrived before it subscribed.
   */
  private forwardToEventBus(packet: ServerToClient) {
    // Always emit immediately for any listeners that are already subscribed
    // (e.g., React components like BottomHUD for SystemMessage)
    switch (packet.type) {
      case "MapChange":
        if (packet.payload.objects) {
          packet.payload.objects.forEach((obj: any) => {
            if (obj.entity_id && obj.name) {
              entityNameCache.set(Number(obj.entity_id), obj.name);
            }
          });
        }
        eventBus.emit("MapTransitionStart", { map_id: packet.payload.map_id });
        eventBus.emit("MapChange", packet.payload);
        break;
      case "PlayerPosition":
        eventBus.emit("PlayerPosition", packet.payload);
        break;
      case "SpawnCharacter":
        entityNameCache.set(Number(packet.payload.entity_id), packet.payload.name);
        eventBus.emit("SpawnCharacter", packet.payload);
        break;
      case "EntityMove":
        eventBus.emit("EntityMove", packet.payload);
        break;
      case "EntityRemove":
        eventBus.emit("EntityRemove", packet.payload);
        break;
      case "EntityHealthUpdate":
        eventBus.emit("EntityHealthUpdate", packet.payload);
        break;
      case "PlayerVitalsUpdate":
        eventBus.emit("PlayerVitalsUpdate", packet.payload);
        break;
      case "DialogPopup":
        eventBus.emit("DialogPopup", packet.payload);
        break;
      case "ShowMenu":
        eventBus.emit("ShowMenu", packet.payload);
        break;
      case "SystemMessage":
        eventBus.emit("SystemMessage", packet.payload);
        break;
      case "ChatNormal":
        eventBus.emit("ChatNormal", { ...packet.payload, entity_id: Number(packet.payload.entity_id) });
        break;
      case "InventoryUpdate":
        eventBus.emit("InventoryUpdate", packet.payload);
        break;
      case "SpellListUpdate":
        eventBus.emit("SpellListUpdate", packet.payload);
        break;
      case "PlaySound":
        eventBus.emit("PlaySound", packet.payload);
        break;
      case "PlayAnimation":
        eventBus.emit("PlayAnimation", packet.payload);
        break;
      case "DamageNumber":
        eventBus.emit("DamageNumber", packet.payload);
        break;
    }

    // Also buffer critical game events so GameApp can replay them after subscribing
    if (this.bufferActive && BUFFERED_EVENT_TYPES.has(packet.type)) {
      this.eventBuffer.push(packet);
    }
  }

  /**
   * Called by GameApp after it has subscribed to all eventBus events.
   * Replays any buffered SpawnCharacter/EntityMove/EntityRemove/ChatNormal
   * events so entities that spawned before GameApp was ready appear correctly.
   */
  flushEventBuffer() {
    this.bufferActive = false;
    if (this.eventBuffer.length === 0) return;

    console.log(`[Socket] Flushing ${this.eventBuffer.length} buffered events to eventBus`);
    for (const packet of this.eventBuffer) {
      switch (packet.type) {
        case "SpawnCharacter":
          eventBus.emit("SpawnCharacter", packet.payload);
          break;
        case "EntityMove":
          eventBus.emit("EntityMove", packet.payload);
          break;
        case "EntityRemove":
          eventBus.emit("EntityRemove", packet.payload);
          break;
        case "ChatNormal":
          eventBus.emit("ChatNormal", { ...packet.payload, entity_id: Number(packet.payload.entity_id) });
          break;
      }
    }
    this.eventBuffer = [];
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

  /** Close the WebSocket and stop reconnecting. */
  disconnect() {
    this.resetRetryState();
    // Re-enable buffering for next session
    this.bufferActive = true;
    this.eventBuffer = [];
    if (this.socket) {
      this.socket.onclose = null; // Prevent auto-reconnect
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.localEntityId = null;
  }
}

export const socket = new GameSocket();