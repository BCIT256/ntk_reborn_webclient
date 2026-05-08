import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";

// Direction enum matching server protocol: 0=Up, 1=Right, 2=Down, 3=Left
const DIRECTION_NAMES = ["up", "right", "down", "left"] as const;

const MOVE_SPEED = 200; // pixels per second for smooth interpolation
const SNAP_THRESHOLD = 0.5; // pixels — snap when this close to target

type MovementState = "idle" | "walking";

export interface EntityConfig {
  entityId: number;
  name: string;
  /** If true, build animations from the player atlas. */
  isLocalPlayer?: boolean;
  /** Fallback sprite colour when atlas is not used. */
  fallbackColor?: number;
  /** Tint colour for the name tag text (from SpawnCharacter.name_color). */
  nameColor?: number;
}

export class EntityRenderer {
  private container: PIXI.Container;
  private sprite: PIXI.AnimatedSprite;
  private nameTag: PIXI.Text;

  readonly entityId: number;

  // Smooth-movement state
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

    this.container = new PIXI.Container();
    cameraContainer.addChild(this.container);

    // Build sprite — local player gets atlas animations, others get coloured fallback
    this.usingAtlas = this.isLocalPlayer && assetManager.hasSpritesheet("player_base");

    if (this.usingAtlas) {
      this.buildAnimationCache();
      const frames = this.getFrames("idle", "down");
      if (frames.length > 0) {
        this.sprite = new PIXI.AnimatedSprite(frames);
        this.sprite.animationSpeed = 0.15;
        this.sprite.loop = true;
        this.currentAnimationKey = "idle_down";
        this.sprite.play();
      } else {
        console.warn("Player atlas loaded but no idle_down frames — using fallback");
        this.usingAtlas = false;
        this.sprite = this.createFallbackAnimatedSprite(config.fallbackColor ?? 0xff0000);
      }
    } else {
      const color = config.fallbackColor ?? 0x4488ff; // default remote colour: blue
      this.sprite = this.createFallbackAnimatedSprite(color);
    }

    this.container.addChild(this.sprite);

    // ─── Name tag ───────────────────────────────────────────────────
    const tagColor = config.nameColor ? `#${config.nameColor.toString(16).padStart(6, "0")}` : "#ffffff";
    this.nameTag = new PIXI.Text(config.name, {
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
      fill: tagColor,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
    } as PIXI.TextStyle);
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.x = this.TILE_SIZE / 2;
    this.nameTag.y = -4;
    this.container.addChild(this.nameTag);
  }

  // ─── Public API ─────────────────────────────────────────────────────

  handleResync(x: number, y: number) {
    if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;

    this.targetX = x * this.TILE_SIZE;
    this.targetY = y * this.TILE_SIZE;

    // Snap instantly to the authoritative server position
    this.visualX = this.targetX;
    this.visualY = this.targetY;
    this.sprite.x = this.visualX;
    this.sprite.y = this.visualY;

    this.setIdle();
  }

  /**
   * Move to an explicit target tile (used by EntityMove for remote entities).
   * Interpolates smoothly from current visual position to the given tile.
   */
  moveToTarget(x: number, y: number, direction: number) {
    this.direction = direction;
    this.targetX = x * this.TILE_SIZE;
    this.targetY = y * this.TILE_SIZE;
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
      const step = Math.min(MOVE_SPEED * dt, dist);
      this.visualX += (dx / dist) * step;
      this.visualY += (dy / dist) * step;
    } else if (this.visualX !== this.targetX || this.visualY !== this.targetY) {
      // Close enough — snap to target tile
      this.visualX = this.targetX;
      this.visualY = this.targetY;

      if (this.movementState === "walking") {
        this.setIdle();
      }
    }

    this.sprite.x = this.visualX;
    this.sprite.y = this.visualY;
  }

  getPlayerPosition() {
    return { x: this.visualX, y: this.visualY };
  }

  /** Remove this entity from the stage and clean up. */
  destroy() {
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
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

  private buildAnimationCache() {
    for (const dirName of DIRECTION_NAMES) {
      const idleFrames = assetManager.getPlayerFrames("idle", dirName);
      if (idleFrames.length > 0) {
        this.animationCache.set(`idle_${dirName}`, idleFrames);
      }
      const walkFrames = assetManager.getPlayerFrames("walk", dirName);
      if (walkFrames.length > 0) {
        this.animationCache.set(`walk_${dirName}`, walkFrames);
      }
    }
    console.log(
      `Built animation cache: ${this.animationCache.size} animation sets`
    );
  }

  private getFrames(action: string, direction: string): PIXI.Texture[] {
    return this.animationCache.get(`${action}_${direction}`) || [];
  }

  // ─── Fallback (no atlas) ────────────────────────────────────────────

  private createFallbackAnimatedSprite(color: number): PIXI.AnimatedSprite {
    const canvas = document.createElement("canvas");
    canvas.width = this.TILE_SIZE;
    canvas.height = this.TILE_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Body
    const hex = "#" + color.toString(16).padStart(6, "0");
    ctx.fillStyle = hex;
    const margin = 6;
    const bodyW = this.TILE_SIZE - margin * 2;
    const bodyH = this.TILE_SIZE - margin * 2;
    ctx.fillRect(margin, margin, bodyW, bodyH);

    // Simple "face" — two eyes + a darker outline
    ctx.fillStyle = "#000000";
    ctx.fillRect(margin, margin, bodyW, 2); // top edge
    ctx.fillRect(margin, margin + bodyH - 2, bodyW, 2); // bottom edge
    ctx.fillRect(margin, margin, 2, bodyH); // left edge
    ctx.fillRect(margin + bodyW - 2, margin, 2, bodyH); // right edge

    // Eyes
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.TILE_SIZE / 2 - 5, margin + 6, 3, 3);
    ctx.fillRect(this.TILE_SIZE / 2 + 2, margin + 6, 3, 3);

    const texture = PIXI.Texture.from(canvas);
    return new PIXI.AnimatedSprite([texture]);
  }
}
