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
    const paletteInfo = AssetManager.paletteMeta.tile_palettes.palettes.find((p: any) => p.index === paletteIndex);
    const animRanges: [number, number][] = paletteInfo 
        ? paletteInfo.animation_ranges.map((r: any) => [r.min_index, r.max_index])
        : [];

    // Assuming the palette texture is a single column of palettes, where paletteIndex maps to row
    // If the palette texture is e.g. 256xN, we need normalized V coordinate for row:
    // (We pass raw index, shader doesn't do / max_rows, so we must calculate it or pass raw if shader changes)
    // We update the shader uniform uPaletteRow to use normalized 0.0-1.0 or pixel coordinates. 
    // Wait, the shader uses `vec2((index + 0.5) / 256.0, uPaletteRow)`. So uPaletteRow should be normalized V.
    // Assuming 256 rows max for example, we'd do (paletteIndex + 0.5) / paletteTexture.height
    // Since texture might not be loaded completely synchronously for width/height in some setups, we might just pass paletteIndex / 256.0 if we know it's a fixed height.
    // For now, let's pass a roughly normalized value, or assume the user wants it to be exact.
    // Let's pass (paletteIndex + 0.5) / (AssetManager.paletteTexture.height || 256);
    const rowHeight = AssetManager.paletteTexture.height || 256;
    const normalizedRow = (paletteIndex + 0.5) / rowHeight;

    const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
    
    sprite.filters = [filter];

    return sprite;
}