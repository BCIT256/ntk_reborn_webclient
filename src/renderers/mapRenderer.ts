import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";

export class MapRenderer {
  private container: PIXI.Container;
  private currentMapId: string | null = null;

  constructor(container: PIXI.Container) {
    this.container = new PIXI.Container();
    container.addChild(this.container);
  }

  init() {
    console.log("Map renderer initialized using IndexedDB AssetManager");
  }

  async loadMap(mapId: number | string) {
    const mapIdStr = String(mapId);
    if (this.currentMapId === mapIdStr) return;
    
    console.log(`Loading map ${mapIdStr} from local cache...`);
    let mapData;

    try {
      // Use the AssetManager to pull directly from IndexedDB
      mapData = await assetManager.getMap(mapIdStr);
      console.log(`Map data loaded from IndexedDB for Map ${mapIdStr}`);
    } catch (error) {
      console.warn(`Failed to find map ${mapIdStr} in cache, returning mock data:`, error);
      mapData = this.getMockMap(mapIdStr);
    }

    this.currentMapId = mapIdStr;
    this.renderMap(mapData);
  }

  private getMockMap(mapId: string) {
    return {
      id: mapId,
      width: 20,
      height: 20,
      tiles: Array(400).fill(1),
      collision: Array(400).fill(0),
    };
  }

  private renderMap(mapData: any) {
    this.container.removeChildren();

    const TILE_SIZE = 32;
    const mapGraphics = new PIXI.Graphics();
    const collisionData = mapData.collision || mapData.pass || [];

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const index = x + y * mapData.width;
        const isBlocked = collisionData[index] !== 0;
        const color = isBlocked ? 0x882222 : 0x228822;

        mapGraphics.beginFill(color);
        mapGraphics.lineStyle(1, 0x000000, 0.1);
        mapGraphics.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        mapGraphics.endFill();
      }
    }

    this.container.addChild(mapGraphics);
    console.log(`Rendered ${mapData.width}x${mapData.height} map (ID: ${mapData.id})`);
  }
}