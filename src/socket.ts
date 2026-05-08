"use client";

import { ClientToServer, ServerToClient } from "./protocol";
import { md5 } from "./utils/md5";

class GameSocket {
  private socket: WebSocket | null = null;
  private url: string = "ws://localhost:2010";
  private onMessageCallbacks: ((data: ServerToClient) => void)[] = [];

  connect() {
    console.log(`Connecting to ${this.url}...`);
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("Connected to server.");
      
      // Use the custom MD5 implementation for the password hash
      const password = "test";
      const passwordHash = md5(password);

      // Sending LoginRequest using the required adjacent tagging format
      this.send({ 
        type: "LoginRequest", 
        payload: { 
          username: "Admin", 
          password_hash: passwordHash 
        } 
      });
    };

    this.socket.onmessage = (event) => {
      try {
        const data: ServerToClient = JSON.parse(event.data);
        console.log("INCOMING:", data.type, data.payload);
        this.onMessageCallbacks.forEach(cb => cb(data));
      } catch (e) {
        console.error("Failed to parse incoming packet:", event.data);
      }
    };

    this.socket.onclose = () => {
      console.log("Disconnected from server.");
      // Attempt reconnection
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
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