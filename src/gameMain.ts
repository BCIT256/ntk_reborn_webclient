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

  constructor(canvasContainer: HTMLElement) {
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

    this.init();
  }

  private init() {
    this.mapRenderer.init();
    
    socket.onMessage((packet) => {
      // Handle messages based on the 'type' field
      if (packet.type === "MapChange") {
        this.mapRenderer.loadMap(packet.payload.map_id);
      }

      this.entityRenderer.handlePacket(packet);
      
      if (packet.type === "SystemMessage") {
        this.ui.addMessage(packet.payload.message);
      }
    });

    socket.connect();

    this.app.ticker.add(() => {
      this.keyboard.update();
    });
  }

  destroy() {
    this.app.destroy(true);
  }
}