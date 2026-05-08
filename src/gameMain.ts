import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { EntityRenderer } from "./renderers/entityRenderer";
import { Camera } from "./renderers/camera";
import { MapRenderer } from "./renderers/mapRenderer";
import { KeyboardManager } from "./inputs/keyboard";
import { DOMOverlay } from "./ui/domOverlay";
import { HUDManager } from "./ui/hudManager";
import { DialogManager } from "./ui/dialogManager";
import { EntityManager } from "./managers/entityManager";
import { assetManager } from "./utils/assetManager";

export class GameApp {
  private app: PIXI.Application;
  private camera: Camera;
  private localPlayer: EntityRenderer;
  private entityManager: EntityManager;
  private mapRenderer: MapRenderer;
  private keyboard: KeyboardManager;
  private ui: DOMOverlay;
  private hud: HUDManager;
  private dialog: DialogManager;

  /** Shared container for all entity sprites (enables Z-sorting by Y). */
  private entityLayer: PIXI.Container;

  constructor(canvasContainer: HTMLElement, initialSpawnData: any = null) {
    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundColor: 0x1099bb,
      antialias: true,
    });

    canvasContainer.appendChild(this.app.view as HTMLCanvasElement);

    this.camera = new Camera();
    this.app.stage.addChild(this.camera.container);

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

    this.mapRenderer = new MapRenderer(this.camera.container);
    this.keyboard = new KeyboardManager();
    this.ui = new DOMOverlay();
    this.hud = new HUDManager();
    this.dialog = new DialogManager();

    // Dialog lock: give the dialog manager access to the keyboard
    this.dialog.setKeyboardManager(this.keyboard);

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

    socket.onMessage((packet) => {
      switch (packet.type) {
        // ─── World ────────────────────────────────────────────────
        case "MapChange":
          this.mapRenderer.loadMap(packet.payload.map_id);
          // Clear remote entities on map change
          this.entityManager.clearAll();
          break;

        case "PlayerPosition":
          this.localPlayer.handleResync(packet.payload.x, packet.payload.y);
          break;

        case "SpawnCharacter": {
          // Skip the local player — we already render them
          if (packet.payload.entity_id === socket.localEntityId) break;
          this.entityManager.handleSpawn(packet.payload);
          break;
        }

        case "EntityMove":
          // If it's the local player, use the local renderer
          if (packet.payload.entity_id === socket.localEntityId) {
            this.localPlayer.moveToTarget(
              packet.payload.x,
              packet.payload.y,
              packet.payload.direction
            );
          } else {
            this.entityManager.handleMove(packet.payload);
          }
          break;

        case "EntityRemove":
          this.entityManager.handleRemove(packet.payload.entity_id);
          break;

        // ─── HUD ─────────────────────────────────────────────────
        case "PlayerVitalsUpdate":
          this.hud.handleVitalsUpdate(packet.payload);
          break;

        // ─── Dialog ──────────────────────────────────────────────
        case "DialogPopup":
          this.dialog.handleDialogPopup(packet.payload);
          break;

        case "ShowMenu":
          this.dialog.handleShowMenu(packet.payload);
          break;

        // ─── Chat / System ───────────────────────────────────────
        case "SystemMessage":
          this.ui.addMessage(packet.payload.message);
          break;
      }
    });

    // Note: socket.connect() is NOT called here because Index.tsx already manages the connection

    this.app.ticker.add(() => {
      // Drive smooth entity interpolation every frame
      const dt = this.app.ticker.elapsedMS / 1000;
      this.localPlayer.update(dt);
      this.entityManager.update(dt);

      this.keyboard.update((direction) => {
        this.localPlayer.predictMove(direction);
        socket.send({
          type: "Move",
          payload: { direction },
        });
      });

      const playerPos = this.localPlayer.getPlayerPosition();
      if (playerPos) {
        this.camera.centerOn(playerPos.x, playerPos.y, this.app.screen.width, this.app.screen.height);
      }
    });
  }

  destroy() {
    this.entityManager.clearAll();
    this.hud.destroy();
    this.dialog.destroy();
    this.app.destroy(true);
  }
}
