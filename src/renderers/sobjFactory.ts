import * as PIXI from 'pixi.js';
import { AssetManager } from '../managers/assetManager';
import { createPaletteFilter } from '../shaders/paletteShader';

export function createSObjContainer(sobjIndex: number, tileX: number, tileY: number): PIXI.Container | null {
    if (!AssetManager.sobjTbl || !AssetManager.tilecTbl || !AssetManager.tilecAtlasMeta || !AssetManager.paletteMeta) {
        console.warn('SObj metadata not fully loaded.');
        return null;
    }

    if (!AssetManager.paletteTexture) {
        console.warn('Textures not loaded.');
        return null;
    }

    const sobjDef = AssetManager.sobjTbl.entries[sobjIndex];
    if (!sobjDef || sobjDef.height < 1) {
        return null;
    }

    const container = new PIXI.Container();
    
    // Position the container at the tile coordinates
    container.x = tileX * 48;
    container.y = tileY * 48;

    for (let i = 0; i < sobjDef.tile_indices.length; i++) {
        const tilecFrameIndex = sobjDef.tile_indices[i];
        
        // Skip invalid/empty frames
        if (tilecFrameIndex <= 0) continue;

        // 1. Get TBL palette index
        const paletteIndex = AssetManager.tilecTbl.entries[tilecFrameIndex] || 0;

        // 2. Get Frame Meta
        const frameMeta = AssetManager.tilecAtlasMeta.frames[tilecFrameIndex];
        if (!frameMeta) continue;

        const { atlas_id, x, y, width, height, left, top } = frameMeta;

        // 3. Setup Textures
        const atlasBase = AssetManager.tilecAtlases[atlas_id];
        const maskBase = AssetManager.tilecMasks[atlas_id];

        if (!atlasBase || !maskBase) continue;

        const frameRect = new PIXI.Rectangle(x, y, width, height);
        const indexTexture = new PIXI.Texture(atlasBase, frameRect);
        const maskTexture = new PIXI.Texture(maskBase, frameRect);
        const paletteTexture = new PIXI.Texture(AssetManager.paletteTexture);

        // 4. Create Sprite
        const sprite = new PIXI.Sprite(indexTexture);
        
        // Stack the SObj parts: each part goes up by 48 pixels relative to the container
        sprite.x = left;
        sprite.y = -(i * 48) + top;

        // 5. Setup Palette Filter (using tilec_palettes)
        const paletteInfo = AssetManager.paletteMeta.tilec_palettes.find(p => p.index === paletteIndex);
        const animRanges: [number, number][] = paletteInfo 
            ? paletteInfo.animation_ranges.map(r => [r.min_index, r.max_index])
            : [];

        const rowHeight = AssetManager.paletteTexture.height || 256;
        const normalizedRow = (paletteIndex + 0.5) / rowHeight;

        const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
        sprite.filters = [filter];

        container.addChild(sprite);
    }

    return container;
}
