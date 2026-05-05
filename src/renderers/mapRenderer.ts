import * as PIXI from "pixi.js";

export class MapRenderer {
  private container: PIXI.Container;
  private currentMapId: number | null = null;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  // Future implementation for @pixi/tilemap
  init() {
    console.log("Map renderer initialized");
  }

  async loadMap(mapId: number) {
    if (this.currentMapId === mapId) return; // Already on this map
    
    console.log(`Fetching map data for map ${mapId}...`);
    try {
      // Fetch the static map JSON from the new Axum HTTP endpoint
      const response = await fetch(`http://localhost:3000/api/maps/${mapId}`);
      if (!response.ok) throw new Error("Map not found");
      
      const mapData = await response.json();
      console.log("Map data loaded:", mapData);
      
      this.currentMapId = mapId;
      this.renderMap(mapData);
    } catch (error) {
      console.error("Failed to load map:", error);
    }
  }

  private renderMap(mapData: any) {
    // Clear the old map
    this.container.removeChildren();

    // In our next steps, we will loop through mapData.tiles and mapData.width/height
    // to place PIXI.Sprites for the background tiles here!
    console.log("Ready to render map visuals!");
  }
}