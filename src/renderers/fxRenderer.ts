import * as PIXI from "pixi.js";
import { eventBus } from "../utils/eventBus";
import { socket } from "../socket";

/**
 * FxRenderer — Handles PlayAnimation events by overlaying FX sprites
 * on top of entity containers.
 *
 * Lifecycle:
 *   1. Locate the target entity's container (or use explicit x/y).
 *   2. Load the FX texture (cached via PIXI.Assets).
 *   3. Attach the FX sprite to the entity's container with zIndex = 100.
 *   4. Auto-destroy the sprite when the animation completes.
 *
 * Memory-safe: Every spawned FX sprite is tracked and destroyed
 * after playback, preventing GPU texture leaks.
 */
export class FxRenderer {
  /** Reference to the entity layer so we can spawn positional FX. */
  private entityLayer: PIXI.Container;

  /** Track active FX sprites for cleanup. */
  private activeFx: Set<PIXI.Sprite | PIXI.AnimatedSprite> = new Set();

  /** EventBus unsubscribe functions. */
  private unsubs: (() => void)[] = [];

  /** Cache of loaded FX textures to avoid re-downloading. */
  private textureCache: Map<number, PIXI.Texture | PIXI.Spritesheet> = new Map();

  /**
   * @param entityLayer  The shared entity container — needed so we can
   *                     look up entity positions and spawn positional FX.
   * @param getEntity    Function to look up an EntityRenderer by entity_id.
   */
  constructor(
    entityLayer: PIXI.Container,
    private getEntity: (id: number) => { getContainer: () => PIXI.Container; getPlayerPosition: () => { x: number; y: number } } | undefined
  ) {
    this.entityLayer = entityLayer;

    this.unsubs.push(
      eventBus.on("PlayAnimation", (data) => {
        this.handlePlayAnimation(data);
      })
    );
  }

  private async handlePlayAnimation(data: { entity_id: number | null; anim_id: number; x: number | null; y: number | null }) {
    const { entity_id, anim_id, x, y } = data;

    let targetContainer: PIXI.Container | null = null;
    let spawnX = 0;
    let spawnY = 0;

    if (entity_id !== null && entity_id !== undefined) {
      // Try local player first
      if (entity_id === socket.localEntityId) {
        // We need a way to get the local player's container.
        // The caller (GameApp) provides the getEntity function.
        // For now, we'll use the fallback: find entity or use x/y.
      }

      const entity = this.getEntity(entity_id);
      if (entity) {
        targetContainer = entity.getContainer();
        spawnX = 0; // relative to the entity container
        spawnY = 0;
      }
    }

    // If no entity found, use explicit x/y coordinates
    if (!targetContainer) {
      targetContainer = this.entityLayer;
      if (x !== null && y !== null) {
        spawnX = x * 32; // tile coords → pixels
        spawnY = y * 32;
      }
    }

    // Load the FX texture/spritesheet
    try {
      const asset = await this.loadFxAsset(anim_id);
      if (!asset) return;

      let fxSprite: PIXI.Sprite | PIXI.AnimatedSprite;

      if (asset instanceof PIXI.Spritesheet) {
        // Animated FX — use AnimatedSprite
        const frameKeys = Object.keys(asset.textures).sort();
        const frames = frameKeys.map((key) => asset.textures[key]);
        if (frames.length === 0) return;

        const animated = new PIXI.AnimatedSprite(frames);
        animated.animationSpeed = 0.2;
        animated.loop = false;
        animated.onComplete = () => {
          this.removeFx(animated);
        };
        fxSprite = animated;
      } else {
        // Static texture — use a regular Sprite with timed removal
        fxSprite = new PIXI.Sprite(asset as PIXI.Texture);

        // Auto-destroy after 1 second for static FX
        setTimeout(() => {
          this.removeFx(fxSprite);
        }, 1000);
      }

      // Center the FX sprite on the entity
      fxSprite.anchor.set(0.5);
      fxSprite.x = spawnX + 16; // center of tile
      fxSprite.y = spawnY + 16;
      fxSprite.zIndex = 100;

      targetContainer.addChild(fxSprite);
      this.activeFx.add(fxSprite);

      // Start playing if animated
      if (fxSprite instanceof PIXI.AnimatedSprite) {
        fxSprite.play();
      }
    } catch (error) {
      console.warn(`FxRenderer: failed to load FX asset ${anim_id}:`, error);
    }
  }

  /**
   * Load an FX asset. Uses PIXI's built-in asset cache so we don't
   * re-download the same JSON/PNG every time a spell is cast.
   */
  private async loadFxAsset(animId: number): Promise<PIXI.Texture | PIXI.Spritesheet | null> {
    // Check our local cache first
    const cached = this.textureCache.get(animId);
    if (cached) return cached;

    try {
      // Use absolute backend URL
      const spritesheet = await PIXI.Assets.load(`http://localhost:2011/assets/fx/${animId}.json`) as PIXI.Spritesheet;
      this.textureCache.set(animId, spritesheet);
      return spritesheet;
    } catch (e) {
      // Fallback: load as single image
      try {
        const texture = await PIXI.Assets.load(`http://localhost:2011/assets/fx/${animId}.png`) as PIXI.Texture;
        this.textureCache.set(animId, texture);
        return texture;
      } catch (err) {
        // No FX asset found
      }
    }

    return null;
  }

  private removeFx(sprite: PIXI.Sprite | PIXI.AnimatedSprite) {
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    sprite.destroy();
    this.activeFx.delete(sprite);
  }

  destroy() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    // Destroy all active FX sprites
    for (const sprite of this.activeFx) {
      if (sprite.parent) sprite.parent.removeChild(sprite);
      sprite.destroy();
    }
    this.activeFx.clear();
    this.textureCache.clear();
  }
}