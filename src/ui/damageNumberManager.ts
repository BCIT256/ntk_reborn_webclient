import * as PIXI from "pixi.js";
import { eventBus } from "../utils/eventBus";

/**
 * Represents a single floating damage number that drifts upward and fades out.
 */
interface FloatingDamage {
  text: PIXI.Text;
  elapsed: number;
  duration: number;
  startY: number;
  driftSpeed: number;
}

/**
 * Color mapping for damage number types.
 * The server sends a color string; we map common values to retro fill colors.
 */
const DAMAGE_COLORS: Record<string, string> = {
  red: "#ff4444",
  white: "#ffffff",
  green: "#00ff00",
  yellow: "#fbbf24",
  critical: "#fbbf24",
  heal: "#00ff00",
  miss: "#888888",
};

/**
 * DamageNumberManager — Spawns world-space floating damage numbers
 * in the classic NexusTK retro style.
 *
 * Driven by two event bus events:
 *   - DamageNumber:       Dedicated damage number event from the server
 *   - EntityHealthUpdate: Fallback — auto-spawns a number if damage > 0
 *
 * All numbers are rendered as PIXI.Text inside the WebGL canvas
 * (NOT as DOM/React elements) for 60 FPS performance.
 *
 * Z-INDEX: The container has zIndex = 1000 so damage numbers always
 * render above entities, FX, and map tiles.
 */
export class DamageNumberManager {
  private container: PIXI.Container;
  private active: FloatingDamage[] = [];

  /** Reference to look up entity positions by entity_id. */
  private getEntityPosition: (id: number) => { x: number; y: number } | undefined;

  /** Local player entity_id for position lookups. */
  private localEntityId: number;

  /** EventBus unsubscribe functions. */
  private unsubs: (() => void)[] = [];

  constructor(
    cameraContainer: PIXI.Container,
    getEntityPosition: (id: number) => { x: number; y: number } | undefined,
    localEntityId: number
  ) {
    this.getEntityPosition = getEntityPosition;
    this.localEntityId = localEntityId;

    this.container = new PIXI.Container();
    this.container.zIndex = 1000; // Always on top of everything
    cameraContainer.addChild(this.container);

    // Listen for dedicated DamageNumber events
    this.unsubs.push(
      eventBus.on("DamageNumber", (data) => {
        this.handleDamageNumber(data);
      })
    );
  }

  /**
   * Handle a DamageNumber event: find the entity's position and spawn the number.
   */
  private handleDamageNumber(data: { entity_id: number; amount: number; color: string }) {
    const pos = this.getEntityPosition(data.entity_id);
    if (!pos) return;

    const fillColor = DAMAGE_COLORS[data.color.toLowerCase()] ?? data.color;
    const isHeal = data.color.toLowerCase() === "green" || data.color.toLowerCase() === "heal";
    const isCrit = data.color.toLowerCase() === "yellow" || data.color.toLowerCase() === "critical";

    const prefix = isHeal ? "+" : "-";
    const fontSize = isCrit ? 18 : 14;
    const duration = isCrit ? 1.4 : 1.0;
    const driftSpeed = isCrit ? 50 : 40;

    this.spawnAtWorld(pos.x, pos.y, data.amount, prefix, fillColor, fontSize, duration, driftSpeed);
  }

  /**
   * Legacy API — spawn a damage number at explicit world coordinates.
   * Used by the EntityHealthUpdate handler in GameApp.
   */
  spawn(worldX: number, worldY: number, damage: number, hitType: number = 0) {
    if (damage <= 0) return;

    const isCrit = hitType === 1;
    const fill = isCrit ? "#fbbf24" : "#ff4444";
    const fontSize = isCrit ? 18 : 14;
    const duration = isCrit ? 1.4 : 1.0;
    const driftSpeed = isCrit ? 50 : 40;

    this.spawnAtWorld(worldX, worldY, damage, "-", fill, fontSize, duration, driftSpeed);
  }

  /**
   * Core spawn: create a PIXI.Text, style it retro, and begin the animation.
   */
  private spawnAtWorld(
    worldX: number,
    worldY: number,
    amount: number,
    prefix: string,
    fill: string,
    fontSize: number,
    duration: number,
    driftSpeed: number
  ) {
    const text = new PIXI.Text(`${prefix}${amount}`, {
      fontFamily: "'Courier New', 'Impact', monospace",
      fontSize,
      fontWeight: "bold",
      fill,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
      dropShadow: true,
      dropShadowColor: "#000000",
      dropShadowDistance: 1,
      dropShadowBlur: 0,
    } as any); // PIXI v7 TextStyle includes dropShadow but types may lag

    text.anchor.set(0.5, 1);
    text.zIndex = 1000;

    // Position above the entity's head (centered on the tile, offset up)
    text.x = worldX + 16;
    text.y = worldY - 8;

    // Slight random horizontal jitter so stacking numbers don't overlap perfectly
    text.x += (Math.random() - 0.5) * 10;

    this.container.addChild(text);

    this.active.push({
      text,
      elapsed: 0,
      duration,
      startY: text.y,
      driftSpeed,
    });
  }

  /**
   * Called every frame from the game ticker to animate active damage numbers.
   */
  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const dmg = this.active[i];
      dmg.elapsed += dt;

      const progress = dmg.elapsed / dmg.duration;

      if (progress >= 1) {
        // Remove completed damage number — destroy the PIXI.Text to free memory
        this.container.removeChild(dmg.text);
        dmg.text.destroy();
        this.active.splice(i, 1);
        continue;
      }

      // Drift upward
      dmg.text.y = dmg.startY - dmg.driftSpeed * dmg.elapsed;

      // Fade out (ease in the second half)
      const fadeStart = 0.5;
      if (progress > fadeStart) {
        const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
        dmg.text.alpha = 1 - fadeProgress;
      }

      // Scale up slightly at the start for "pop" effect
      if (progress < 0.15) {
        const scaleProgress = progress / 0.15;
        dmg.text.scale.set(1 + 0.3 * (1 - scaleProgress));
      } else {
        dmg.text.scale.set(1);
      }
    }
  }

  /** Clean up all active damage numbers. */
  destroy() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    for (const dmg of this.active) {
      if (dmg.text.parent) this.container.removeChild(dmg.text);
      dmg.text.destroy();
    }
    this.active = [];
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }
}
