import * as PIXI from 'pixi.js';
import { AtlasMeta, PaletteMetaFile, TblData, SObjTblData, MapData } from '../assets/types';

class AssetManagerSingleton {
    public atlasMeta: AtlasMeta | null = null;
    public tblData: TblData | null = null;
    public paletteMeta: PaletteMetaFile | null = null;
    
    public sobjTbl: SObjTblData | null = null;
    public tilecTbl: TblData | null = null;
    public tilecAtlasMeta: AtlasMeta | null = null;
    public currentMap: MapData | null = null;
    public mapManifest: any = null;

    public atlases: PIXI.BaseTexture[] = [];
    public masks: PIXI.BaseTexture[] = [];
    
    public tilecAtlases: PIXI.BaseTexture[] = [];
    public tilecMasks: PIXI.BaseTexture[] = [];
    
    public paletteTexture: PIXI.BaseTexture | null = null;

    public async fetchAssets() {
        try {
            const [atlasRes, tblRes, palRes, tilecTblRes, tilecAtlasRes, manifestRes] = await Promise.all([
                fetch('http://localhost:2011/assets/tiles/tile_atlas.json'),
                fetch('http://localhost:2011/assets/tables/tile_tbl.json'),
                fetch('http://localhost:2011/assets/palettes/palette_meta.json'),
                fetch('http://localhost:2011/assets/tables/tilec_tbl.json'),
                fetch('http://localhost:2011/assets/tiles/tilec_atlas.json'),
                fetch('http://localhost:2011/assets/maps/manifest.json')
            ]);

            this.atlasMeta = await atlasRes.json();
            this.tblData = await tblRes.json();
            this.paletteMeta = await palRes.json();
            
            this.tilecTbl = await tilecTblRes.json();
            this.tilecAtlasMeta = await tilecAtlasRes.json();
            this.mapManifest = await manifestRes.json();
        } catch (error) {
            console.error("Failed to load base JSON metadata:", error);
        }

        try {
            const sobjTblRes = await fetch('http://localhost:2011/assets/tables/sobj_tbl.json');
            if (sobjTblRes.ok) {
                this.sobjTbl = await sobjTblRes.json();
            } else {
                console.error("Failed to fetch sobj_tbl.json", sobjTblRes.status);
            }
        } catch (error) {
            console.error("Error loading sobj_tbl.json:", error);
        }

        console.log("Metadata loaded successfully");
    }

    public async loadMap(mapId: number): Promise<void> {
        try {
            const paddedId = String(mapId).padStart(6, '0');
            const url = `http://localhost:2011/assets/maps/tk${paddedId}.json`;
            const mapRes = await fetch(url);

            if (mapRes.status === 404) {
                console.warn(`Map ${mapId} not found, skipping.`);
                this.currentMap = null;
                return;
            }

            if (!mapRes.ok) {
                console.error(`Failed to load map ${mapId}: HTTP ${mapRes.status}`);
                this.currentMap = null;
                return;
            }

            const data = await mapRes.json();

            // Validate the response looks like actual map data
            if (!data || !data.tiles || !data.width || !data.height) {
                console.error(`Map ${mapId} response is missing required fields (tiles/width/height), skipping.`);
                this.currentMap = null;
                return;
            }

            this.currentMap = data;
        } catch (error) {
            console.error(`Failed to load map ${mapId}:`, error);
            this.currentMap = null;
        }
    }

    public async loadTextures() {
        if (!this.atlasMeta || !this.tilecAtlasMeta) {
            console.error("Cannot load textures: Atlas metadata not loaded.");
            return;
        }

        console.log(`Loading ${this.atlasMeta.atlas_count} tile atlases and ${this.tilecAtlasMeta.atlas_count} tilec atlases...`);

        // Must be NEAREST for strict pixel art rendering
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        const loadPromises: Promise<any>[] = [];

        const loadTexture = async (url: string) => {
            try {
                // Fetch the image as a blob to avoid raw Image crossOrigin issues
                const res = await fetch(url);
                if (!res.ok) {
                    console.error(`Failed to fetch texture: ${res.statusText} (${url})`);
                    return new PIXI.BaseTexture();
                }
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                
                return new Promise<PIXI.BaseTexture>((resolve) => {
                    const baseTex = PIXI.BaseTexture.from(objectUrl, {
                        scaleMode: PIXI.SCALE_MODES.NEAREST
                    });
                    baseTex.scaleMode = PIXI.SCALE_MODES.NEAREST;
                    if (baseTex.valid) {
                        URL.revokeObjectURL(objectUrl);
                        console.log(`Loaded texture: ${url}`);
                        resolve(baseTex);
                    } else {
                        baseTex.once('loaded', () => {
                            URL.revokeObjectURL(objectUrl);
                            console.log(`Loaded texture: ${url}`);
                            resolve(baseTex);
                        });
                        baseTex.once('error', (e) => {
                            URL.revokeObjectURL(objectUrl);
                            console.error(`Error loading image element for texture: ${url}`, e);
                            resolve(new PIXI.BaseTexture());
                        });
                    }
                });
            } catch (err) {
                console.error("Failed to load texture", url, err);
                return new PIXI.BaseTexture();
            }
        };

        // Load the master palette texture
        loadPromises.push(
            loadTexture('http://localhost:2011/assets/palettes/tile_palettes.png').then(tex => {
                this.paletteTexture = tex;
            })
        );
        
        // Load index atlases and mask atlases
        for (let i = 0; i < this.atlasMeta.atlas_count; i++) {
            loadPromises.push(
                loadTexture(`http://localhost:2011/assets/tiles/atlas_tile_${i}.png`).then(tex => {
                    this.atlases[i] = tex;
                })
            );
            loadPromises.push(
                loadTexture(`http://localhost:2011/assets/tiles/atlas_tile_${i}_mask.png`).then(tex => {
                    this.masks[i] = tex;
                })
            );
        }

        // Load TileC index atlases and mask atlases
        for (let i = 0; i < this.tilecAtlasMeta.atlas_count; i++) {
            loadPromises.push(
                loadTexture(`http://localhost:2011/assets/tiles/atlas_tilec_${i}.png`).then(tex => {
                    this.tilecAtlases[i] = tex;
                })
            );
            loadPromises.push(
                loadTexture(`http://localhost:2011/assets/tiles/atlas_tilec_${i}_mask.png`).then(tex => {
                    this.tilecMasks[i] = tex;
                })
            );
        }

        await Promise.all(loadPromises);
    }
}

export const AssetManager = new AssetManagerSingleton();