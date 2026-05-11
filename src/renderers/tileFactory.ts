import * as PIXI from 'pixi.js';
import { AssetManager } from '../managers/assetManager';
import { createPaletteFilter } from '../shaders/paletteShader';
import { PaletteAnimRange } from '../assets/types';
import { gameApp } from '../gameMain';

const bakedTileCache = new Map<string, PIXI.Texture>();

export function createTileSprite(tileIndex: number, tileX: number, tileY: number): PIXI.Sprite | null {
    if (!AssetManager.atlasMeta || !AssetManager.tblData || !AssetManager.paletteMeta) {
        console.warn('Metadata not fully loaded.');
        return null;
    }

    if (!AssetManager.paletteTexture) {
        console.warn('Textures not loaded.');
        return null;
    }

    // 1. Get TBL palette index
    const paletteIndex = AssetManager.tblData.entries[tileIndex] || 0;

    // 2. Get Frame Meta
    const frameMeta = AssetManager.atlasMeta.frames[tileIndex];
    if (!frameMeta) {
        return null;
    }

    const { atlas_id, x, y, width, height, left, top } = frameMeta;

    // 3. Setup Textures
    const atlasBase = AssetManager.atlases[atlas_id];
    const maskBase = AssetManager.masks[atlas_id];

    if (!atlasBase || !maskBase) {
        return null;
    }

    const frameRect = new PIXI.Rectangle(x, y, width, height);
    const indexTexture = new PIXI.Texture(atlasBase, frameRect);
    const maskTexture = new PIXI.Texture(maskBase, frameRect);
    
    // Using the master palette base texture
    const paletteTexture = new PIXI.Texture(AssetManager.paletteTexture);

    // 5. Setup Palette Filter
    let paletteInfo = null;
    
    const meta = AssetManager.paletteMeta as any;
    if (Array.isArray(meta)) {
        paletteInfo = meta.find(p => p.index === paletteIndex);
    } else if (meta.tile_palettes) {
        if (Array.isArray(meta.tile_palettes)) {
            paletteInfo = meta.tile_palettes.find((p: any) => p.index === paletteIndex);
        } else {
            // In case it's an object mapping index to PaletteMeta
            const arr = Object.values(meta.tile_palettes) as any[];
            paletteInfo = arr.find(p => p.index === paletteIndex);
        }
    }
    
    const animRanges: [number, number][] = paletteInfo
        ? paletteInfo.animation_ranges.map((r: any) => [r.min_index, r.max_index])
        : [];

    let masterPaletteHeight = AssetManager.paletteTexture ? AssetManager.paletteTexture.height : 1024;
    if (masterPaletteHeight <= 1) {
        masterPaletteHeight = 1024;
        console.warn("Palette texture height is invalid (not loaded yet). Using fallback.");
    }
    const normalizedRow = (paletteIndex + 0.5) / masterPaletteHeight;

    const cacheKey = `${atlas_id}_${x}_${y}_${width}_${height}_${paletteIndex}`;
    let bakedTexture = bakedTileCache.get(cacheKey);

    if (!bakedTexture && gameApp) {
        const isTextureValid = AssetManager.paletteTexture ? AssetManager.paletteTexture.valid : false;
        console.log(`Baking tile texture. paletteTexture valid: ${isTextureValid}`);
        const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
        const tempSprite = new PIXI.Sprite(indexTexture);
        tempSprite.filters = [filter];
        bakedTexture = gameApp.renderer.generateTexture(tempSprite);
        bakedTileCache.set(cacheKey, bakedTexture);
    }

    // 4. Create Sprite
    const sprite = new PIXI.Sprite(bakedTexture || indexTexture);
    
    // Calculate final position based on grid (48x48 typical for NTK tiles, adjusting by frame offsets)
    sprite.x = (tileX * 48) + left;
    sprite.y = (tileY * 48) + top;

    // 5. Setup Palette Filter ONLY if baking failed
    if (!bakedTexture) {
        const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
        sprite.filters = [filter];
    }

    return sprite;
}