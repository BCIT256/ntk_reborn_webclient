import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";

// Direction enum matching server protocol: 0=Up, 1=Right, 2=Down, 3=Left
const DIRECTION_NAMES = ["up", "right", "down", "left"] as const;

const MOVE_SPEED = 200; // pixels per second for smooth interpolation
const SNAP_THRESHOLD = 0.5; // pixels — snap when this close to target

type MovementState = "idle" | "walking";

/**
 * Fallback type determines which placeholder sprite to draw when
 * no spritesheet atlas is available for the entity's graphic_id.
 */
export type FallbackType = "player" | "mob" | "npc";

export interface EntityConfig {
  entityId: number;
  name: string;
  /** graphic_id from SpawnCharacter.gfx — selects which spritesheet to use. */
  graphicId?: string;
  /** If true, this is the local player entity. */
  isLocalPlayer?: boolean;
  /** Fallback sprite colour when atlas is not used. */
  fallbackColor?: number;
  /** What kind of fallback placeholder to use. */
  fallbackType?: FallbackType;
  /** Tint colour for the name tag text (from SpawnCharacter.name_color). */
  nameColor?: number;
}

export class EntityRenderer {
  private container: PIXI.Container;
  private sprite: PIXI.AnimatedSprite;
  private nameTag: PIXI.Text;

  readonly entityId: number;
  readonly graphicId: string;

  // Smooth-movement state
  // visualX / visualY represent the CONTAINER's world position in pixels.
  // The sprite itself stays at (0, 0) inside the container so the nameTag
  // (positioned relative to the container) follows the entity automatically.
  private visualX: number = 0;
  private visualY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

  // Animation state machine
  private direction: number = 2; // default: facing down
  private movementState: MovementState = "idle";
  private currentAnimationKey: string = "";

  // Cached animation frame arrays keyed by "action_direction"
  private animationCache: Map<string, PIXI.Texture[]> = new Map();

  private TILE_SIZE: number = 32;
  private usingAtlas: boolean = false;
  private isLocalPlayer: boolean;

  constructor(cameraContainer: PIXI.Container, config: EntityConfig) {
    this.entityId = config.entityId;
    this.isLocalPlayer = config.isLocalPlayer ?? false;
    this.graphicId = config.graphicId ?? (this.isLocalPlayer ? "player_base" : "mob");

    this.container = new PIXI.Container();
    cameraContainer.addChild(this.container);

    // Determine which spritesheet to use.
    // 1) If graphicId has a loaded spritesheet → use it
    // 2) Else if local player and "player_base" is loaded → use that
    // 3) Else → fallback placeholder
    const resolvedGraphicId = this.resolveGraphicId();
    this.usingAtlas = resolvedGraphicId !== null;

    if (this.usingAtlas) {
      this.buildAnimationCache(resolvedGraphicId!);
      const frames = this.getFrames("idle", "down");
      if (frames.length > 0) {
        this.sprite = new PIXI.AnimatedSprite(frames);
        this.sprite.animationSpeed = 0.15;
        this.sprite.loop = true;
        this.currentAnimationKey = "idle_down";
        this.sprite.play();
      } else {
        console.warn(`Atlas ${resolvedGraphicId} loaded but no idle_down frames — using fallback`);
        this.usingAtlas = false;
        this.sprite = this.createFallbackAnimatedSprite(
          config.fallbackColor ?? 0x4488ff,
          config.fallbackType ?? (this.isLocalPlayer ? "player" : "mob")
        );
      }
    } else {
      const color = config.fallbackColor ?? (this.isLocalPlayer ? 0xff0000 : 0x4488ff);
      this.sprite = this.createFallbackAnimatedSprite(
        color,
        config.fallbackType ?? (this.isLocalPlayer ? "player" : "mob")
      );
    }

    // Sprite sits at (0,0) inside the container — the container moves instead
    this.sprite.x = 0;
    this.sprite.y = 0;
    this.container.addChild(this.sprite);

    // ─── Name tag ───────────────────────────────────────────────────
    const tagColor = config.nameColor
      ? `#${config.nameColor.toString(16).padStart(6, "0")}`
      : "#ffffff";
    this.nameTag = new PIXI.Text(config.name, {
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
      fill: tagColor,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
    } as PIXI.TextStyle);
    this.nameTag.anchor.set(0.5, 1);
    // Positioned relative to the container (which moves with the entity)
    this.nameTag.x = this.TILE_SIZE / 2;
    this.nameTag.y = -4;
    this.container.addChild(this.nameTag);
  }

