import { socket } from "../socket";
import { eventBus } from "../utils/eventBus";

const ENTER_TO_CHAT_KEY = "ntk_enterToChat";

export class KeyboardManager {
  private keys: Set<string> = new Set();
  private lastMoveTime: number = 0;
  private moveCooldown: number = 120;

  /** When true (dialog open), movement keys are ignored. */
  public locked: boolean = false;

  /** When true (map transition in progress), movement keys are ignored. */
  public isInputLocked: boolean = false;

  /** When true, pressing Enter focuses the chat input. Toggled via SystemMenu. */
  private enterToChat: boolean = true;

  private unsubs: (() => void)[] = [];
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  constructor() {
    // Load enterToChat preference from localStorage
    const stored = localStorage.getItem(ENTER_TO_CHAT_KEY);
    if (stored !== null) {
      this.enterToChat = stored === "true";
    }

    this.keydownHandler = (e: KeyboardEvent) => {
      this.keys.add(e.code);

      // ─── F1: Toggle System Menu ─────────────────────────────────
      if (e.code === "F1") {
        e.preventDefault();
        eventBus.emit("ToggleSystemMenu");
        return;
      }

      // ─── Enter / Quote: Focus Chat Input ────────────────────────
      // Only when NOT already focused on another input/textarea
      const isChatFocused = this.isChatInputFocused();
      if (!isChatFocused && !this.locked && !this.isInputLocked) {
        if (e.code === "Enter" && this.enterToChat) {
          e.preventDefault();
          eventBus.emit("FocusChatInput");
          return;
        }
        if (e.code === "Quote") {
          e.preventDefault();
          eventBus.emit("FocusChatInput");
          return;
        }
      }

      // ─── Hotbar keys (1-9, 0) ───────────────────────────────────
      // Only fire if the chat input is NOT focused
      if (!isChatFocused && !this.locked && !this.isInputLocked) {
        const hotbarSlot = this.mapCodeToHotbarSlot(e.code, e.shiftKey);
        if (hotbarSlot !== -1) {
          e.preventDefault(); // Prevent browser scroll/tab behavior
          eventBus.emit("HotbarSlot", { slot: hotbarSlot });
          return;
        }
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);

    // Listen for map transition events to lock/unlock input
    this.unsubs.push(
      eventBus.on("MapTransitionStart", () => {
        this.isInputLocked = true;
      }),
      eventBus.on("MapTransitionComplete", () => {
        this.isInputLocked = false;
      })
    );

    // Listen for enterToChat setting changes from the SystemMenu
    this.unsubs.push(
      eventBus.on("EnterToChatChanged", (data) => {
        this.enterToChat = data.enabled;
        localStorage.setItem(ENTER_TO_CHAT_KEY, String(data.enabled));
      })
    );
  }

  /**
   * Checks whether the user is currently typing in the chat input.
   * If so, movement and hotbar keys must NOT fire.
   */
  private isChatInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    // Also check for contenteditable
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }

  /**
   * Maps a KeyboardEvent.code + shift state to a hotbar slot (0–19).
   *   Digit1–Digit9  → slots 0–8   (displayed as "1"–"9")
   *   Digit0          → slot 9     (displayed as "0")
   *   Shift+Digit1–9  → slots 10–18 (displayed as "S1"–"S9")
   *   Shift+Digit0    → slot 19    (displayed as "S0")
   * Returns -1 if the key is not a hotbar key.
   */
  private mapCodeToHotbarSlot(code: string, shift: boolean): number {
    const match = code.match(/^Digit([0-9])$/);
    if (!match) return -1;
    const digit = parseInt(match[1], 10);
    const baseSlot = digit === 0 ? 9 : digit - 1; // 1→0, 2→1, …, 9→8, 0→9
    return shift ? baseSlot + 10 : baseSlot;
  }

  /**
   * Checks for movement keys and triggers the callback if a move is allowed.
   * Movement is blocked while `locked` is true (dialog lock),
   * `isInputLocked` is true (map transition), OR the chat input is focused.
   */
  update(onMove: (direction: number) => void) {
    if (this.locked || this.isInputLocked) return;

    // CRITICAL: Don't move the character while typing in chat
    if (this.isChatInputFocused()) return;

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

  /** Returns the current enterToChat setting. */
  getEnterToChat(): boolean {
    return this.enterToChat;
  }

  destroy() {
    window.removeEventListener("keydown", this.keydownHandler);
    window.removeEventListener("keyup", this.keyupHandler);
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }
}