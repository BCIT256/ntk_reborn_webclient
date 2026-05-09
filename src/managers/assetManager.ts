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
            const [atlasRes, tblRes, palRes, sobjTblRes, tilecTblRes, tilecAtlasRes, manifestRes] = await Promise.all([
                fetch('http://localhost:2011/assets/tiles/tile_atlas.json'),
                fetch('http://localhost:2011/assets/tables/tile_tbl.json'),
                fetch('http://localhost:2011/assets/palettes/palette_meta.json'),
                fetch('http://localhost:2011/assets/tables/sobj_tbl.json'),
                fetch('http://localhost:2011/assets/tables/tilec_tbl.json'),
                fetch('http://localhost:2011/assets/tiles/tilec_atlas.json'),
                fetch('http://localhost:2011/assets/maps/manifest.json')
            ]);

            this.atlasMeta = await atlasRes.json();
            this.tblData = await tblRes.json();
            this.paletteMeta = await palRes.json();
            
            this.sobjTbl = await sobjTblRes.json();
            this.tilecTbl = await tilecTblRes.json();
            this.tilecAtlasMeta = await tilecAtlasRes.json();
            this.mapManifest = await manifestRes.json();
        } catch (error) {
            console.error("Failed to load JSON metadata:", error);
        }
    }

    public async loadMap(mapId: number): Promise<void> {
        try {
            const paddedId = String(mapId).padStart(6, '0');
            const url = `http://localhost:2011/assets/maps/tk${paddedId}.json`;
            const mapRes = await fetch(url);
            this.currentMap = await mapRes.json();
        } catch (error) {
            console.error(`Failed to load map ${mapId}:`, error);
        }
    }

    public async loadTextures() {
        if (!this.atlasMeta || !this.tilecAtlasMeta) {
            console.error("Cannot load textures: Atlas metadata not loaded.");
            return;
        }

        // Must be NEAREST for strict pixel art rendering
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        const loadPromises: Promise<any>[] = [];

        const loadTexture = async (url: string) => {
            try {
                // Fetch the image as a blob to avoid raw Image crossOrigin issues
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Failed to fetch texture: ${res.statusText}`);
                }
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                
                // Instead of PIXI.Assets.load, just create an Image and pass to BaseTexture
                // This bypasses PIXI's internal asset parsing issues with blobs
                return new Promise<PIXI.BaseTexture>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const baseTex = new PIXI.BaseTexture(img, {
                            scaleMode: PIXI.SCALE_MODES.NEAREST
                        });
                        URL.revokeObjectURL(objectUrl);
                        resolve(baseTex);
                    };
                    img.onerror = (e) => {
                        URL.revokeObjectURL(objectUrl);
                        reject(e);
                    };
                    img.src = objectUrl;
                });
            } catch (err) {
                console.error("Failed to load texture", url, err);
                throw err;
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
                loadTexture(`http://localhost:2011/assets/tiles/atlas_${i}.png`).then(tex => {
                    this.atlases[i] = tex;
                })
            );
            loadPromises.push(
                loadTexture(`http://localhost:2011/assets/tiles/atlas_${i}_mask.png`).then(tex => {
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