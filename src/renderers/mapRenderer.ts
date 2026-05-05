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

  async loadMap(mapId: number) {
    if (this.currentMapId === mapId) return; // Already on this map
    
    console.log(`Fetching map data for map ${mapId}...`);
    try {
      // Fetch the static map JSON from the Axum HTTP endpoint
      const response = await fetch(`http://localhost:3000/api/maps/${mapId}`);
      if (!response.ok) throw new Error("Map not found on HTTP server.");
      
      const mapData = await response.json();
      console.log(`Map data loaded: ${mapData.width}x${mapData.height}`);
      
      this.currentMapId = mapId;
      this.renderMap(mapData);
    } catch (error) {
      console.error("Failed to load map:", error);
    }
  }

  private renderMap(mapData: any) {
    // Clear the old map graphics
    this.container.removeChildren();

    const TILE_SIZE = 32; // Assuming 32x32 pixels per tile for now
    const mapGraphics = new PIXI.Graphics();

    // Iterate through the 1D array as a 2D grid
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const index = x + y * mapData.width;
        
        // Grab the collision byte (0 is usually walkable in Nexus)
        const pass = mapData.pass[index];

        // Draw walkable areas as dark green, blocked as dark red
        const color = pass === 0 ? 0x228822 : 0x882222;

        mapGraphics.beginFill(color);
        mapGraphics.lineStyle(1, 0x000000, 0.1); // Faint grid lines
        mapGraphics.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        mapGraphics.endFill();
      }
    }

    // Add the generated grid to the map container
    this.container.addChild(mapGraphics);
    console.log(`Rendered map visuals for Map ID: ${mapData.id}`);
  }
}