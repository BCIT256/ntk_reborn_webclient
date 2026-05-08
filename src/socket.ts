import { ClientToServer, ServerToClient } from "./protocol";
import MD5 from "crypto-js/md5";

class GameSocket {
  private socket: WebSocket | null = null;
  private url: string = "ws://localhost:2010";
  private onMessageCallbacks: ((data: ServerToClient) => void)[] = [];

  connect() {
    console.log(`Connecting to ${this.url}...`);
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("Connected to server.");
      
      // Calculate MD5 hash of the password
      const password = "test";
      const passwordHash = MD5(password).toString();

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
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  }

  send(packet: ClientToServer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log("OUTGOING:", packet.type, packet.payload);
      this.socket.send(JSON.stringify(packet));
    } else {
      console.warn("Socket not open. Packet dropped:", packet);
    }
  }

  onMessage(callback: (data: ServerToClient) => void) {
    this.onMessageCallbacks.push(callback);
  }
}

export const socket = new GameSocket();