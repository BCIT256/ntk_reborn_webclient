import * as PIXI from 'pixi.js';
import { MapData } from '../assets/types';
import { createTileSprite } from './tileFactory';
import { createSObjContainer } from './sobjFactory';
import { AssetManager } from '../managers/assetManager';

const CHUNK_SIZE = 16;
const TILE_SIZE = 48;

interface ChunkCache {
    ground: PIXI.Sprite[];
    objects: PIXI.Container[];
}

export class ChunkedMapRenderer {
    public groundContainer: PIXI.Container;
    public objectContainer: PIXI.Container;
    private mapData: MapData;
    private loadedChunks: Map<string, ChunkCache> = new Map();

    constructor(mapData: MapData) {
        this.mapData = mapData;
        
        this.groundContainer = new PIXI.Container();
        
        this.objectContainer = new PIXI.Container();
        this.objectContainer.sortableChildren = true; // Essential for Y-sorting

        // Apply dummy filters for now, pending Multi-Texture Batcher
        // as the current shader is too complex to handle many tiles in one pass
        const colorMatrix = new PIXI.ColorMatrixFilter();
        this.groundContainer.filters = [colorMatrix];
        this.objectContainer.filters = [colorMatrix];
    }

    public updateVisibleChunks(viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number) {
        // Calculate the chunk bounds with a 1-chunk margin
        const startCX = Math.floor(viewMinX / CHUNK_SIZE) - 1;
        const startCY = Math.floor(viewMinY / CHUNK_SIZE) - 1;
        const endCX = Math.ceil(viewMaxX / CHUNK_SIZE) + 1;
        const endCY = Math.ceil(viewMaxY / CHUNK_SIZE) + 1;

        const currentVisibleKeys = new Set<string>();

        // Create new chunks that came into view
        for (let cy = startCY; cy <= endCY; cy++) {
            for (let cx = startCX; cx <= endCX; cx++) {
                if (cx < 0 || cy < 0 || cx * CHUNK_SIZE >= this.mapData.width || cy * CHUNK_SIZE >= this.mapData.height) {
                    continue; // Chunk is out of map bounds
                }

                const key = `${cx},${cy}`;
                currentVisibleKeys.add(key);

                if (!this.loadedChunks.has(key)) {
                    this.buildChunk(cx, cy, key);
                }
            }
        }

        // Cull chunks that left the view
        for (const [key, chunk] of this.loadedChunks.entries()) {
            if (!currentVisibleKeys.has(key)) {
                this.cullChunk(key, chunk);
            }
        }
    }

    public updateAnimations(tick: number) {
        for (const chunk of this.loadedChunks.values()) {
            // Disabled per-sprite animation updates for performance
            // Pending transition to Multi-Texture Batcher
        }
    }

    private buildChunk(cx: number, cy: number, key: string) {
        if (cx === 0 && cy === 0) {
            console.log("Map Data Sample (First 5 tiles):");
            for (let i = 0; i < Math.min(5, this.mapData.tiles?.length || 0); i++) {
                const tileData = this.mapData.tiles[i];
                const ab = typeof tileData === 'number' ? tileData : (tileData as any)?.ab;
                const frameMeta = ab !== undefined ? AssetManager.atlasMeta?.frames[ab] : null;
                console.log(`Tile ${i}: ab=${ab}, atlas_id=${frameMeta?.atlas_id}, frame_meta=`, frameMeta);
            }
        }

        const chunkCache: ChunkCache = { ground: [], objects: [] };

        const startX = cx * CHUNK_SIZE;
        const startY = cy * CHUNK_SIZE;
        
        const endX = Math.min(startX + CHUNK_SIZE, this.mapData.width);
        const endY = Math.min(startY + CHUNK_SIZE, this.mapData.height);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = y * this.mapData.width + x;
                const tileData = this.mapData.tiles ? this.mapData.tiles[index] : undefined;
                
                if (tileData === undefined || tileData === null) continue;

                // Support both {ab: 1} and flat number 1
                const ab = typeof tileData === 'number' ? tileData : (tileData as any).ab;
                let sobj = typeof tileData === 'number' ? 0 : ((tileData as any).sobj || 0);

                // If the map uses a separate static_objects array and we have it, override sobj
                if ((this.mapData as any).static_objects && (this.mapData as any).static_objects[index] !== undefined) {
                    sobj = (this.mapData as any).static_objects[index];
                }

                if (ab !== undefined && ab !== null && ab >= 0) {
                    const groundSprite = createTileSprite(ab, x, y);
                    if (groundSprite) {
                        this.groundContainer.addChild(groundSprite);
                        chunkCache.ground.push(groundSprite);
                    }
                }

                if (sobj > 0) {
                    const objContainer = createSObjContainer(sobj, x, y);
                    if (objContainer) {
                        // Strict Y-sorting constraint: zIndex MUST map to tileY
                        objContainer.zIndex = y; 
                        this.objectContainer.addChild(objContainer);
                        chunkCache.objects.push(objContainer);
                    }
                }
            }
        }

        console.log(`MapRenderer: Building chunk ${key} with ${chunkCache.ground.length} tiles`);

        this.loadedChunks.set(key, chunkCache);
    }

    private cullChunk(key: string, chunk: ChunkCache) {
        // Memory Leak Prevention: Destroying sprites and containers properly
        for (const sprite of chunk.ground) {
            this.groundContainer.removeChild(sprite);
            sprite.destroy({ children: true });
        }
        
        for (const container of chunk.objects) {
            this.objectContainer.removeChild(container);
            container.destroy({ children: true });
        }
        
        this.loadedChunks.delete(key);
    }

    public destroy() {
        for (const [key, chunk] of this.loadedChunks.entries()) {
            this.cullChunk(key, chunk);
        }
        this.groundContainer.destroy({ children: true });
        this.objectContainer.destroy({ children: true });
    }
}