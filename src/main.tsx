import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { EntityRenderer } from "./renderers/entityRenderer";
import { Camera } from "./renderers/camera";
import { MapRenderer } from "./renderers/mapRenderer";
import { KeyboardManager } from "./inputs/keyboard";
import { DOMOverlay } from "./ui/domOverlay";

export class GameApp {
  private app: PIXI.Application;
  private camera: Camera;
  private entityRenderer: EntityRenderer;
  private mapRenderer: MapRenderer;
  private keyboard: KeyboardManager;
  private ui: DOMOverlay;

  // FIXED: Now accepts the spawn data from Index.tsx
  constructor(canvasContainer: HTMLElement, initialSpawnData: any) {
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

  private init(initialSpawnData: any) {
    this.mapRenderer.init();
    
    // FIXED: Force the map to load instantly on boot!
    if (initialSpawnData && initialSpawnData.map_id !== undefined) {
      this.mapRenderer.loadMap(initialSpawnData.map_id);
      this.entityRenderer.handleResync(initialSpawnData.x, initialSpawnData.y);
    }
    
    socket.onMessage((packet) => {
      if (packet.type === "MapChange") {
        this.mapRenderer.loadMap(packet.payload.map_id);
        this.entityRenderer.handleResync(packet.payload.x, packet.payload.y);
      }

      // Handle the Resync/Rubberband packet
      if (packet.type === "PlayerPosition") {
        this.entityRenderer.handleResync(packet.payload.x, packet.payload.y);
      }

      this.entityRenderer.handlePacket(packet);
      
      if (packet.type === "SystemMessage") {
        this.ui.addMessage(packet.payload.message);
      }
    });

    // socket.connect(); <-- Removed, as Index.tsx already manages the connection!

    this.app.ticker.add(() => {
      // Client-Side Prediction logic
      this.keyboard.update((direction) => {
        // 1. Move locally instantly
        this.entityRenderer.predictMove(direction);
        
        // 2. Send the packet to the server
        socket.send({ 
          type: "Move", 
          payload: { direction } 
        });
      });

      // Update camera to follow player
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