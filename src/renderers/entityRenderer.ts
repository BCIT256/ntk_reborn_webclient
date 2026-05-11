import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";
import { EntityView, EntityVisualState } from "./EntityView";

// Direction enum matching server protocol: 0=Up, 1=Right, 2=Down, 3=Left
const DIRECTION_NAMES = ["up", "right", "down", "left"] as const;

const MOVE_SPEED = 200; // pixels per second for smooth interpolation
const SNAP_THRESHOLD = 0.5; // pixels — snap when this close to target

// Speech bubble constants
const SPEECH_BUBBLE_DISPLAY_MS = 5000; // 5 seconds before fade-out
const SPEECH_BUBBLE_FADE_MS = 1000; // 1 second fade-out duration
const SPEECH_BUBBLE_PADDING = 6; // px padding inside bubble
const SPEECH_BUBBLE_LINE_MAX = 28; // max characters per line before wrap
const SPEECH_BUBBLE_FONT_SIZE = 10;
const SPEECH_BUBBLE_Z_INDEX = 200; // above nameplate and other entities

type MovementState = "idle" | "walking";

/**
 * Fallback type determines which placeholder sprite to draw when
 * no spritesheet atlas is available for the entity's graphic_id.
 */
export type FallbackType = "player" | "mob" | "npc";

export interface EntityConfig {
  entityId: number;
  name: string;
  graphicId?: string;
  isLocalPlayer?: boolean;
  fallbackColor?: number;
  fallbackType?: FallbackType;
  nameColor?: number;
  visualData?: any; // To pass raw spawn payload if needed
}

export class EntityRenderer {
  private container: PIXI.Container;
  private sprite: PIXI.AnimatedSprite | null = null;
  private view: EntityView;
  private nameTag: PIXI.Text;

  readonly entityId: number;
  readonly graphicId: string;

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

  private TILE_SIZE: number = 48;
  private usingAtlas: boolean = false;
  private isLocalPlayer: boolean;
  private visualData: any;

  // ─── Speech Bubble State ─────────────────────────────────────────
  private speechBubbleContainer: PIXI.Container | null = null;
  private speechBubbleTimer: ReturnType<typeof setTimeout> | null = null;
  private speechBubbleFading: boolean = false;

  constructor(cameraContainer: PIXI.Container, config: EntityConfig) {
    this.entityId = config.entityId;
    this.isLocalPlayer = config.isLocalPlayer ?? false;
    this.graphicId = config.graphicId ?? (this.isLocalPlayer ? "player_base" : "mob");
    this.visualData = config.visualData || {};

    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    cameraContainer.addChild(this.container);

    this.view = new EntityView();
    this.view.x = 0;
    this.view.y = 0;
    this.container.addChild(this.view);

    // Initial state update
    this.updateViewState();

    // Determine which spritesheet to use.
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
    this.nameTag.zIndex = 1;
    this.container.addChild(this.nameTag);
  }

  // ─── Public API ─────────────────────────────────────────────────────

  handleResync(x: number, y: number) {
    if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;

    this.targetX = x * this.TILE_SIZE;
    this.targetY = y * this.TILE_SIZE;

    this.visualX = this.targetX;
    this.visualY = this.targetY;

    this.container.x = this.visualX;
    this.container.y = this.visualY;

    this.setIdle();
  }

  moveToTarget(x: number, y: number, direction: number) {
    this.direction = direction;
    const newTargetX = x * this.TILE_SIZE;
    const newTargetY = y * this.TILE_SIZE;

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
    this.direction = direction;

    if (direction === 0) this.targetY -= this.TILE_SIZE;
    if (direction === 1) this.targetX += this.TILE_SIZE;
    if (direction === 2) this.targetY += this.TILE_SIZE;
    if (direction === 3) this.targetX -= this.TILE_SIZE;

    this.setWalking();
  }

  update(dt: number) {
    // Smooth lerp towards target
    this.visualX += (this.targetX - this.visualX) * 0.3;
    this.visualY += (this.targetY - this.visualY) * 0.3;

    const dx = this.targetX - this.visualX;
    const dy = this.targetY - this.visualY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= SNAP_THRESHOLD) {
      this.visualX = this.targetX;
      this.visualY = this.targetY;

      if (this.movementState === "walking") {
        this.setIdle();
      }
    }

    this.container.x = this.visualX;
    this.container.y = this.visualY;

    // Simple frame animation (placeholder logic)
    if (this.movementState === "walking") {
        const time = Date.now() / 150;
        const frame = Math.floor(time) % 4; // assuming 4 frames
        this.updateViewState(frame);
    } else {
        this.updateViewState(0);
    }

