import { ClientToServer, ServerToClient } from "./protocol";

class GameSocket {
  private socket: WebSocket | null = null;
  private url: string = "ws://localhost:2010";
  private onMessageCallbacks: ((data: ServerToClient) => void)[] = [];

  connect() {
    console.log(`Connecting to ${this.url}...`);
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("Connected to server.");
      this.send({ LoginRequest: { username: "TestUser", password_hash: "" } });
    };

    this.socket.onmessage = (event) => {
      try {
        const data: ServerToClient = JSON.parse(event.data);
        console.log("INCOMING:", data);
        this.onMessageCallbacks.forEach(cb => cb(data));
      } catch (e) {
        console.error("Failed to parse incoming packet:", event.data);
      }
    };

    this.socket.onclose = () => {
      console.log("Disconnected from server.");
      // Attempt reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  }

  send(packet: ClientToServer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log("OUTGOING:", packet);
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