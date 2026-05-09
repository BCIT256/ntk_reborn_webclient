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
}

export interface TblData {
    tile_count: number;
    entries: number[];
}

export interface SObjDef {
    index: number;
    collision: number;
    height: number;
    tile_indices: number[];
}

export interface SObjTblData {
    sobj_count: number;
    entries: SObjDef[];
}

export interface MapTile {
    ab: number;
    pass: number;
    sobj: number;
}

export interface MapData {
    map_id: number;
    width: number;
    height: number;
    tiles: number[] | MapTile[];
    static_objects?: number[];
}