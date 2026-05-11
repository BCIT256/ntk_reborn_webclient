import * as PIXI from "pixi.js";
import { assetManager } from "../utils/assetManager";
import { AssetManager } from "../managers/assetManager";
import { createPaletteFilter } from "../shaders/paletteShader";

export interface EntityVisualState {
    bodyId?: number;
    faceId?: number;
    hairId?: number;
    armorId?: number;
    shieldId?: number;
    weaponId?: number;
    helmetId?: number;
    mountId?: number;

    skinColor?: number;
    hairColor?: number;
    faceColor?: number;
    armorColor?: number;
    helmetColor?: number;
    shieldColor?: number;
    weaponColor?: number;
    mountColor?: number;
    
    direction?: string;
    frame?: number;
}

// "Standing facing down" is typically frame index 12 in the EPF sprite layout.
// Fallback candidates if 12 doesn't exist.
const STANDING_FRAME_CANDIDATES = [12, 16, 0];

export class EntityView extends PIXI.Container {
    private shadowGraphics: PIXI.Graphics;
    private mountSprite: PIXI.Sprite;
    private bodySprite: PIXI.Sprite;
    private faceSprite: PIXI.Sprite;
    private hairSprite: PIXI.Sprite;
    private armorSprite: PIXI.Sprite;
    private shieldSprite: PIXI.Sprite;
    private weaponSprite: PIXI.Sprite;
    private helmetSprite: PIXI.Sprite;
    private debugPlaceholder: PIXI.Graphics;

    constructor() {
        super();
        this.sortableChildren = true;

        this.debugPlaceholder = new PIXI.Graphics();
        this.debugPlaceholder.beginFill(0xFF0000);
        this.debugPlaceholder.drawRect(-16, -48, 32, 48);
        this.debugPlaceholder.endFill();
        this.debugPlaceholder.zIndex = 10;
        this.debugPlaceholder.visible = false;
        this.addChild(this.debugPlaceholder);

        // Procedurally generated shadow
        this.shadowGraphics = new PIXI.Graphics();
        this.shadowGraphics.beginFill(0x000000);
        this.shadowGraphics.drawEllipse(0, 0, 14, 7);
        this.shadowGraphics.endFill();
        this.shadowGraphics.alpha = 0.4;
        this.shadowGraphics.zIndex = 0;
        this.shadowGraphics.y = 0;
        this.addChild(this.shadowGraphics);

        // mount, body, face, hair, armor, shield, weapon, helmet
        this.mountSprite = this.createSprite(1);
        this.bodySprite = this.createSprite(2);
        this.faceSprite = this.createSprite(3);
        this.hairSprite = this.createSprite(4);
        this.armorSprite = this.createSprite(5);
        this.shieldSprite = this.createSprite(6);
        this.weaponSprite = this.createSprite(7);
        this.helmetSprite = this.createSprite(8);
    }

    private createSprite(zIndex: number): PIXI.Sprite {
        const sprite = new PIXI.Sprite();
        sprite.zIndex = zIndex;
        sprite.anchor.set(0.5, 1.0);
        this.addChild(sprite);
        return sprite;
    }

    /**
     * Updates all character layers. Returns true if the body loaded successfully.
     */
    public async updateState(state: EntityVisualState): Promise<boolean> {
        const dir = state.direction || "down";
        const frame = state.frame || 0;

        const results = await Promise.allSettled([
            this.updateLayer(this.mountSprite, "mount", state.mountId, dir, frame, state.mountColor),
            this.updateLayer(this.bodySprite, "body", state.bodyId, dir, frame, state.skinColor),
            this.updateLayer(this.faceSprite, "face", state.faceId, dir, frame, state.faceColor || state.skinColor),
            this.updateLayer(this.hairSprite, "hair", state.hairId, dir, frame, state.hairColor),
            this.updateLayer(this.armorSprite, "armor", state.armorId, dir, frame, state.armorColor),
            this.updateLayer(this.shieldSprite, "shield", state.shieldId, dir, frame, state.shieldColor),
            this.updateLayer(this.weaponSprite, "weapon", state.weaponId, dir, frame, state.weaponColor),
            this.updateLayer(this.helmetSprite, "helmet", state.helmetId, dir, frame, state.helmetColor)
        ]);
        
        // Body is results[1]. If body loaded, hide the fallback no matter what.
        const bodyLoaded = results[1].status === "fulfilled";
        this.debugPlaceholder.visible = !bodyLoaded;
        return bodyLoaded;
    }

