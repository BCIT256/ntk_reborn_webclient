import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { EntityRenderer } from "./renderers/entityRenderer";
import { Camera } from "./renderers/camera";
import { MapRenderer } from "./renderers/mapRenderer";
import { KeyboardManager } from "./inputs/keyboard";
import { DOMOverlay } from "./ui/domOverlay";
import { DamageNumberManager } from "./ui/damageNumberManager";
import { EntityManager } from "./managers/entityManager";
import { assetManager } from "./utils/assetManager";
import { eventBus } from "./utils/eventBus";

const TILE_SIZE = 32;

export class GameApp {
  private app: PIXI.Application;
  private camera: Camera;
  private localPlayer: EntityRenderer;
  private entityManager: EntityManager;
  private mapRenderer: MapRenderer;
  private keyboard: KeyboardManager;
  private ui: DOMOverlay;
  private damageNumbers: DamageNumberManager;

  /** Shared container for all entity sprites (enables Z-sorting by Y). */
  private entityLayer: PIXI.Container;

  /** Guards against concurrent map transitions. */
  private transitionInProgress: boolean = false;

  constructor(canvasContainer: HTMLElement, initialSpawnData: any = null) {
    this.app = new PIXI.Application({
      resizeTo: canvasContainer,
      backgroundColor: 0x1099bb,
      antialias: true,
    });

    canvasContainer.appendChild(this.app.view as HTMLCanvasElement);

    this.camera = new Camera();
    this.app.stage.addChild(this.camera.container);

    // Map renderer is added FIRST so it renders BEHIND everything else
    this.mapRenderer = new MapRenderer(this.camera.container);

    // Entity layer sits above the map so entities render on top of tiles
    this.entityLayer = new PIXI.Container();
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

    // Damage number manager (added to camera container so it scrolls with the world)
    this.damageNumbers = new DamageNumberManager(this.camera.container);
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

    // ─── Dialog lock via EventBus ──────────────────────────────────────
    // React InteractionOverlay emits these events when it opens/closes.
    eventBus.on("DialogOpened", () => {
      this.keyboard.locked = true;
    });
    eventBus.on("DialogClosed", () => {
      this.keyboard.locked = false;
    });

    // ─── Map Change: async teardown/rebuild handshake ──────────────────
    // When the server sends a MapChange, we must:
    //   1. Emit MapTransitionStart (→ React shows loading screen, keyboard locks)
    //   2. Clear all entities
    //   3. Destroy old map sprites (memory-safe)
    //   4. Fetch & load the new map
    //   5. Reposition the player & camera
    //   6. Emit MapTransitionComplete (→ React hides loading screen, keyboard unlocks)
    eventBus.on("MapChange", (data) => {
      this.handleMapChange(data);
    });

    // ─── Other EventBus subscriptions ─────────────────────────────────

    eventBus.on("PlayerPosition", (data) => {
      this.localPlayer.handleResync(data.x, data.y);
    });

    eventBus.on("SpawnCharacter", (data) => {
      if (data.entity_id === socket.localEntityId) return;
      this.entityManager.handleSpawn(data);
    });

    eventBus.on("EntityMove", (data) => {
      if (data.entity_id === socket.localEntityId) {
        this.localPlayer.moveToTarget(data.x, data.y, data.direction);
      } else {
        this.entityManager.handleMove(data);
      }
    });

    eventBus.on("EntityRemove", (data) => {
      this.entityManager.handleRemove(data.entity_id);
    });

    // ─── Combat ────────────────────────────────────────────────────
    eventBus.on("EntityHealthUpdate", (data) => {
      if (data.damage <= 0) return;

      let worldX: number | undefined;
      let worldY: number | undefined;

      if (data.entity_id === socket.localEntityId) {
        const pos = this.localPlayer.getPlayerPosition();
        worldX = pos.x;
        worldY = pos.y;
      } else {
        const entity = this.entityManager.getEntity(data.entity_id);
        if (entity) {
          const pos = entity.getPlayerPosition();
          worldX = pos.x;
          worldY = pos.y;
        }
      }

      if (worldX !== undefined && worldY !== undefined) {
        this.damageNumbers.spawn(worldX, worldY, data.damage, data.hit_type);
      }
    });

    // ─── Chat / System ──────────────────────────────────────────────
    eventBus.on("SystemMessage", (data) => {
      this.ui.addMessage(data.message);
    });

    // ─── Socket → EventBus bridge ──────────────────────────────────
    socket.onMessage((packet) => {
      switch (packet.type) {
        case "MapChange":
          // Emit MapTransitionStart immediately so React shows the loading
          // screen and the keyboard locks BEFORE the async work begins.
          eventBus.emit("MapTransitionStart", { map_id: packet.payload.map_id });
          eventBus.emit("MapChange", packet.payload);
          break;
        case "PlayerPosition":
          eventBus.emit("PlayerPosition", packet.payload);
          break;
        case "SpawnCharacter":
          eventBus.emit("SpawnCharacter", packet.payload);
          break;
        case "EntityMove":
          eventBus.emit("EntityMove", packet.payload);
          break;
        case "EntityRemove":
          eventBus.emit("EntityRemove", packet.payload);
          break;
        case "EntityHealthUpdate":
          eventBus.emit("EntityHealthUpdate", packet.payload);
          break;
        case "PlayerVitalsUpdate":
          eventBus.emit("PlayerVitalsUpdate", packet.payload);
          break;
        case "DialogPopup":
          eventBus.emit("DialogPopup", packet.payload);
          break;
        case "ShowMenu":
          eventBus.emit("ShowMenu", packet.payload);
          break;
        case "SystemMessage":
          eventBus.emit("SystemMessage", packet.payload);
          break;
        case "InventoryUpdate":
          eventBus.emit("InventoryUpdate", packet.payload);
          break;
        case "SpellListUpdate":
          eventBus.emit("SpellListUpdate", packet.payload);
          break;
      }
    });

    // ─── Game loop ─────────────────────────────────────────────────
    this.app.ticker.add(() => {
      const dt = this.app.ticker.elapsedMS / 1000;

      this.localPlayer.update(dt);
      this.entityManager.update(dt);
      this.damageNumbers.update(dt);

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

  // ─── Map Transition Handler ──────────────────────────────────────

  private async handleMapChange(data: { map_id: number; x: number; y: number; objects: any[] }) {
    // Guard against concurrent transitions (e.g. double warp packet)
    if (this.transitionInProgress) {
      console.warn("Map transition already in progress — ignoring duplicate MapChange.");
      return;
    }
    this.transitionInProgress = true;

    console.log(`MapChange received → transitioning to map ${data.map_id} at (${data.x}, ${data.y})`);

    try {
      // 1. Input is already locked (MapTransitionStart was emitted in the bridge)

      // 2. Clear all remote entities
      this.entityManager.clearAll();

      // 3. Destroy old map sprites — frees GPU memory
      this.mapRenderer.destroy();

      // 4. Fetch and render the new map
      await this.mapRenderer.loadMap(data.map_id);

      // 5. Reposition the local player to the new coordinates
      this.localPlayer.handleResync(data.x, data.y);

      // 6. Immediately center the camera on the new position
      //    (prevents jitter when the loading screen fades out)
      const playerPos = this.localPlayer.getPlayerPosition();
      if (playerPos) {
        this.camera.centerOn(
          playerPos.x,
          playerPos.y,
          this.app.screen.width,
          this.app.screen.height
        );
      }

      // 7. Map is fully rendered and camera positioned — signal completion
      console.log(`Map transition to ${data.map_id} complete.`);
      eventBus.emit("MapTransitionComplete");
    } catch (error) {
      console.error("Map transition failed:", error);
      // Even on failure, unlock input so the player isn't stuck
      eventBus.emit("MapTransitionComplete");
    } finally {
      this.transitionInProgress = false;
    }
  }

  destroy() {
    eventBus.clear();
    this.entityManager.clearAll();
    this.damageNumbers.destroy();
    this.keyboard.destroy();
    this.mapRenderer.destroy();
    this.app.destroy(true);
  }
}
