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
        this.shadowGraphics.beginFill(0x000000); // Pure black
        this.shadowGraphics.drawEllipse(0, 0, 14, 7); // Width 14, Height 7 (Isometric proportions)
        this.shadowGraphics.endFill();
        this.shadowGraphics.alpha = 0.4; // 40% opacity so you can see the ground through it
        this.shadowGraphics.zIndex = 0;
        // Offset the shadow to sit perfectly at the character's feet.
        this.shadowGraphics.y = 0; // Our sprites are anchored at 1.0 (bottom), so y=0 is feet level.
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

    public async updateState(state: EntityVisualState) {
        const dir = state.direction || "down";
        const frame = state.frame || 0;

        let hasError = false;

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
        
        // If the body failed to load, we consider the whole entity broken and show debug placeholder
        if (results[1].status === "rejected") {
            hasError = true;
        }

        this.debugPlaceholder.visible = hasError;
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

        const textureName = this.getTextureName(layerName, id, direction, frame);
        const loadedTexture = AssetManager.getTexture(layerName, id, textureName) || AssetManager.getTexture(layerName, id, textureName.replace('.png', ''));

        if (loadedTexture) {
            sprite.texture = loadedTexture;
            sprite.visible = true;

            if (colorIndex > 0 && AssetManager.paletteTexture && AssetManager.paletteMeta) {
                const paletteHeight = AssetManager.paletteTexture.height > 1 ? AssetManager.paletteTexture.height : 1024;
                const normalizedRow = (colorIndex + 0.5) / paletteHeight;

                if (!sprite.filters || sprite.filters.length === 0) {
                    const palTex = new PIXI.Texture(AssetManager.paletteTexture);
                    sprite.filters = [createPaletteFilter(loadedTexture, palTex, normalizedRow, [])];
                } else {
                    const filter = sprite.filters[0] as any;
                    filter.uniforms.uPaletteRow = normalizedRow;
                    filter.uniforms.uMaskSampler = loadedTexture;
                }
            } else {
                sprite.filters = null;
            }
        } else {
            sprite.visible = false;
        }
    }

    private getTextureName(layerName: string, id: number, direction: string, frame: number): string {
        return `${layerName}_${id}_${direction}_${frame}.png`;
    }
}