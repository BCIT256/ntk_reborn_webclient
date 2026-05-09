import * as PIXI from 'pixi.js';
import { AssetManager } from '../managers/assetManager';
import { createPaletteFilter } from '../shaders/paletteShader';
import { PaletteAnimRange } from '../assets/types';

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

    // 4. Create Sprite
    const sprite = new PIXI.Sprite(indexTexture);
    
    // Calculate final position based on grid (48x48 typical for NTK tiles, adjusting by frame offsets)
    sprite.x = (tileX * 48) + left;
    sprite.y = (tileY * 48) + top;

    // 5. Setup Palette Filter
    const paletteInfo = AssetManager.paletteMeta.tile_palettes.find(p => p.index === paletteIndex);
    const animRanges: [number, number][] = paletteInfo 
        ? paletteInfo.animation_ranges.map(r => [r.min_index, r.max_index])
        : [];

    const masterPaletteHeight = 1024;
    const normalizedRow = (paletteIndex + 0.5) / masterPaletteHeight;

    const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
    sprite.filters = [filter];

    return sprite;
}