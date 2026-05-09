import * as PIXI from 'pixi.js';
import { AssetManager } from './managers/assetManager';
import { ChunkedMapRenderer } from './renderers/mapRenderer';

export class GameApp {
    private app: PIXI.Application;
    private mapRenderer: ChunkedMapRenderer | null = null;
    
    constructor(container: HTMLDivElement, spawnPayload: any) {
        // 1. Initialize Pixi Application
        this.app = new PIXI.Application({
            resizeTo: container,
            backgroundColor: 0x000000,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // Add the canvas to the React container
        container.appendChild(this.app.view as HTMLCanvasElement);

        // Start initialization
        this.init(spawnPayload);
    }

    private async init(spawnPayload: any) {
        // 2. Load all assets via AssetManager
        await AssetManager.fetchAssets();
        await AssetManager.loadTextures();

        if (!AssetManager.currentMap) {
            console.error('Failed to load tk0001.json map data!');
            return;
        }

        // 3. Instantiate ChunkedMapRenderer
        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);

        // 4. Add the layered containers to the Pixi stage
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);

        // 5. Add a Ticker loop to process chunks
        this.app.ticker.add(() => {
            if (this.mapRenderer) {
                // Hardcoded static viewport for PoC (0,0 to 30,20 tiles)
                this.mapRenderer.updateVisibleChunks(0, 0, 30, 20);
            }
        });

        console.log('Game bootstrap complete! Map renderer is running.');
    }

    public destroy() {
        this.app.destroy(true, { children: true });
    }
}