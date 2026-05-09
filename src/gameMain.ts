import * as PIXI from 'pixi.js';
import { AssetManager } from './managers/assetManager';
import { ChunkedMapRenderer } from './renderers/mapRenderer';
import { eventBus } from './utils/eventBus';
import { KeyboardManager } from './inputs/keyboard';
import { socket } from './socket';

export class GameApp {
    private app: PIXI.Application;
    private mapRenderer: ChunkedMapRenderer | null = null;
    private keyboardManager: KeyboardManager;
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

        this.keyboardManager = new KeyboardManager();

        // Listen for MapChange events
        this.unsubscribeMapChange = eventBus.on("MapChange", this.handleMapChange.bind(this));
    }

    public centerCamera(x: number, y: number) {
        const TILE_SIZE = 48;
        this.app.stage.pivot.x = x * TILE_SIZE;
        this.app.stage.pivot.y = y * TILE_SIZE;
        this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        const cameraTileX = x;
        const cameraTileY = y;
        // View bounds in tile coordinates
        const viewMinX = cameraTileX - (this.app.screen.width / 2) / TILE_SIZE;
        const viewMinY = cameraTileY - (this.app.screen.height / 2) / TILE_SIZE;
        const viewMaxX = cameraTileX + (this.app.screen.width / 2) / TILE_SIZE;
        const viewMaxY = cameraTileY + (this.app.screen.height / 2) / TILE_SIZE;
        
        if (this.mapRenderer) {
            this.mapRenderer.updateVisibleChunks(viewMinX, viewMinY, viewMaxX, viewMaxY);
        }
    }

    private async handleMapChange(payload: any) {
        const { map_id, x, y } = payload;
        await AssetManager.loadMap(map_id);

        if (!AssetManager.currentMap) {
            console.error(`Failed to load map data for map_id: ${map_id}`);
            return;
        }

        if (this.mapRenderer) {
            this.mapRenderer.groundContainer.destroy({ children: true });
            this.mapRenderer.objectContainer.destroy({ children: true });
            this.mapRenderer.destroy();
        }

        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);

        // Center the camera on the provided x and y
        this.centerCamera(x, y);

        eventBus.emit("MapTransitionComplete");
    }

    private async init(spawnPayload: any) {
        // 2. Load all assets via AssetManager
        await AssetManager.fetchAssets();
        await AssetManager.loadTextures();

        // Let MapChange handle the map loading, but if we need a default map immediately, we load it here or rely on spawnPayload.
        // Usually, the server will send a MapChange packet, so we don't strictly need tk0001 here unless required.
        // Wait for MapChange for initial map, or load based on spawnPayload if it contains map_id.
        if (spawnPayload && spawnPayload.map_id !== undefined) {
            await AssetManager.loadMap(spawnPayload.map_id);
        } else {
            // Fallback for PoC: Load Map 0 explicitly through proper loadMap function
            await AssetManager.loadMap(0);
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

        this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        if (spawnPayload && spawnPayload.x !== undefined && spawnPayload.y !== undefined) {
            this.centerCamera(spawnPayload.x, spawnPayload.y);
        } else {
            this.centerCamera(0, 0);
        }

        eventBus.emit("MapTransitionComplete");

        // 5. Add a Ticker loop to process chunks and animations
        this.app.ticker.add((delta) => {
            if (this.app.screen.width === 0) return;

            this.keyboardManager.update((dir) => this.handleMove(dir));

            // Ensure stage position is always centered (handles resizes)
            this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

            if (this.mapRenderer) {
                // Hardcoded static viewport for PoC (0,0 to 30,20 tiles)
                // In a real app this would follow the player
                // We've centered the camera dynamically in handleMapChange or we should do it here if tracking player
                // But for now, just static visible chunks update based on current pivot:
                const viewMinX = (this.app.stage.pivot.x - this.app.screen.width / 2) / 48;
                const viewMinY = (this.app.stage.pivot.y - this.app.screen.height / 2) / 48;
                const viewMaxX = (this.app.stage.pivot.x + this.app.screen.width / 2) / 48;
                const viewMaxY = (this.app.stage.pivot.y + this.app.screen.height / 2) / 48;
                
                this.mapRenderer.updateVisibleChunks(viewMinX, viewMinY, viewMaxX, viewMaxY);
                
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

    private handleMove(direction: number) {
        socket.send({ type: "Move", payload: { direction } });
    }

    public destroy() {
        if (this.unsubscribeMapChange) {
            this.unsubscribeMapChange();
        }
        if (this.mapRenderer) {
            this.mapRenderer.destroy();
        }
        if (this.keyboardManager) {
            this.keyboardManager.destroy();
        }
        this.app.destroy(true, { children: true });
    }
}