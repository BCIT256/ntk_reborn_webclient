import { socket } from "../socket";
import { KeyboardManager } from "../inputs/keyboard";
import { eventBus, GameEvents } from "../utils/eventBus";

/**
 * DialogManager — Handles DialogPopup and ShowMenu packets.
 * Renders a centered dialog overlay. While open, keyboard movement is locked.
 * Clicking a menu option sends MenuResponse back via WebSocket.
 *
 * Can receive data directly via handleDialogPopup/handleShowMenu or
 * auto-subscribe to the EventBus for decoupled architecture.
 */
export class DialogManager {
  private root: HTMLElement;
  private backdrop: HTMLElement;
  private dialogBox: HTMLElement;
  private headerEl: HTMLElement;
  private messageEl: HTMLElement;
  private optionsEl: HTMLElement;
  private keyboard: KeyboardManager | null = null;

  private currentNpcId: number | null = null;
  private isOpen: boolean = false;

  /** Tracks whether the current dialog is a menu (vs. a simple NPC dialog). */
  private isMenu: boolean = false;

  /** Unsubscribe functions for EventBus listeners. */
  private unsubs: (() => void)[] = [];

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "dialog-overlay";
    Object.assign(this.root.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "30",
      display: "none",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: "none",
    } as CSSStyleDeclaration);

    // Semi-transparent backdrop
    this.backdrop = this.el("div", {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0, 0, 0, 0.45)",
    });

    // Dialog box
    this.dialogBox = this.el("div", {
      position: "relative",
      zIndex: "1",
      background: "rgba(15, 15, 25, 0.94)",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)",
      minWidth: "300px",
      maxWidth: "460px",
      padding: "0",
      overflow: "hidden",
    });

    // Header (NPC name)
    this.headerEl = this.el("div", {
      padding: "14px 20px",
      background: "rgba(255,255,255,0.04)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      color: "#fbbf24",
      fontWeight: "700",
      fontSize: "15px",
      letterSpacing: "0.3px",
    });

    // Message body
    this.messageEl = this.el("div", {
      padding: "18px 20px",
      color: "rgba(255,255,255,0.88)",
      fontSize: "14px",
      lineHeight: "1.6",
    });

    // Options container
    this.optionsEl = this.el("div", {
      padding: "4px 16px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    this.dialogBox.append(this.headerEl, this.messageEl, this.optionsEl);
    this.root.append(this.backdrop, this.dialogBox);
    document.body.appendChild(this.root);

    // Close on backdrop click (dismisses the dialog / sends default response)
    this.backdrop.addEventListener("click", () => this.close());
  }

  // ─── Keyboard integration ────────────────────────────────────────────

  setKeyboardManager(kb: KeyboardManager) {
    this.keyboard = kb;
  }

  // ─── EventBus auto-subscription ────────────────────────────────────

  /**
   * Subscribe to DialogPopup and ShowMenu events on the EventBus.
   * Call this if you want the dialog to appear automatically without
   * manual handleDialogPopup/handleShowMenu calls.
   */
  subscribeToBus(): void {
    this.unsubs.push(
      eventBus.on("DialogPopup", (data) => this.handleDialogPopup(data)),
      eventBus.on("ShowMenu", (data) => this.handleShowMenu(data))
    );
  }

  // ─── Packet handlers ────────────────────────────────────────────────

  handleDialogPopup(data: { npc_id: number; name: string; message: string }) {
    this.currentNpcId = data.npc_id;
    this.isMenu = false;
    this.headerEl.textContent = data.name;
    this.messageEl.textContent = data.message;
    this.optionsEl.innerHTML = "";

    // Simple "Continue" button to close and send DialogResponse
    const continueBtn = this.makeOptionButton("Continue", 0);
    this.optionsEl.appendChild(continueBtn);

    this.show();
  }

  handleShowMenu(data: { message: string; options: string[] }) {
    this.currentNpcId = null;
    this.isMenu = true;
    this.headerEl.textContent = "Choose an option";
    this.messageEl.textContent = data.message;
    this.optionsEl.innerHTML = "";

    data.options.forEach((optionText, index) => {
      const btn = this.makeOptionButton(optionText, index);
      this.optionsEl.appendChild(btn);
    });

    this.show();
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private makeOptionButton(label: string, index: number): HTMLElement {
    const btn = this.el("button", {
      display: "block",
      width: "100%",
      padding: "10px 16px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px",
      color: "rgba(255,255,255,0.9)",
      fontSize: "13px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background 0.15s, border-color 0.15s",
      textAlign: "left" as string,
      pointerEvents: "auto",
    });
    btn.textContent = label;

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(59,130,246,0.25)";
      btn.style.borderColor = "rgba(59,130,246,0.4)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(255,255,255,0.06)";
      btn.style.borderColor = "rgba(255,255,255,0.08)";
    });

    btn.addEventListener("click", () => {
      this.sendResponse(index);
      this.close();
    });

    return btn;
  }

  private sendResponse(selectedIndex: number) {
    if (this.isMenu) {
      socket.send({
        type: "MenuResponse",
        payload: {
          selected_index: selectedIndex,
        },
      });
    } else if (this.currentNpcId !== null) {
      socket.send({
        type: "DialogResponse",
        payload: {
          npc_id: this.currentNpcId,
          selected_index: selectedIndex,
        },
      });
    }
  }

  private show() {
    this.isOpen = true;
    this.root.style.display = "flex";
    if (this.keyboard) this.keyboard.locked = true;
  }

  private close() {
    this.isOpen = false;
    this.root.style.display = "none";
    this.currentNpcId = null;
    if (this.keyboard) this.keyboard.locked = false;
  }

  private el(tag: string, styles: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    return element;
  }

  destroy() {
    if (this.keyboard) this.keyboard.locked = false;
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.root.remove();
  }
}