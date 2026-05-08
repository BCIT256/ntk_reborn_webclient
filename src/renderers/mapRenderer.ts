import * as PIXI from "pixi.js";

export class MapRenderer {
  private container: PIXI.Container;
  private currentMapId: number | null = null;

  constructor(container: PIXI.Container) {
    this.container = new PIXI.Container();
    container.addChild(this.container);
  }

  init() {
    console.log("Map renderer initialized");
  }

  /**
   * Generates a basic 20x20 grid to prevent crashes when map data is missing.
   */
  private getMockMap(mapId: number) {
    return {
      id: mapId,
      width: 20,
      height: 20,
      tiles: Array(400).fill(1),
      collision: Array(400).fill(0), // 0 is walkable
    };
  }

  async loadMap(mapId: number) {
    if (this.currentMapId === mapId) return;
    
    console.log(`Fetching map data for map ${mapId}...`);
    let mapData;

    try {
      // Try to fetch from the real endpoint with the requested .json extension
      const response = await fetch(`/api/maps/${mapId}.json`);
      if (!response.ok) {
        throw new Error(`Map ${mapId} not found (Status: ${response.status})`);
      }
      mapData = await response.json();
      console.log(`Real map data loaded for Map ${mapId}`);
    } catch (error) {
      console.warn(`Failed to fetch map ${mapId}, falling back to mock data:`, error);
      mapData = this.getMockMap(mapId);
    }

    this.currentMapId = mapId;
    this.renderMap(mapData);
  }

  private renderMap(mapData: any) {
    // Clear the old map graphics
    this.container.removeChildren();

    const TILE_SIZE = 32;
    const mapGraphics = new PIXI.Graphics();

    // Use 'collision' field if available, otherwise fallback to 'pass'
    const collisionData = mapData.collision || mapData.pass || [];

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const index = x + y * mapData.width;
        
        // 0 is usually walkable (green), anything else is blocked (red)
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