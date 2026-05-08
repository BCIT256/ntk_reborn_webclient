import { socket } from "../socket";

export class KeyboardManager {
  private keys: Set<string> = new Set();
  private lastMoveTime: number = 0;
  private moveCooldown: number = 150; // Updated to 150ms as requested

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  /**
   * Checks for movement keys and triggers the callback if a move is allowed.
   */
  update(onMove: (direction: number) => void) {
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveCooldown) return;

    let direction = -1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) direction = 0;
    else if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) direction = 1;
    else if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) direction = 2;
    else if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) direction = 3;

    if (direction !== -1) {
      onMove(direction);
      this.lastMoveTime = now;
    }
  }
}