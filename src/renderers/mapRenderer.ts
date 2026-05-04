import * as PIXI from "pixi.js";

export interface Tile {
  bgId: number;
  attributes: number;
  fgId: number;
}

export interface MapData {
  width: number;
  height: number;
  tiles: Tile[];
}

export class MapRenderer {
  private container: PIXI.Container;
  private TILE_SIZE = 32;

  constructor(container: PIXI.Container) {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    container.addChild(this.container);
  }

  /**
   * Renders the map based on the provided map data.
   * Iterates through tiles and creates sprites for background and foreground layers.
   */
  renderMap(mapData: MapData) {
    // Clear existing map sprites
    this.container.removeChildren();

    const { width, height, tiles } = mapData;

    tiles.forEach((tile, index) => {
      const x = (index % width) * this.TILE_SIZE;
      const y = Math.floor(index / width) * this.TILE_SIZE;

      // Render Background Layer (Floor)
      if (tile.bgId > 0) {
        const bgSprite = new PIXI.Sprite(this.getTileTexture("bg", tile.bgId));
        bgSprite.x = x;
        bgSprite.y = y;
        bgSprite.width = this.TILE_SIZE;
        bgSprite.height = this.TILE_SIZE;
        bgSprite.zIndex = 0;
        // Tint green for background debugging
        bgSprite.tint = 0x22c55e; 
        this.container.addChild(bgSprite);
      }

      // Render Foreground Layer (Walls/Trees)
      if (tile.fgId > 0) {
        const fgSprite = new PIXI.Sprite(this.getTileTexture("fg", tile.fgId));
        fgSprite.x = x;
        fgSprite.y = y;
        fgSprite.width = this.TILE_SIZE;
        fgSprite.height = this.TILE_SIZE;
        fgSprite.zIndex = 10; // Higher zIndex so entities can walk behind
        // Tint brown for foreground debugging
        fgSprite.tint = 0x78350f;
        this.container.addChild(fgSprite);
      }
    });

    console.log(`Map rendered: ${width}x${height}, ${tiles.length} tiles.`);
  }

  /**
   * Placeholder function for asset loading.
   * Currently returns a white texture with a tint for debugging.
   */
  private getTileTexture(type: "bg" | "fg", id: number): PIXI.Texture {
    // In the future, this will return textures from TILE.EPF or TILEC.EPF
    return PIXI.Texture.WHITE;
  }

  init() {
    // Initial setup if needed, currently handled by renderMap
    console.log("Map renderer initialized");
  }
}