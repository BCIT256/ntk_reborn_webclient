import { socket } from "../socket";
import { eventBus } from "../utils/eventBus";

export class KeyboardManager {
  private keys: Set<string> = new Set();
  private lastMoveTime: number = 0;
  private moveCooldown: number = 150;

  /** When true (dialog open), movement keys are ignored. */
  public locked: boolean = false;

  /** When true (map transition in progress), movement keys are ignored. */
  public isInputLocked: boolean = false;

  private unsubs: (() => void)[] = [];

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    // Listen for map transition events to lock/unlock input
    this.unsubs.push(
      eventBus.on("MapTransitionStart", () => {
        this.isInputLocked = true;
      }),
      eventBus.on("MapTransitionComplete", () => {
        this.isInputLocked = false;
      })
    );
  }

  /**
   * Checks for movement keys and triggers the callback if a move is allowed.
   * Movement is blocked while `locked` is true (dialog lock)
   * or `isInputLocked` is true (map transition).
   */
  update(onMove: (direction: number) => void) {
    if (this.locked || this.isInputLocked) return;

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

  destroy() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }
}
