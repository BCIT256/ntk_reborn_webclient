import { socket } from "../socket";

export class KeyboardManager {
  private keys: Set<string> = new Set();
  private lastMoveTime: number = 0;
  private moveCooldown: number = 200;

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  update() {
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveCooldown) return;

    let direction = -1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) direction = 0;
    else if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) direction = 1;
    else if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) direction = 2;
    else if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) direction = 3;

    if (direction !== -1) {
      socket.send({ Move: { direction } });
      this.lastMoveTime = now;
    }
  }
}