"use client";

export interface MapManifest {
  version: string;
  maps: Record<string, string>;
}

class AssetManager {
  private baseURL = "http://localhost:2010/assets/maps/";
  private remoteManifest: MapManifest | null = null;
  private cacheVersion = "v1";

  async init() {
    console.log("AssetManager initialized with native browser caching");
  }

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
      await Promise.all(batch.map(async (mapId) => {
        try {
          const mapData = await this.fetchMapWithRetry(mapId);
          await this.saveMapToCache(mapId, mapData);
          
          // Update local manifest entry
          localManifest[mapId] = this.remoteManifest!.maps[mapId];
          this.saveLocalManifest(localManifest);
          
          completed++;
          onProgress(completed, total);
        } catch (error) {
          console.error(`Failed to download map ${mapId}:`, error);
          throw error;
        }
      }));
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