    // ─── Speech bubble fade-out ────────────────────────────────────
    if (this.speechBubbleFading && this.speechBubbleContainer) {
      this.speechBubbleContainer.alpha -= dt / (SPEECH_BUBBLE_FADE_MS / 1000);
      if (this.speechBubbleContainer.alpha <= 0) {
        this.destroySpeechBubble();
      }
    }
  }

  getPlayerPosition() {
    return { x: this.visualX, y: this.visualY };
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Show a speech bubble above this entity's head.
   * Replaces any existing bubble. Starts a 5-second display timer,
   * then fades out over 1 second.
   */
  showSpeechBubble(text: string) {
    // If an existing bubble is active, destroy it immediately
    this.destroySpeechBubble();

    // Word-wrap the text into lines
    const lines = this.wrapText(text, SPEECH_BUBBLE_LINE_MAX);
    const displayText = lines.join(String.fromCharCode(10));

    // Measure text dimensions
    const style = new PIXI.TextStyle({
      fontFamily: "sans-serif",
      fontSize: 12,
      fill: "#ffffff",
      wordWrap: false,
    });
    const metrics = PIXI.TextMetrics.measureText(displayText, style);
    const textWidth = metrics.width;
    const textHeight = metrics.height;

    const bubbleWidth = textWidth + SPEECH_BUBBLE_PADDING * 2;
    const bubbleHeight = textHeight + SPEECH_BUBBLE_PADDING * 2;

    // Create the bubble container
    this.speechBubbleContainer = new PIXI.Container();
    this.speechBubbleContainer.zIndex = SPEECH_BUBBLE_Z_INDEX;

    // Draw the rounded rectangle background with a small tail pointing down
    const bubbleGfx = new PIXI.Graphics();
    const cornerRadius = 4;
    const tailWidth = 6;
    const tailHeight = 5;

    // Rounded rectangle body (separate shape)
    bubbleGfx.beginFill(0x000000, 0.7);
    bubbleGfx.lineStyle(1, 0xcccccc, 0.8);
    bubbleGfx.drawRoundedRect(0, 0, bubbleWidth, bubbleHeight, cornerRadius);
    bubbleGfx.endFill();

    // Small triangular tail at bottom center pointing down (separate shape)
    const tailX = bubbleWidth / 2;
    bubbleGfx.beginFill(0x000000, 0.7);
    bubbleGfx.lineStyle(1, 0xcccccc, 0.8);
    bubbleGfx.moveTo(tailX - tailWidth / 2, bubbleHeight);
    bubbleGfx.lineTo(tailX, bubbleHeight + tailHeight);
    bubbleGfx.lineTo(tailX + tailWidth / 2, bubbleHeight);
    bubbleGfx.closePath();
    bubbleGfx.endFill();

    this.speechBubbleContainer.addChild(bubbleGfx);

    // Add the text
    const bubbleText = new PIXI.Text(displayText, {
      fontFamily: "sans-serif",
      fontSize: 12,
      fill: "#ffffff",
    } as PIXI.TextStyle);
    bubbleText.x = SPEECH_BUBBLE_PADDING;
    bubbleText.y = SPEECH_BUBBLE_PADDING;
    this.speechBubbleContainer.addChild(bubbleText);

    // Position: centered horizontally above the nameTag
    const nameTagTop = this.nameTag.y - (this.nameTag.height || 12);
    this.speechBubbleContainer.x = (this.TILE_SIZE / 2) - (bubbleWidth / 2);
    this.speechBubbleContainer.y = nameTagTop - bubbleHeight - tailHeight - 2;

    this.container.addChild(this.speechBubbleContainer);
    this.speechBubbleFading = false;

    // Start the display timer: after SPEECH_BUBBLE_DISPLAY_MS, begin fading
    this.speechBubbleTimer = setTimeout(() => {
      this.speechBubbleFading = true;
      this.speechBubbleTimer = null;
    }, SPEECH_BUBBLE_DISPLAY_MS);
  }

  /** Remove this entity from the stage and clean up. */
  destroy() {
    // Clean up speech bubble timers and objects
    this.destroySpeechBubble();

    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }

  // ─── Speech Bubble Internals ───────────────────────────────────────

  /**
   * Destroy the current speech bubble and clear any pending timers.
   * Safe to call even if no bubble exists.
   */
  private destroySpeechBubble() {
    // Clear the display timer (prevents ghost callbacks after entity despawn)
    if (this.speechBubbleTimer !== null) {
      clearTimeout(this.speechBubbleTimer);
      this.speechBubbleTimer = null;
    }

    this.speechBubbleFading = false;

    if (this.speechBubbleContainer) {
      if (this.speechBubbleContainer.parent) {
        this.speechBubbleContainer.parent.removeChild(this.speechBubbleContainer);
      }
      this.speechBubbleContainer.destroy({ children: true });
      this.speechBubbleContainer = null;
    }
  }

  /**
   * Simple word-wrap: splits `text` into lines of at most `maxChars` characters.
   * Tries to break at word boundaries when possible.
   */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      // If the word itself exceeds maxChars, split it character by character
      if (word.length > maxChars) {
        // Flush current line first
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        continue;
      }

      const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  }

  // ─── Graphic resolution ───────────────────────────────────────────

  private resolveGraphicId(): string | null {
    if (this.graphicId && assetManager.hasEntitySpritesheet(this.graphicId)) {
      return this.graphicId;
    }

    if (this.isLocalPlayer) {
      return "player_base";
    }

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

  public updateViewState(frame: number = 0) {
    const dirName = DIRECTION_NAMES[this.direction];
    const action = this.movementState;
    // Maps to state
    const state: EntityVisualState = {
      bodyId: this.visualData.body || 1,
      faceId: this.visualData.face,
      hairId: this.visualData.hair,
      armorId: this.visualData.equipment?.[2], // example
      helmetId: this.visualData.equipment?.[3],
      shieldId: this.visualData.equipment?.[1],
      weaponId: this.visualData.equipment?.[0],

      skinColor: this.visualData.skin_color,
      faceColor: this.visualData.face_color,
      hairColor: this.visualData.hair_color,

      direction: dirName,
      frame: frame
    };
    this.view.updateState(state);
  }

  public updateViewStateForce(state: EntityVisualState) {
    // Update the underlying visualData mapping so subsequent updates persist the forced state
    this.visualData.body = state.bodyId;
    this.visualData.face = state.faceId;
    this.visualData.hair = state.hairId;
    this.visualData.equipment = this.visualData.equipment || [];
    this.visualData.equipment[0] = state.weaponId;
    this.visualData.equipment[1] = state.shieldId;
    this.visualData.equipment[2] = state.armorId;
    this.visualData.equipment[3] = state.helmetId;
    
    this.visualData.skin_color = state.skinColor;
    this.visualData.face_color = state.faceColor;
    this.visualData.hair_color = state.hairColor;

    this.view.updateState(state);
  }

  private switchAnimation(action: string, directionName: string) {
    if (this.currentAnimationKey === `${action}_${directionName}`) return;
    this.currentAnimationKey = `${action}_${directionName}`;
    this.updateViewState(0);
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
      ctx.fillStyle = hex;
      const margin = 6;
      const bodyW = this.TILE_SIZE - margin * 2;
      const bodyH = this.TILE_SIZE - margin * 2;
      ctx.fillRect(margin, margin, bodyW, bodyH);
      ctx.fillStyle = "#000000";
      ctx.fillRect(margin, margin, bodyW, 2);
      ctx.fillRect(margin, margin + bodyH - 2, bodyW, 2);
      ctx.fillRect(margin, margin, 2, bodyH);
      ctx.fillRect(margin + bodyW - 2, margin, 2, bodyH);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.TILE_SIZE / 2 - 5, margin + 6, 3, 3);
      ctx.fillRect(this.TILE_SIZE / 2 + 2, margin + 6, 3, 3);
    } else if (type === "npc") {
      ctx.fillStyle = hex;
      const margin = 6;
      const bodyW = this.TILE_SIZE - margin * 2;
      const bodyH = this.TILE_SIZE - margin * 2;
      ctx.fillRect(margin, margin, bodyW, bodyH);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(this.TILE_SIZE / 2, margin - 6);
      ctx.lineTo(this.TILE_SIZE / 2 - 5, margin + 2);
      ctx.lineTo(this.TILE_SIZE / 2 + 5, margin + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.TILE_SIZE / 2 - 5, margin + 6, 3, 3);
      ctx.fillRect(this.TILE_SIZE / 2 + 2, margin + 6, 3, 3);
    } else {
      ctx.fillStyle = hex;
      const cx = this.TILE_SIZE / 2;
      const cy = this.TILE_SIZE / 2 + 4;
      const rx = 10;
      const ry = 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(cx - 5, cy - 3, 4, 2);
      ctx.fillRect(cx + 1, cy - 3, 4, 2);
    }

    const texture = PIXI.Texture.from(canvas);
    return new PIXI.AnimatedSprite([texture]);
  }
}