import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { EntityRenderer } from "./renderers/entityRenderer";
import { Camera } from "./renderers/camera";
import { MapRenderer } from "./renderers/mapRenderer";
import { FxRenderer } from "./renderers/fxRenderer";
import { KeyboardManager } from "./inputs/keyboard";
import { DOMOverlay } from "./ui/domOverlay";
import { DamageNumberManager } from "./ui/damageNumberManager";
import { EntityManager } from "./managers/entityManager";
import { AudioManager } from "./managers/audioManager";
import { assetManager } from "./utils/assetManager";
import { eventBus } from "./utils/eventBus";

const TILE_SIZE = 32;

export class GameApp {
  private app: PIXI.Application;
  private camera: Camera;
  private localPlayer: EntityRenderer;
  private entityManager: EntityManager;
  private mapRenderer: MapRenderer;
  private fxRenderer: FxRenderer;
  private keyboard: KeyboardManager;
  private ui: DOMOverlay;
  private damageNumbers: DamageNumberManager;
  private audioManager: AudioManager;

  /** Shared container for all entity sprites (enables Z-sorting by Y). */
  private entityLayer: PIXI.Container;

  /** Guards against concurrent map transitions. */
  private transitionInProgress: boolean = false;

  /** Unsubscribe functions for all EventBus listeners. */
  private eventUnsubs: (() => void)[] = [];

  constructor(canvasContainer: HTMLElement, initialSpawnData: any = null) {
    this.app = new PIXI.Application({
      resizeTo: canvasContainer,
      backgroundColor: 0x1099bb,
      antialias: true,
    });

    canvasContainer.appendChild(this.app.view as HTMLCanvasElement);

    this.camera = new Camera();

    // ─── Enable Z-index sorting on all key containers ───────────────
    this.camera.container.sortableChildren = true;
    this.camera.container.zIndex = 0;

    this.app.stage.addChild(this.camera.container);

    // Map renderer is added FIRST so it renders BEHIND everything else
    this.mapRenderer = new MapRenderer(this.camera.container);

    // Entity layer sits above the map so entities render on top of tiles
    this.entityLayer = new PIXI.Container();
    this.entityLayer.zIndex = 100; // Above map tiles (zIndex 0)
    this.camera.container.addChild(this.entityLayer);

    // Local player
    const localId = socket.localEntityId ?? 0;
    this.localPlayer = new EntityRenderer(this.entityLayer, {
      entityId: localId,
      name: "You",
      isLocalPlayer: true,
      fallbackColor: 0xff0000,
    });

    // Remote entity manager
    this.entityManager = new EntityManager(this.entityLayer);

    // Helper: look up an entity's world position by entity_id.
    const getEntityPosition = (id: number): { x: number; y: number } | undefined => {
      if (id === socket.localEntityId) {
        return this.localPlayer.getPlayerPosition();
      }
      const entity = this.entityManager.getEntity(id);
      if (entity) {
        return entity.getPlayerPosition();
      }
      return undefined;
    };

    // Helper: look up an entity renderer by entity_id.
    const getEntityRenderer = (id: number) => {
      if (id === socket.localEntityId) {
        return this.localPlayer;
      }
      return this.entityManager.getEntity(id);
    };

    // Damage number manager (added to camera container so it scrolls with the world)
    this.damageNumbers = new DamageNumberManager(
      this.camera.container,
      getEntityPosition,
      localId
    );

    // FX renderer — overlays spell/effect animations on entities
    this.fxRenderer = new FxRenderer(this.entityLayer, (id) => getEntityRenderer(id));

    // Audio manager — plays sound effects with throttling
    this.audioManager = new AudioManager();

    this.keyboard = new KeyboardManager();
    this.ui = new DOMOverlay();

    this.init(initialSpawnData);
  }

