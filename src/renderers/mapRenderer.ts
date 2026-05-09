import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";

const TILE_SIZE = 32;
const MAX_TILES = 10000;

export class MapRenderer {
  private container: PIXI.Container;
  private particleContainer: PIXI.ParticleContainer;
  private fallbackContainer: PIXI.Container;
  private currentMapId: string | null = null;

  constructor(container: PIXI.Container) {
    this.container = new PIXI.Container();
    container.addChild(this.container);

    // ParticleContainer for atlas-textured tiles (same base texture → batched draw calls).
    // uvs must be true so each sprite can show a different atlas frame.
    this.particleContainer = new PIXI.ParticleContainer(MAX_TILES, {
      position: true,
      scale: false,
      rotation: false,
      uvs: true,
      tint: true,
    });

    // Regular container for fallback coloured rectangles when atlas textures are missing.
    this.fallbackContainer = new PIXI.Container();

    this.container.addChild(this.particleContainer);
    this.container.addChild(this.fallbackContainer);
  }

  init() {
    console.log("Map renderer initialized (ParticleContainer + Sprite atlas mode)");
  }

  /**
   * Destroy all map sprites and graphics to prevent memory leaks.
   *
   * IMPORTANT: We must recursively destroy all children, not just remove them.
   * Simply calling removeChildren() or setting visible=false will leak GPU
   * textures and crash the browser after several map transitions.
   */
  destroy() {
    // ParticleContainer children: destroy each sprite individually
    // (ParticleContainer doesn't support destroy with children:true)
    while (this.particleContainer.children.length > 0) {
      const child = this.particleContainer.children[0] as PIXI.Sprite;
      this.particleContainer.removeChild(child);
      child.destroy();
    }

    // Fallback Graphics: destroy with children to clean up all Graphics objects
    this.fallbackContainer.destroy({ children: true });

    // Recreate the fallback container since we destroyed it
    this.fallbackContainer = new PIXI.Container();
    this.container.addChild(this.fallbackContainer);

    this.currentMapId = null;

    console.log("MapRenderer: old map destroyed and memory freed.");
  }

  async loadMap(mapId: number | string) {
    const mapIdStr = String(mapId);
    if (this.currentMapId === mapIdStr) return;

    console.log(`Loading map ${mapIdStr} from local cache...`);
    let mapData;

    try {
      mapData = await assetManager.getMap(mapIdStr);
      console.log(`Map data loaded for Map ${mapIdStr}`);
    } catch (error) {
      console.warn(`Failed to find map ${mapIdStr} in cache:`, error);
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
    this.particleContainer.removeChildren();
    this.fallbackContainer.removeChildren();

    const tiles = mapData.tiles || [];
    const collisionData = mapData.collision || mapData.pass || [];
    const hasTileset = assetManager.hasSpritesheet("tileset");

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const index = x + y * mapData.width;
        const tileId = tiles[index] ?? 1;
        const isBlocked = collisionData[index] !== 0;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (hasTileset) {
          const texture = assetManager.getTileTexture(tileId);
          if (texture) {
            const sprite = new PIXI.Sprite(texture);
            sprite.x = px;
            sprite.y = py;
            this.particleContainer.addChild(sprite);
            continue;
          }
        }

        // No atlas texture available — draw a coloured rectangle fallback
        this.addFallbackTile(px, py, isBlocked);
      }
    }

    console.log(
      `Rendered ${mapData.width}x${mapData.height} map (ID: ${mapData.id}) ` +
        `[Atlas: ${this.particleContainer.children.length}, Fallback: ${this.fallbackContainer.children.length}]`
    );
  }

  private addFallbackTile(x: number, y: number, isBlocked: boolean) {
    const g = new PIXI.Graphics();
    const color = isBlocked ? 0x882222 : 0x228822;
    g.beginFill(color);
    g.lineStyle(1, 0x000000, 0.1);
    g.drawRect(x, y, TILE_SIZE, TILE_SIZE);
    g.endFill();
    this.fallbackContainer.addChild(g);
  }
}
