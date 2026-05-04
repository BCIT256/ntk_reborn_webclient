import * as PIXI from "pixi.js";

export class MapRenderer {
  private container: PIXI.Container;
  private gridGraphics: PIXI.Graphics;
  private TILE_SIZE = 32;
  private MAP_SIZE = 100; // 100x100 tiles

  constructor(container: PIXI.Container) {
    this.container = container;
    this.gridGraphics = new PIXI.Graphics();
    // Add to container immediately so it's at the bottom layer
    this.container.addChild(this.gridGraphics);
  }

  init() {
    const totalSize = this.MAP_SIZE * this.TILE_SIZE;
    
    this.gridGraphics.clear();
    
    // Draw a subtle background fill
    this.gridGraphics.beginFill(0x0f172a); // Dark slate blue
    this.gridGraphics.drawRect(0, 0, totalSize, totalSize);
    this.gridGraphics.endFill();

    // Set line style for the grid
    this.gridGraphics.lineStyle(1, 0x1e293b, 1); // Slightly lighter slate for lines

    // Draw vertical lines
    for (let i = 0; i <= this.MAP_SIZE; i++) {
      const x = i * this.TILE_SIZE;
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, totalSize);
    }

    // Draw horizontal lines
    for (let i = 0; i <= this.MAP_SIZE; i++) {
      const y = i * this.TILE_SIZE;
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(totalSize, y);
    }

    console.log("Map grid initialized");
  }
}