export interface FrameMeta {
    index: number;
    atlas_id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    top: number;
}

export interface AtlasMeta {
    frame_size: number;
    atlas_columns: number;
    atlas_count: number;
    frames: FrameMeta[];
}

export interface PaletteAnimRange {
    min_index: number;
    max_index: number;
}

export interface PaletteMeta {
    index: number;
    animation_ranges: PaletteAnimRange[];
}

export interface PaletteMetaFile {
    tile_palettes: PaletteMeta[];
    tilec_palettes: PaletteMeta[];
}

export interface TblData {
    tile_count: number;
    entries: number[];
}
