import * as PIXI from 'pixi.js';
import { AssetManager } from './managers/assetManager';
import { ChunkedMapRenderer } from './renderers/mapRenderer';
import { eventBus } from './utils/eventBus';

export class GameApp {
    private app: PIXI.Application;
    private mapRenderer: ChunkedMapRenderer | null = null;
    private animationTick: number = 0;
    private ANIMATION_SPEED: number = 150;
    private lastAnimTime: number = 0;
    private unsubscribeMapChange: () => void;
    
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

        // Listen for MapChange events
        this.unsubscribeMapChange = eventBus.on("MapChange", this.handleMapChange.bind(this));
    }

    private async handleMapChange(payload: any) {
        const { map_id, x, y } = payload;
        await AssetManager.loadMap(map_id);

        if (!AssetManager.currentMap) {
            console.error(`Failed to load map data for map_id: ${map_id}`);
            return;
        }

        if (this.mapRenderer) {
            this.app.stage.removeChild(this.mapRenderer.groundContainer);
            this.app.stage.removeChild(this.mapRenderer.objectContainer);
            this.mapRenderer.destroy(); // Assumes destroy() method exists in ChunkedMapRenderer
        }

        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);

        // Set camera position (assuming we update the visible chunks based on this)
        // Hardcoded viewport centered for PoC (viewport dimension based on chunk logic, for now simple offset)
        const cameraTileX = x;
        const cameraTileY = y;
        this.mapRenderer.updateVisibleChunks(cameraTileX - 15, cameraTileY - 10, cameraTileX + 15, cameraTileY + 10);
    }

    private async init(spawnPayload: any) {
        // 2. Load all assets via AssetManager
        await AssetManager.fetchAssets();
        await AssetManager.loadTextures();

        // Let MapChange handle the map loading, but if we need a default map immediately, we load it here or rely on spawnPayload.
        // Usually, the server will send a MapChange packet, so we don't strictly need tk0001 here unless required.
        // Wait for MapChange for initial map, or load based on spawnPayload if it contains map_id.
        if (spawnPayload && spawnPayload.map_id) {
            await AssetManager.loadMap(spawnPayload.map_id);
        } else {
            // Fallback for PoC
            await AssetManager.loadMap(1);
        }

        if (!AssetManager.currentMap) {
            console.error('Failed to load map data!');
            return;
        }

        // 3. Instantiate ChunkedMapRenderer
        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);

        // 4. Add the layered containers to the Pixi stage
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);

        // 5. Add a Ticker loop to process chunks and animations
        this.app.ticker.add((delta) => {
            if (this.mapRenderer) {
                // Hardcoded static viewport for PoC (0,0 to 30,20 tiles)
                // In a real app this would follow the player
                this.mapRenderer.updateVisibleChunks(0, 0, 30, 20);
                
                // Animation loop
                this.lastAnimTime += this.app.ticker.deltaMS;
                if (this.lastAnimTime >= this.ANIMATION_SPEED) {
                    this.lastAnimTime -= this.ANIMATION_SPEED;
                    this.animationTick++;
                    this.mapRenderer.updateAnimations(this.animationTick);
                }
            }
        });

        console.log('Game bootstrap complete! Map renderer is running.');
    }

    public destroy() {
        if (this.unsubscribeMapChange) {
            this.unsubscribeMapChange();
        }
        if (this.mapRenderer) {
            this.mapRenderer.destroy();
        }
        this.app.destroy(true, { children: true });
    }
}