    private async updateLayer(sprite: PIXI.Sprite, layerName: string, id: number | undefined, direction: string, frame: number, colorIndex: number = 0) {
        if (!id || id === 0) {
            sprite.visible = false;
            return;
        }

        try {
            await AssetManager.loadEpfAsset(layerName, id);
        } catch (error) {
            sprite.visible = false;
            throw error;
        }

        const epfKey = `${layerName}_${id}`;
        const sheet = AssetManager.epfSheets.get(epfKey);

        if (!sheet || !sheet.textures) {
            sprite.visible = false;
            return;
        }

        // Resolve the frame key and texture
        const { texture, frameData } = this.resolveFrame(sheet, epfKey, frame);

        if (texture) {
            sprite.texture = texture;
            sprite.visible = true;

            // Apply ox/oy offsets from the raw spritesheet JSON data
            if (frameData) {
                sprite.x = frameData.ox ?? 0;
                sprite.y = frameData.oy ?? 0;
            } else {
                sprite.x = 0;
                sprite.y = 0;
            }

            // Palette coloring
            if (colorIndex > 0 && AssetManager.paletteTexture && AssetManager.paletteMeta) {
                const paletteHeight = AssetManager.paletteTexture.height > 1 ? AssetManager.paletteTexture.height : 1024;
                const normalizedRow = (colorIndex + 0.5) / paletteHeight;

                if (!sprite.filters || sprite.filters.length === 0) {
                    const palTex = new PIXI.Texture(AssetManager.paletteTexture);
                    sprite.filters = [createPaletteFilter(texture, palTex, normalizedRow, [])];
                } else {
                    const filter = sprite.filters[0] as any;
                    filter.uniforms.uPaletteRow = normalizedRow;
                    filter.uniforms.uMaskSampler = texture;
                }
            } else {
                sprite.filters = null;
            }
        } else {
            sprite.visible = false;
        }
    }

    /**
     * Resolves the best texture frame from a spritesheet.
     * 
     * Frame keys in the EPF spritesheets are formatted as `{layer}_{id}_{index}`
     * (e.g. `body_1_12`). We first try the exact requested frame index,
     * then fall back to known "standing" frame candidates (12, 16, 0).
     * 
     * Returns both the PIXI.Texture and the raw frame data (which contains ox/oy offsets).
     */
    private resolveFrame(
        sheet: PIXI.Spritesheet,
        epfKey: string,
        requestedFrame: number
    ): { texture: PIXI.Texture | null; frameData: any } {
        const rawFrames = sheet.data?.frames as Record<string, any> | undefined;

        // Try the exact requested frame first
        const exactKey = `${epfKey}_${requestedFrame}`;
        if (sheet.textures[exactKey]) {
            return {
                texture: sheet.textures[exactKey],
                frameData: rawFrames?.[exactKey] ?? null
            };
        }

        // Try known standing-frame candidates
        for (const candidate of STANDING_FRAME_CANDIDATES) {
            const candidateKey = `${epfKey}_${candidate}`;
            if (sheet.textures[candidateKey]) {
                return {
                    texture: sheet.textures[candidateKey],
                    frameData: rawFrames?.[candidateKey] ?? null
                };
            }
        }

        // Last resort: grab the first available texture
        const allKeys = Object.keys(sheet.textures);
        if (allKeys.length > 0) {
            const firstKey = allKeys[0];
            return {
                texture: sheet.textures[firstKey],
                frameData: rawFrames?.[firstKey] ?? null
            };
        }

        return { texture: null, frameData: null };
    }
}
