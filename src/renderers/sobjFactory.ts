import * as PIXI from 'pixi.js';
import { AssetManager } from '../managers/assetManager';
import { createPaletteFilter } from '../shaders/paletteShader';

export function createSObjContainer(sobjIndex: number, x: number, y: number): PIXI.Container | null {
    if (!AssetManager.sobjTbl) return null;

    const sobjDef = (AssetManager.sobjTbl as any).objects ? (AssetManager.sobjTbl as any).objects[sobjIndex] : AssetManager.sobjTbl.entries[sobjIndex];
    if (!sobjDef || sobjDef.height < 1) {
        return null;
    }

    const container = new PIXI.Container();
    
    // Position the container at the tile coordinates
    container.x = x * 48;
    container.y = y * 48;

    for (let i = 0; i < sobjDef.tile_indices.length; i++) {
        const tilecFrameIndex = sobjDef.tile_indices[i];
        
        // Skip invalid/empty frames
        if (tilecFrameIndex <= 0) continue;

        // 1. Get TBL palette index
        const paletteIndex = AssetManager.tilecTbl.entries ? AssetManager.tilecTbl.entries[tilecFrameIndex] : (AssetManager.tilecTbl as any)[tilecFrameIndex] || 0;

        // 2. Get Frame Meta
        const frameMeta = AssetManager.tilecAtlasMeta.frames[tilecFrameIndex];
        if (!frameMeta) continue;

        const { atlas_id, x: frameX, y: frameY, width, height, left, top } = frameMeta;

        // 3. Setup Textures
        const atlasBase = AssetManager.tilecAtlases[atlas_id];
        const maskBase = AssetManager.tilecMasks[atlas_id];

        if (!atlasBase || !maskBase) continue;

        const frameRect = new PIXI.Rectangle(frameX, frameY, width, height);
        const indexTexture = new PIXI.Texture(atlasBase, frameRect);
        const maskTexture = new PIXI.Texture(maskBase, frameRect);
        const paletteTexture = new PIXI.Texture(AssetManager.paletteTexture);

        // 4. Create Sprite
        const sprite = new PIXI.Sprite(indexTexture);
        
        // Stack the SObj parts using their left/top offsets
        sprite.x = left;
        sprite.y = top;

        // 5. Setup Palette Filter
        let tilePaletteCount = 0;
        let paletteInfo = null;
        let combinedIndex = paletteIndex;
        
        const meta = AssetManager.paletteMeta as any;
        if (meta && meta.tile_palettes) {
            let palettesArray: any[] = Array.isArray(meta.tile_palettes) ? meta.tile_palettes : Object.values(meta.tile_palettes);
            tilePaletteCount = palettesArray.length;
            combinedIndex = paletteIndex + tilePaletteCount;

            let tilecPalettesArray: any[] = Array.isArray(meta.tilec_palettes) ? meta.tilec_palettes : (meta.tilec_palettes ? Object.values(meta.tilec_palettes) : []);
            paletteInfo = tilecPalettesArray.find(p => p.index === paletteIndex);
        }

        const animRanges: [number, number][] = paletteInfo && paletteInfo.animation_ranges
            ? paletteInfo.animation_ranges.map((r: any) => [r.min_index, r.max_index])
            : [];

        const masterPaletteHeight = 1024;
        const normalizedRow = (combinedIndex + 0.5) / masterPaletteHeight;

        const filter = createPaletteFilter(maskTexture, paletteTexture, normalizedRow, animRanges);
        sprite.filters = [filter];

        container.addChild(sprite);
    }

    container.zIndex = y;
    return container;
}