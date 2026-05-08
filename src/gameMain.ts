import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { EntityRenderer } from "./renderers/entityRenderer";
import { Camera } from "./renderers/camera";
import { MapRenderer } from "./renderers/mapRenderer";
import { KeyboardManager } from "./inputs/keyboard";
import { DOMOverlay } from "./ui/domOverlay";
import { assetManager } from "./utils/assetManager";

export class GameApp {
  private app: PIXI.Application;
  private camera: Camera;
  private entityRenderer: EntityRenderer;
  private mapRenderer: MapRenderer;
  private keyboard: KeyboardManager;
  private ui: DOMOverlay;

  constructor(canvasContainer: HTMLElement, initialSpawnData: any = null) {
    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundColor: 0x1099bb,
      antialias: true,
    });

    canvasContainer.appendChild(this.app.view as HTMLCanvasElement);

    this.camera = new Camera();
    this.app.stage.addChild(this.camera.container);

    this.entityRenderer = new EntityRenderer(this.camera.container);
    this.mapRenderer = new MapRenderer(this.camera.container);
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
        this.entityRenderer.handleResync(initialSpawnData.x, initialSpawnData.y);
      }
    }
    
    socket.onMessage((packet) => {
      if (packet.type === "MapChange") {
        this.mapRenderer.loadMap(packet.payload.map_id);
      }

      if (packet.type === "PlayerPosition") {
        this.entityRenderer.handleResync(packet.payload.x, packet.payload.y);
      }

      this.entityRenderer.handlePacket(packet);
      
      if (packet.type === "SystemMessage") {
        this.ui.addMessage(packet.payload.message);
      }
    });

    // Note: socket.connect() is NOT called here because Index.tsx already manages the connection

    this.app.ticker.add(() => {
      // Drive smooth entity interpolation every frame
      const dt = this.app.ticker.elapsedMS / 1000;
      this.entityRenderer.update(dt);

      this.keyboard.update((direction) => {
        this.entityRenderer.predictMove(direction);
        socket.send({ 
          type: "Move", 
          payload: { direction } 
        });
      });

      const playerPos = this.entityRenderer.getPlayerPosition();
      if (playerPos) {
        this.camera.centerOn(playerPos.x, playerPos.y, this.app.screen.width, this.app.screen.height);
      }
    });
  }

  destroy() {
    this.app.destroy(true);
  }
}