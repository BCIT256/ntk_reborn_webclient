import * as PIXI from 'pixi.js';
import { AtlasMeta, PaletteMetaFile, TblData } from '../assets/types';

class AssetManagerSingleton {
    public atlasMeta: AtlasMeta | null = null;
    public tblData: TblData | null = null;
    public paletteMeta: PaletteMetaFile | null = null;

    public atlases: PIXI.BaseTexture[] = [];
    public masks: PIXI.BaseTexture[] = [];
    public paletteTexture: PIXI.BaseTexture | null = null;

    public async fetchAssets() {
        try {
            const [atlasRes, tblRes, palRes] = await Promise.all([
                fetch('/assets/tiles/tile_atlas.json'),
                fetch('/assets/tables/tile_tbl.json'),
                fetch('/assets/palettes/palette_meta.json')
            ]);

            this.atlasMeta = await atlasRes.json();
            this.tblData = await tblRes.json();
            this.paletteMeta = await palRes.json();
        } catch (error) {
            console.error("Failed to load JSON metadata:", error);
        }
    }

    public async loadTextures() {
        if (!this.atlasMeta) {
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

        // We can optionally wait for them to load via PIXI.Assets or similar, 
        // but BaseTexture.from is generally synchronous in returning the object, loading image async.
    }
}

export const AssetManager = new AssetManagerSingleton();
