"use client";

import * as PIXI from "pixi.js";

export interface MapManifest {
  version: string;
  maps: Record<string, string>;
}

class AssetManager {
  private baseURL = "http://localhost:2011/assets/maps/";
  private remoteManifest: MapManifest | null = null;
  private cacheVersion = "v1";

  // Spritesheet storage
  private spritesheets: Map<string, PIXI.Spritesheet> = new Map();
  private spritesheetsLoaded = false;

  async init() {
    console.log("AssetManager initialized with native browser caching");
  }

  /**
   * Preload PixiJS spritesheets from /assets/sprites/.
   * Each load is wrapped in try/catch so missing files don't crash the game.
   * Idempotent — calling again after the first invocation is a no-op.
   */
  async loadSpritesheets(): Promise<void> {
    if (this.spritesheetsLoaded) return;
    this.spritesheetsLoaded = true;

    const spritesheetConfigs = [
      { key: "tileset", path: "/assets/sprites/tileset.json" },
      { key: "player_base", path: "/assets/sprites/player_base.json" },
    ];

    for (const { key, path } of spritesheetConfigs) {
      try {
        const spritesheet = await PIXI.Assets.load(path) as PIXI.Spritesheet;
        if (spritesheet && spritesheet.textures) {
          this.spritesheets.set(key, spritesheet);
          console.log(
            `Loaded spritesheet: ${key} (${Object.keys(spritesheet.textures).length} textures)`
          );
        } else {
          console.warn(`Spritesheet ${key} loaded but has no textures`);
        }
      } catch (error) {
        console.warn(`Failed to load spritesheet ${key} from ${path}:`, error);
      }
    }
  }

  hasSpritesheet(key: string): boolean {
    return this.spritesheets.has(key);
  }

  /**
   * Look up a single tile texture by tileId.
   * Assumes atlas frames are named like "tile_15.png".
   */
  getTileTexture(tileId: number): PIXI.Texture | null {
    const tileset = this.spritesheets.get("tileset");
    if (!tileset || !tileset.textures) return null;
    const frameName = `tile_${tileId}.png`;
    return tileset.textures[frameName] || null;
  }

  /**
   * Return an ordered array of textures for a player animation.
   * action = "walk" | "idle",  direction = "up" | "right" | "down" | "left"
   * Scans for sequentially numbered frames: player_walk_down_1.png, player_walk_down_2.png, …
   */
  getPlayerFrames(action: string, direction: string): PIXI.Texture[] {
    const spritesheet = this.spritesheets.get("player_base");
    if (!spritesheet || !spritesheet.textures) return [];

    const frames: PIXI.Texture[] = [];
    let i = 1;
    while (true) {
      const frameName = `player_${action}_${direction}_${i}.png`;
      const texture = spritesheet.textures[frameName];
      if (!texture) break;
      frames.push(texture);
      i++;
    }
    return frames;
  }

  // ─── Map-data methods (existing) ────────────────────────────────────

  async syncManifest(): Promise<MapManifest> {
    try {
      const response = await fetch(`${this.baseURL}manifest.json`);
      if (!response.ok) throw new Error("Failed to fetch manifest");
      this.remoteManifest = await response.json();
      return this.remoteManifest!;
    } catch (error) {
      console.warn("Could not fetch manifest, using empty manifest:", error);
      return { version: "1.0.0", maps: {} };
    }
  }

  async downloadMissingMaps(onProgress: (current: number, total: number) => void) {
    if (!this.remoteManifest) throw new Error("Manifest not synced");

    const localManifest = this.getLocalManifest();
    const mapsToDownload: string[] = [];

    for (const [mapId, hash] of Object.entries(this.remoteManifest.maps)) {
      if (localManifest[mapId] !== hash) {
        mapsToDownload.push(mapId);
      }
    }

    if (mapsToDownload.length === 0) {
      onProgress(1, 1);
      return;
    }

    let completed = 0;
    const total = mapsToDownload.length;
    const batchSize = 5;

    for (let i = 0; i < mapsToDownload.length; i += batchSize) {
      const batch = mapsToDownload.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (mapId) => {
          try {
            const mapData = await this.fetchMapWithRetry(mapId);
            await this.saveMapToCache(mapId, mapData);

            localManifest[mapId] = this.remoteManifest!.maps[mapId];
            this.saveLocalManifest(localManifest);

            completed++;
            onProgress(completed, total);
          } catch (error) {
            console.error(`Failed to download map ${mapId}:`, error);
            throw error;
          }
        })
      );
    }
  }

  private async fetchMapWithRetry(mapId: string, retries = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${mapId}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (retries > 0) return this.fetchMapWithRetry(mapId, retries - 1);
      throw error;
    }
  }

  private getCacheKey(mapId: string): string {
    return `map_${this.cacheVersion}_${mapId}`;
  }

  private getLocalManifest(): Record<string, string> {
    try {
      const manifest = localStorage.getItem(`manifest_${this.cacheVersion}`);
      return manifest ? JSON.parse(manifest) : {};
    } catch {
      return {};
    }
  }

  private saveLocalManifest(manifest: Record<string, string>): void {
    try {
      localStorage.setItem(`manifest_${this.cacheVersion}`, JSON.stringify(manifest));
    } catch (error) {
      console.warn("Could not save manifest to localStorage:", error);
    }
  }

  private async saveMapToCache(mapId: string, mapData: any): Promise<void> {
    try {
      localStorage.setItem(this.getCacheKey(mapId), JSON.stringify(mapData));
    } catch (error) {
      console.warn(`Could not save map ${mapId} to localStorage:`, error);
    }
  }

  async getMap(mapId: string): Promise<any> {
    const cacheKey = this.getCacheKey(mapId);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      throw new Error("Map not in cache");
    } catch (error) {
      console.warn(`Map ${mapId} not in cache, will use fallback:`, error);
      return this.getMockMap(mapId);
    }
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
}

export const assetManager = new AssetManager();
