import * as PIXI from "pixi.js";

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
 * DamageNumberManager — spawns world-space floating damage numbers
 * when EntityHealthUpdate packets arrive with damage > 0.
 *
 * Lives inside the PixiJS camera container so numbers stay anchored
 * to entity world positions as the camera scrolls.
 */
export class DamageNumberManager {
  private container: PIXI.Container;
  private active: FloatingDamage[] = [];

  constructor(cameraContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    // Render above entities by placing at the top of the camera's child list
    // (we'll manage z-order by just ensuring this container is added last)
    cameraContainer.addChild(this.container);
  }

  /**
   * Spawn a floating damage number at the given world coordinates.
   * @param worldX  World X in pixels (not tile coords)
   * @param worldY  World Y in pixels
   * @param damage  Amount of damage to display
   * @param hitType  0=normal, 1=critical, 2=miss (future expansion)
   */
  spawn(worldX: number, worldY: number, damage: number, hitType: number = 0) {
    if (damage <= 0) return;

    const isCrit = hitType === 1;
    const fontSize = isCrit ? 18 : 14;
    const fill = isCrit ? "#fbbf24" : "#ff4444";
    const stroke = isCrit ? "#92400e" : "#7f1d1d";

    const text = new PIXI.Text(`-${damage}`, {
      fontFamily: "Arial, sans-serif",
      fontSize,
      fontWeight: "bold",
      fill,
      stroke,
      strokeThickness: 3,
      align: "center",
    } as PIXI.TextStyle);

    text.anchor.set(0.5, 1);
    // Position above the entity's head (centered on the tile, offset up)
    text.x = worldX + 16;
    text.y = worldY - 8;
    // Slight random horizontal jitter so stacking numbers don't overlap perfectly
    text.x += (Math.random() - 0.5) * 10;

    this.container.addChild(text);

    this.active.push({
      text,
      elapsed: 0,
      duration: isCrit ? 1.4 : 1.0,
      startY: text.y,
      driftSpeed: isCrit ? 40 : 30,
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
        // Remove completed damage number
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