  private init(initialSpawnData: any = null) {
    // Ensure spritesheets are loaded (idempotent — safe to call even if
    // MapLoadingScreen already loaded them)
    assetManager.loadSpritesheets();

    this.mapRenderer.init();

    // Load initial map and position player if spawn data is provided
    if (initialSpawnData) {
      this.mapRenderer.loadMap(initialSpawnData.map_id);
      if (initialSpawnData.x !== undefined && initialSpawnData.y !== undefined) {
        this.localPlayer.handleResync(initialSpawnData.x, initialSpawnData.y);
      }
    }

    // ─── Dialog lock via EventBus ──────────────────────────────────
    this.eventUnsubs.push(
      eventBus.on("DialogOpened", () => {
        this.keyboard.locked = true;
      }),
      eventBus.on("DialogClosed", () => {
        this.keyboard.locked = false;
      })
    );

    // ─── Map Change: async teardown/rebuild handshake ──────────────
    this.eventUnsubs.push(
      eventBus.on("MapChange", (data) => {
        this.handleMapChange(data);
      })
    );

    // ─── Other EventBus subscriptions ─────────────────────────────────
    // NOTE: The socket→eventBus bridge now lives in socket.ts.
    // We only subscribe to eventBus events here.

    this.eventUnsubs.push(
      eventBus.on("PlayerPosition", (data) => {
        this.localPlayer.handleResync(data.x, data.y);
      })
    );

    this.eventUnsubs.push(
      eventBus.on("SpawnCharacter", (data) => {
        if (data.entity_id === socket.localEntityId) return;
        this.entityManager.handleSpawn(data);
      })
    );

    this.eventUnsubs.push(
      eventBus.on("EntityMove", (data) => {
        if (data.entity_id === socket.localEntityId) {
          this.localPlayer.moveToTarget(data.x, data.y, data.direction);
        } else {
          this.entityManager.handleMove(data);
        }
      })
    );

    this.eventUnsubs.push(
      eventBus.on("EntityRemove", (data) => {
        this.entityManager.handleRemove(data.entity_id);
      })
    );

    // ─── Combat ────────────────────────────────────────────────────
    this.eventUnsubs.push(
      eventBus.on("EntityHealthUpdate", (data) => {
        if (data.damage <= 0) return;

        const pos = this.getEntityPosition(data.entity_id);
        if (pos) {
          this.damageNumbers.spawn(pos.x, pos.y, data.damage, data.hit_type);
        }
      })
    );

    // ─── Chat / System ──────────────────────────────────────────────
    this.eventUnsubs.push(
      eventBus.on("SystemMessage", (data) => {
        this.ui.addMessage(data.message);
      })
    );

    // ─── Speech Bubbles: route ChatNormal to entity renderers ───────
    this.eventUnsubs.push(
      eventBus.on("ChatNormal", (data) => {
        if (data.entity_id === socket.localEntityId) {
          this.localPlayer.showSpeechBubble(data.message);
        } else {
          this.entityManager.showSpeechBubble(data.entity_id, data.message);
        }
      })
    );

    // ─── Game loop ─────────────────────────────────────────────────
    this.app.ticker.add(() => {
      const dt = this.app.ticker.elapsedMS / 1000;

      this.localPlayer.update(dt);
      this.entityManager.update(dt);
      this.damageNumbers.update(dt);

      // Update local player's zIndex based on Y position for correct Z-sorting
      const localPos = this.localPlayer.getPlayerPosition();
      if (localPos) {
        this.localPlayer.getContainer().zIndex = localPos.y;
      }

      this.keyboard.update((direction) => {
        this.localPlayer.predictMove(direction);
        socket.send({
          type: "Move",
          payload: { direction },
        });
      });

      const playerPos = this.localPlayer.getPlayerPosition();
      if (playerPos) {
        this.camera.centerOn(
          playerPos.x,
          playerPos.y,
          this.app.screen.width,
          this.app.screen.height
        );
      }
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /** Look up an entity's world position by entity_id. */
  private getEntityPosition(id: number): { x: number; y: number } | undefined {
    if (id === socket.localEntityId) {
      return this.localPlayer.getPlayerPosition();
    }
    const entity = this.entityManager.getEntity(id);
    if (entity) {
      return entity.getPlayerPosition();
    }
    return undefined;
  }

  // ─── Map Transition Handler ──────────────────────────────────────

  private async handleMapChange(data: { map_id: number; x: number; y: number; objects: any[] }) {
    if (this.transitionInProgress) {
      console.warn("Map transition already in progress — ignoring duplicate MapChange.");
      return;
    }
    this.transitionInProgress = true;

    console.log(`MapChange received → transitioning to map ${data.map_id} at (${data.x}, ${data.y})`);

    try {
      this.entityManager.clearAll();
      this.mapRenderer.destroy();
      await this.mapRenderer.loadMap(data.map_id);
      this.localPlayer.handleResync(data.x, data.y);

      const playerPos = this.localPlayer.getPlayerPosition();
      if (playerPos) {
        this.camera.centerOn(
          playerPos.x,
          playerPos.y,
          this.app.screen.width,
          this.app.screen.height
        );
      }

      console.log(`Map transition to ${data.map_id} complete.`);
      eventBus.emit("MapTransitionComplete");
    } catch (error) {
      console.error("Map transition failed:", error);
      eventBus.emit("MapTransitionComplete");
    } finally {
      this.transitionInProgress = false;
    }
  }

  destroy() {
    // Unsubscribe all EventBus listeners to prevent leaks
    this.eventUnsubs.forEach((unsub) => unsub());
    this.eventUnsubs = [];

    this.entityManager.clearAll();
    this.damageNumbers.destroy();
    this.fxRenderer.destroy();
    this.audioManager.destroy();
    this.keyboard.destroy();
    this.mapRenderer.destroy();
    this.ui.destroy();

    // Destroy the PIXI Application with all children to prevent GPU memory leaks
    this.app.destroy(true, { children: true });
  }
}