import * as PIXI from 'pixi.js';
import { MapData } from '../assets/types';
import { createTileSprite } from './tileFactory';
import { createSObjContainer } from './sobjFactory';

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
            for (const sprite of chunk.ground) {
                if (sprite.filters && sprite.filters.length > 0) {
                    sprite.filters[0].uniforms.uAnimOffset = tick;
                }
            }
            for (const container of chunk.objects) {
                for (const child of container.children) {
                    if (child.filters && child.filters.length > 0) {
                        child.filters[0].uniforms.uAnimOffset = tick;
                    }
                }
            }
        }
    }

    private buildChunk(cx: number, cy: number, key: string) {
        const chunkCache: ChunkCache = { ground: [], objects: [] };

        const startX = cx * CHUNK_SIZE;
        const startY = cy * CHUNK_SIZE;
        
        const endX = Math.min(startX + CHUNK_SIZE, this.mapData.width);
        const endY = Math.min(startY + CHUNK_SIZE, this.mapData.height);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = y * this.mapData.width + x;
                const tile = this.mapData.tiles[index];
                
                if (!tile) continue;

                if (tile.ab > 0) {
                    const groundSprite = createTileSprite(tile.ab, x, y);
                    if (groundSprite) {
                        this.groundContainer.addChild(groundSprite);
                        chunkCache.ground.push(groundSprite);
                    }
                }

                if (tile.sobj >= 0) {
                    const objContainer = createSObjContainer(tile.sobj, x, y);
                    if (objContainer) {
                        // Strict Y-sorting constraint: zIndex MUST map to tileY
                        objContainer.zIndex = y; 
                        this.objectContainer.addChild(objContainer);
                        chunkCache.objects.push(objContainer);
                    }
                }
            }
        }

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