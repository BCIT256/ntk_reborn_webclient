import { eventBus, GameEvents } from "../utils/eventBus";

/**
 * HUDManager — DOM overlay that displays HP / MP / XP bars and a gold counter.
 * Styled to look like a polished in-game HUD with semi-transparent panels.
 *
 * Can receive vitals updates directly via handleVitalsUpdate() or
 * auto-subscribe to the EventBus for decoupled architecture.
 */
export class HUDManager {
  private root: HTMLElement;
  private hpBar!: HTMLElement;
  private mpBar!: HTMLElement;
  private xpBar!: HTMLElement;
  private hpText!: HTMLElement;
  private mpText!: HTMLElement;
  private xpText!: HTMLElement;
  private goldText!: HTMLElement;
  private levelText!: HTMLElement;

  private unsubscribe?: () => void;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "hud-overlay";
    Object.assign(this.root.style, {
      position: "absolute",
      top: "12px",
      left: "12px",
      zIndex: "20",
      pointerEvents: "none",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: "none",
    } as CSSStyleDeclaration);

    this.buildUI();
    document.body.appendChild(this.root);
  }

  // ─── EventBus auto-subscription ────────────────────────────────────

  /**
   * Subscribe to PlayerVitalsUpdate events on the EventBus.
   * Call this if you want the HUD to update automatically without
   * manual handleVitalsUpdate() calls.
   */
  subscribeToBus(): void {
    this.unsubscribe = eventBus.on("PlayerVitalsUpdate", (data) => {
      this.handleVitalsUpdate(data);
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────

  handleVitalsUpdate(data: GameEvents["PlayerVitalsUpdate"]) {
    // HP
    const hpPct = data.max_hp > 0 ? Math.min((data.hp / data.max_hp) * 100, 100) : 0;
    this.hpBar.style.width = `${hpPct}%`;
    this.hpText.textContent = `${data.hp} / ${data.max_hp}`;

    // MP
    const mpPct = data.max_mp > 0 ? Math.min((data.mp / data.max_mp) * 100, 100) : 0;
    this.mpBar.style.width = `${mpPct}%`;
    this.mpText.textContent = `${data.mp} / ${data.max_mp}`;

    // XP
    const xpPct = data.xp_next > 0 ? Math.min((data.xp / data.xp_next) * 100, 100) : 0;
    this.xpBar.style.width = `${xpPct}%`;
    this.xpText.textContent = `${data.xp} / ${data.xp_next}`;

    // Gold & Level
    this.goldText.textContent = `${data.gold.toLocaleString()}`;
    this.levelText.textContent = `Lv ${data.level}`;
  }

  destroy() {
    this.root.remove();
    this.unsubscribe?.();
  }

  // ─── DOM construction ───────────────────────────────────────────────

  private buildUI() {
    // Panel background
    const panel = this.el("div", {
      background: "rgba(10, 10, 20, 0.82)",
      borderRadius: "12px",
      padding: "14px 18px",
      minWidth: "220px",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
      backdropFilter: "blur(6px)",
    });

    // Level badge
    const levelRow = this.el("div", {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "10px",
    });
    this.levelText = this.el("span", {
      color: "#fbbf24",
      fontWeight: "700",
      fontSize: "14px",
      letterSpacing: "0.5px",
    });
    this.levelText.textContent = "Lv 1";
    const goldContainer = this.el("div", {
      display: "flex",
      alignItems: "center",
      gap: "5px",
    });
    const goldIcon = this.el("span", {
      color: "#fbbf24",
      fontSize: "14px",
    });
    goldIcon.textContent = "●"; // coin dot
    this.goldText = this.el("span", {
      color: "#fde68a",
      fontWeight: "600",
      fontSize: "13px",
    });
    this.goldText.textContent = "0";
    goldContainer.append(goldIcon, this.goldText);
    levelRow.append(this.levelText, goldContainer);

    // HP bar
    const hpSection = this.buildBarSection("HP", "#ef4444", "#dc2626");
    this.hpBar = hpSection.bar;
    this.hpText = hpSection.text;

    // MP bar
    const mpSection = this.buildBarSection("MP", "#3b82f6", "#2563eb");
    this.mpBar = mpSection.bar;
    this.mpText = mpSection.text;

    // XP bar
    const xpSection = this.buildBarSection("XP", "#f59e0b", "#d97706");
    this.xpBar = xpSection.bar;
    this.xpText = xpSection.text;

    panel.append(levelRow, hpSection.wrapper, mpSection.wrapper, xpSection.wrapper);
    this.root.appendChild(panel);
  }

  private buildBarSection(label: string, fillColor: string, darkColor: string) {
    const wrapper = this.el("div", { marginBottom: "8px" });

    const header = this.el("div", {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "3px",
    });

    const labelText = this.el("span", {
      color: "rgba(255,255,255,0.6)",
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "1px",
      textTransform: "uppercase" as string,
    });
    labelText.textContent = label;

    const text = this.el("span", {
      color: "rgba(255,255,255,0.75)",
      fontSize: "10px",
      fontWeight: "500",
    });
    text.textContent = "0 / 0";

    header.append(labelText, text);

    // Track
    const track = this.el("div", {
      width: "100%",
      height: "8px",
      background: "rgba(255,255,255,0.08)",
      borderRadius: "4px",
      overflow: "hidden",
      position: "relative",
    });

    // Fill
    const bar = this.el("div", {
      height: "100%",
      width: "0%",
      borderRadius: "4px",
      background: `linear-gradient(180deg, ${fillColor} 0%, ${darkColor} 100%)`,
      transition: "width 0.35s ease",
      boxShadow: `0 0 6px ${fillColor}66`,
    });

    track.appendChild(bar);
    wrapper.append(header, track);

    return { wrapper, bar, text };
  }

  private el(tag: string, styles: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    return element;
  }
}