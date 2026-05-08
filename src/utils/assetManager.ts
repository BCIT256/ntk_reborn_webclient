"use client";

import { openDB, IDBPDatabase } from 'idb';

export interface MapManifest {
  version: string;
  maps: Record<string, string>;
}

interface GameDBSchema {
  meta: {
    key: string;
    value: any;
  };
  maps: {
    key: string;
    value: any;
  };
}

class AssetManager {
  private db: IDBPDatabase<GameDBSchema> | null = null;
  private baseURL = "http://localhost:2010/assets/maps/";
  private remoteManifest: MapManifest | null = null;

  async init() {
    if (this.db) return;
    this.db = await openDB<GameDBSchema>('game-assets', 1, {
      upgrade(db) {
        db.createObjectStore('meta');
        db.createObjectStore('maps');
      },
    });
  }

  async syncManifest(): Promise<MapManifest> {
    const response = await fetch(`${this.baseURL}manifest.json`);
    if (!response.ok) throw new Error("Failed to fetch manifest");
    this.remoteManifest = await response.json();
    return this.remoteManifest!;
  }

  async downloadMissingMaps(onProgress: (current: number, total: number) => void) {
    if (!this.db || !this.remoteManifest) throw new Error("AssetManager not initialized or manifest not synced");

    const localManifest = (await this.db.get('meta', 'local_manifest')) as Record<string, string> || {};
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
          await this.db!.put('maps', mapData, mapId);
          
          // Update local manifest entry
          localManifest[mapId] = this.remoteManifest!.maps[mapId];
          await this.db!.put('meta', localManifest, 'local_manifest');
          
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

  async getMap(mapId: string): Promise<any> {
    if (!this.db) await this.init();
    const map = await this.db!.get('maps', mapId);
    if (!map) throw new Error(`Map ${mapId} not found in cache`);
    return map;
  }
}

export const assetManager = new AssetManager();