  // ─── Public API ─────────────────────────────────────────────────────

  handleResync(x: number, y: number) {
    if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;

    // Convert grid coordinates → pixel values
    this.targetX = x * this.TILE_SIZE;
    this.targetY = y * this.TILE_SIZE;

    // Snap instantly to the authoritative server position
    this.visualX = this.targetX;
    this.visualY = this.targetY;

    // Immediately update the container's position so rendering is correct this frame
    this.container.x = this.visualX;
    this.container.y = this.visualY;

    this.setIdle();
  }

  /**
   * Move to an explicit target tile (used by EntityMove for remote entities).
   * Interpolates smoothly from current visual position to the given tile.
   */
  moveToTarget(x: number, y: number, direction: number) {
    this.direction = direction;
    const newTargetX = x * this.TILE_SIZE;
    const newTargetY = y * this.TILE_SIZE;

    // If already at this exact tile, just face the direction — don't walk in place
    const dx = newTargetX - this.visualX;
    const dy = newTargetY - this.visualY;
    if (Math.sqrt(dx * dx + dy * dy) <= SNAP_THRESHOLD) {
      this.targetX = newTargetX;
      this.targetY = newTargetY;
      this.setIdle();
      return;
    }

    this.targetX = newTargetX;
    this.targetY = newTargetY;
    this.setWalking();
  }

  predictMove(direction: number) {
    // 0: Up, 1: Right, 2: Down, 3: Left
    this.direction = direction;

    if (direction === 0) this.targetY -= this.TILE_SIZE;
    if (direction === 1) this.targetX += this.TILE_SIZE;
    if (direction === 2) this.targetY += this.TILE_SIZE;
    if (direction === 3) this.targetX -= this.TILE_SIZE;

    this.setWalking();
  }

  /**
   * Called every frame from the game ticker to drive smooth interpolation
   * and animation state transitions.
   */
  update(dt: number) {
    const dx = this.targetX - this.visualX;
    const dy = this.targetY - this.visualY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > SNAP_THRESHOLD) {
      // Still moving — interpolate toward the target
      const step = Math.min(MOVE_SPEED * dt, dist);
      this.visualX += (dx / dist) * step;
      this.visualY += (dy / dist) * step;
    } else {
      // At (or very close to) the target — snap and ensure idle
      this.visualX = this.targetX;
      this.visualY = this.targetY;

      if (this.movementState === "walking") {
        this.setIdle();
      }
    }

