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
    await caches.delete('yuroxia-maps');
    console.log("Map cache forcefully cleared for debugging.");
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

    // Legacy monolithic spritesheets have been removed. 
    // Character layers are now loaded dynamically via EPF JSONs.
  }

  hasSpritesheet(key: string): boolean {
    return this.spritesheets.has(key);
  }

  /**
   * Look up a single tile texture by tileId.
   * Assumes atlas frames are named like "tile_15.png".
   */
  getTileTexture(tileId: number): PIXI.Texture | null {
    return null;
  }

  getPlayerFrames(action: string, direction: string): PIXI.Texture[] {
    return [];
  }

  getEntityFrames(graphicId: string, action: string, direction: string): PIXI.Texture[] {
    return [];
  }

  /**
   * Check if a spritesheet exists for a given graphic_id.
   */
  hasEntitySpritesheet(graphicId: string): boolean {
    return false;
  }

  /**
   * Resolves an entity's state into an actual texture frame.
   * Looks through all loaded spritesheets.
   */
  getTextureByName(textureName: string): PIXI.Texture | null {
    for (const spritesheet of this.spritesheets.values()) {
      if (spritesheet.textures && spritesheet.textures[textureName]) {
        return spritesheet.textures[textureName];
      }
    }
    return null;
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
            if (mapData !== null) {
              await this.saveMapToCache(mapId, mapData);

              localManifest[mapId] = this.remoteManifest!.maps[mapId];
              this.saveLocalManifest(localManifest);
            } else {
              // If it was skipped (e.g. 404), mark it in the local manifest anyway 
              // so we don't repeatedly try to download a missing map
              localManifest[mapId] = this.remoteManifest!.maps[mapId];
              this.saveLocalManifest(localManifest);
            }

            completed++;
            onProgress(completed, total);
          } catch (error) {
            console.error(`Failed to download map ${mapId}:`, error);
            // Continue the sequence by not throwing here.
          }
        })
      );
    }
  }

  private async fetchMapWithRetry(mapId: string, retries = 1): Promise<any> {
    try {
      const paddedId = String(mapId).padStart(6, '0');
      const response = await fetch(`${this.baseURL}tk${paddedId}.json`);
      if (response.status === 404) {
        console.warn(`Map ${mapId} not found, skipping.`);
        return null;
      }
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
      const cache = await caches.open('yuroxia-maps');
      const cacheKey = this.getCacheKey(mapId);
      const url = `${window.location.origin}/local-cache/${cacheKey}.json`;
      const response = new Response(JSON.stringify(mapData), {
        headers: { "Content-Type": "application/json" }
      });
      await cache.put(url, response);
    } catch (error) {
      console.warn(`Could not save map ${mapId} to Cache API:`, error);
    }
  }

  async getMap(mapId: string): Promise<any> {
    const cacheKey = this.getCacheKey(mapId);
    try {
      const cache = await caches.open('yuroxia-maps');
      const url = `${window.location.origin}/local-cache/${cacheKey}.json`;
      const response = await cache.match(url);
      
      if (response) {
        return await response.json();
      }
      
      // Fallback to fetch if not in cache (should be in cache via patching, but just in case)
      console.warn(`Map ${mapId} not found in cache, fetching...`);
      const paddedId = String(mapId).padStart(6, '0');
      const fetchResponse = await fetch(`${this.baseURL}tk${paddedId}.json`);
      if (fetchResponse.ok) {
        const mapData = await fetchResponse.json();
        await this.saveMapToCache(mapId, mapData);
        return mapData;
      }
      
      throw new Error("Map not in cache and fetch failed");
    } catch (error) {
      console.warn(`Map ${mapId} fallback failed:`, error);
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