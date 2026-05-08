import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";

// Direction enum matching server protocol: 0=Up, 1=Right, 2=Down, 3=Left
const DIRECTION_NAMES = ["up", "right", "down", "left"] as const;

const MOVE_SPEED = 200; // pixels per second for smooth interpolation
const SNAP_THRESHOLD = 0.5; // pixels — snap when this close to target

type MovementState = "idle" | "walking";

export class EntityRenderer {
  private container: PIXI.Container;
  private sprite: PIXI.AnimatedSprite;

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

  constructor(cameraContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    cameraContainer.addChild(this.container);

    // Try to build animations from the player spritesheet
    this.usingAtlas = assetManager.hasSpritesheet("player_base");

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
        // Atlas loaded but no matching frames — fall back to coloured sprite
        console.warn(
          "Player atlas loaded but no idle_down frames found, using fallback sprite"
        );
        this.usingAtlas = false;
        this.sprite = this.createFallbackAnimatedSprite(0xff0000);
      }
    } else {
      this.sprite = this.createFallbackAnimatedSprite(0xff0000);
    }

    this.container.addChild(this.sprite);
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

  handlePacket(_packet: any) {
    // Future logic for handling other players/monsters spawning nearby
  }

  getPlayerPosition() {
    return { x: this.visualX, y: this.visualY };
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
    const hex = "#" + color.toString(16).padStart(6, "0");
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
    const texture = PIXI.Texture.from(canvas);
    return new PIXI.AnimatedSprite([texture]);
  }
}