    // Move the container to the world position; sprite stays at (0,0) inside it
    this.container.x = this.visualX;
    this.container.y = this.visualY;
  }

  getPlayerPosition() {
    return { x: this.visualX, y: this.visualY };
  }

  /** Expose the entity's PIXI container so FX sprites can be attached. */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /** Remove this entity from the stage and clean up. */
  destroy() {
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }

  // ─── Graphic resolution ───────────────────────────────────────────

  /**
   * Resolve which graphic_id spritesheet to use for this entity.
   * Returns null if no atlas is available (use fallback instead).
   */
  private resolveGraphicId(): string | null {
    // 1. Direct match on the entity's graphicId
    if (this.graphicId && assetManager.hasEntitySpritesheet(this.graphicId)) {
      return this.graphicId;
    }

    // 2. Local player always tries "player_base"
    if (this.isLocalPlayer && assetManager.hasSpritesheet("player_base")) {
      return "player_base";
    }

    // 3. No atlas available
    return null;
  }

  // ─── Animation state machine ───────────────────────────────────────

  private setWalking() {
    this.movementState = "walking";
    const dirName = DIRECTION_NAMES[this.direction];
    this.switchAnimation("walk", dirName);
  }

  private setIdle() {
    this.movementState = "idle";
    const dirName = DIRECTION_NAMES[this.direction];
    this.switchAnimation("idle", dirName);
  }

  private switchAnimation(action: string, directionName: string) {
    if (!this.usingAtlas) return;

    const key = `${action}_${directionName}`;
    if (key === this.currentAnimationKey) return;
    this.currentAnimationKey = key;

    const frames = this.getFrames(action, directionName);
    if (frames.length > 0) {
      this.sprite.textures = frames;
      this.sprite.gotoAndPlay(0);
    }
  }

  // ─── Spritesheet helpers ────────────────────────────────────────────

  private buildAnimationCache(graphicId: string) {
    for (const dirName of DIRECTION_NAMES) {
      const idleFrames = assetManager.getEntityFrames(graphicId, "idle", dirName);
      if (idleFrames.length > 0) {
        this.animationCache.set(`idle_${dirName}`, idleFrames);
      }
      const walkFrames = assetManager.getEntityFrames(graphicId, "walk", dirName);
      if (walkFrames.length > 0) {
        this.animationCache.set(`walk_${dirName}`, walkFrames);
      }
    }
    console.log(
      `Built animation cache for ${graphicId}: ${this.animationCache.size} animation sets`
    );
  }

  private getFrames(action: string, direction: string): PIXI.Texture[] {
    return this.animationCache.get(`${action}_${direction}`) || [];
  }

  // ─── Fallback (no atlas) ────────────────────────────────────────────

  private createFallbackAnimatedSprite(color: number, type: FallbackType): PIXI.AnimatedSprite {
    const canvas = document.createElement("canvas");
    canvas.width = this.TILE_SIZE;
    canvas.height = this.TILE_SIZE;
    const ctx = canvas.getContext("2d")!;

    const hex = "#" + color.toString(16).padStart(6, "0");

    if (type === "player") {
      // Humanoid shape with head + body
      ctx.fillStyle = hex;
      // Body
      const margin = 6;
      const bodyW = this.TILE_SIZE - margin * 2;
      const bodyH = this.TILE_SIZE - margin * 2;
      ctx.fillRect(margin, margin, bodyW, bodyH);
      // Outline
      ctx.fillStyle = "#000000";
      ctx.fillRect(margin, margin, bodyW, 2);
      ctx.fillRect(margin, margin + bodyH - 2, bodyW, 2);
      ctx.fillRect(margin, margin, 2, bodyH);
      ctx.fillRect(margin + bodyW - 2, margin, 2, bodyH);
      // Eyes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.TILE_SIZE / 2 - 5, margin + 6, 3, 3);
      ctx.fillRect(this.TILE_SIZE / 2 + 2, margin + 6, 3, 3);
    } else if (type === "npc") {
      // NPC: green-tinted humanoid with a hat marker
      ctx.fillStyle = hex;
      const margin = 6;
      const bodyW = this.TILE_SIZE - margin * 2;
      const bodyH = this.TILE_SIZE - margin * 2;
      ctx.fillRect(margin, margin, bodyW, bodyH);
      // Hat triangle on top
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(this.TILE_SIZE / 2, margin - 6);
      ctx.lineTo(this.TILE_SIZE / 2 - 5, margin + 2);
      ctx.lineTo(this.TILE_SIZE / 2 + 5, margin + 2);
      ctx.closePath();
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.TILE_SIZE / 2 - 5, margin + 6, 3, 3);
      ctx.fillRect(this.TILE_SIZE / 2 + 2, margin + 6, 3, 3);
    } else {
      // Mob: blob-like shape
      ctx.fillStyle = hex;
      const cx = this.TILE_SIZE / 2;
      const cy = this.TILE_SIZE / 2 + 4;
      const rx = 10;
      const ry = 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes — angry slits
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(cx - 5, cy - 3, 4, 2);
      ctx.fillRect(cx + 1, cy - 3, 4, 2);
    }

    const texture = PIXI.Texture.from(canvas);
    return new PIXI.AnimatedSprite([texture]);
  }
}
