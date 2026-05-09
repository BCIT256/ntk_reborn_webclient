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
                fetch('/assets/tiles/tile_atlas.json'),
                fetch('/assets/tables/tile_tbl.json'),
                fetch('/assets/palettes/palette_meta.json'),
                fetch('/assets/tables/sobj_tbl.json'),
                fetch('/assets/tables/tilec_tbl.json'),
                fetch('/assets/tiles/tilec_atlas.json'),
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
            const paddedId = String(mapId).padStart(4, '0');
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

        // Load the master palette texture
        this.paletteTexture = PIXI.BaseTexture.from('/assets/palettes/tile_palettes.png', {
            scaleMode: PIXI.SCALE_MODES.NEAREST
        });
        
        // Load index atlases and mask atlases
        for (let i = 0; i < this.atlasMeta.atlas_count; i++) {
            const atlasTex = PIXI.BaseTexture.from(`/assets/tiles/atlas_${i}.png`, {
                scaleMode: PIXI.SCALE_MODES.NEAREST
            });
            const maskTex = PIXI.BaseTexture.from(`/assets/tiles/atlas_${i}_mask.png`, {
                scaleMode: PIXI.SCALE_MODES.NEAREST
            });

            this.atlases.push(atlasTex);
            this.masks.push(maskTex);
        }

        // Load TileC index atlases and mask atlases
        for (let i = 0; i < this.tilecAtlasMeta.atlas_count; i++) {
            const atlasTex = PIXI.BaseTexture.from(`/assets/tiles/atlas_tilec_${i}.png`, {
                scaleMode: PIXI.SCALE_MODES.NEAREST
            });
            const maskTex = PIXI.BaseTexture.from(`/assets/tiles/atlas_tilec_${i}_mask.png`, {
                scaleMode: PIXI.SCALE_MODES.NEAREST
            });

            this.tilecAtlases.push(atlasTex);
            this.tilecMasks.push(maskTex);
        }

        // We can optionally wait for them to load via PIXI.Assets or similar, 
        // but BaseTexture.from is generally synchronous in returning the object, loading image async.
    }
}

export const AssetManager = new AssetManagerSingleton();