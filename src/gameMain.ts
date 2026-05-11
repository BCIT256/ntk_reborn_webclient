import * as PIXI from 'pixi.js';
import { AssetManager } from './managers/assetManager';
import { ChunkedMapRenderer } from './renderers/mapRenderer';
import { EntityManager } from './managers/entityManager';
import { eventBus } from './utils/eventBus';
import { KeyboardManager } from './inputs/keyboard';
import { socket } from './socket';

PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

export let gameApp: PIXI.Application | null = null;

export class GameApp {
    private app: PIXI.Application;
    private mapRenderer: ChunkedMapRenderer | null = null;
    private entityManager: EntityManager;
    private entityLayer: PIXI.Container;
    private keyboardManager: KeyboardManager;
    private animationTick: number = 0;
    private ANIMATION_SPEED: number = 150;
    private lastAnimTime: number = 0;
    private unsubscribeMapChange: () => void;
    private unsubscribePlayerPosition: () => void;
    private unsubscribeSpawnEntity: () => void;
    private unsubscribeSpawn: () => void;
    private unsubscribeEntityMove: () => void;
    private unsubscribeEntityRemove: () => void;
    
    constructor(container: HTMLDivElement, spawnPayload: any) {
        // 1. Initialize Pixi Application
        this.app = new PIXI.Application({
            resizeTo: container,
            backgroundColor: 0x000000,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            autoStart: false // Don't start the ticker until assets are loaded
        });

        // Add the canvas to the React container
        container.appendChild(this.app.view as HTMLCanvasElement);

        gameApp = this.app;

        this.entityLayer = new PIXI.Container();
        this.entityLayer.sortableChildren = true;
        this.entityManager = new EntityManager(this.entityLayer);

        // Start initialization
        this.init(spawnPayload);

        this.keyboardManager = new KeyboardManager();

        // Listen for MapChange events
        this.unsubscribeMapChange = eventBus.on("MapChange", this.handleMapChange.bind(this));
        
        // Listen for PlayerPosition events to move camera
        this.unsubscribePlayerPosition = eventBus.on("PlayerPosition", this.handlePlayerPosition.bind(this));
        
        // Entity events
        this.unsubscribeSpawnEntity = eventBus.on("SpawnEntity", (payload) => this.handleSpawnEntity(payload));
        this.unsubscribeSpawn = eventBus.on("SpawnCharacter", (payload) => this.entityManager.handleSpawn(payload));
        this.unsubscribeEntityMove = eventBus.on("EntityMove", (payload) => this.entityManager.handleMove(payload));
        this.unsubscribeEntityRemove = eventBus.on("EntityRemove", (payload) => this.entityManager.handleRemove(payload.entity_id));
    }

    public centerCamera(x: number, y: number) {
        const TILE_SIZE = 48;
        this.app.stage.pivot.x = Math.floor(x * TILE_SIZE);
        this.app.stage.pivot.y = Math.floor(y * TILE_SIZE);
        this.app.stage.position.set(Math.floor(this.app.screen.width / 2), Math.floor(this.app.screen.height / 2));

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

        if (!AssetManager.currentMap || !AssetManager.currentMap.tiles || !AssetManager.currentMap.width || !AssetManager.currentMap.height) {
            console.warn(`Failed to load valid map data for map_id: ${map_id}, falling back to blank map.`);
            AssetManager.currentMap = {
                map_id: map_id,
                width: 20,
                height: 20,
                tiles: Array(400).fill(0)
            };
        }

        if (this.mapRenderer) {
            this.mapRenderer.groundContainer.destroy({ children: true });
            this.mapRenderer.objectContainer.destroy({ children: true });
            this.mapRenderer.destroy();
        }

        this.entityManager.clearAll();

        console.log("Map Data being passed to renderer:", AssetManager.currentMap);
        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);
        this.app.stage.addChild(this.entityLayer);

        // Center the camera on the provided x and y
        this.centerCamera(x, y);

        eventBus.emit("MapTransitionComplete");
    }

    private handlePlayerPosition(payload: any) {
        const { x, y } = payload;
        if (x !== undefined && y !== undefined) {
            this.centerCamera(x, y);
            if (socket.localEntityId) {
                const player = this.entityManager.getEntity(socket.localEntityId);
                if (player) {
                    player.handleResync(x, y);
                }
            }
        }
    }

    private handleSpawnEntity(payload: any) {
        if (payload.is_local_player) {
            let player = this.entityManager.getEntity(payload.entity_id);
            if (!player) {
                this.entityManager.handleSpawn({
                    entity_id: payload.entity_id,
                    x: payload.x,
                    y: payload.y,
                    direction: payload.direction,
                    name: "Player",
                    name_color: 0xffffff,
                    speed: 200,
                    state: 0,
                    sex: 1,
                    face: payload.visuals.face,
                    face_color: payload.visuals.colors.skin, // Mapping skin to face_color if needed
                    hair: payload.visuals.hair,
                    hair_color: payload.visuals.colors.hair,
                    skin_color: payload.visuals.colors.skin,
                    equipment: [
                        payload.visuals.weapon,
                        payload.visuals.shield,
                        payload.visuals.armor
                    ],
                    is_grouped: false,
                    is_pk: false,
                    graphic_id: "player_base",
                    body: payload.visuals.body
                } as any);
                player = this.entityManager.getEntity(payload.entity_id);
            }

            if (player) {
                // Force sync the specific visuals provided in SpawnEntity
                const state = {
                    bodyId: payload.visuals.body,
                    faceId: payload.visuals.face,
                    hairId: payload.visuals.hair,
                    armorId: payload.visuals.armor,
                    weaponId: payload.visuals.weapon,
                    shieldId: payload.visuals.shield,
                    skinColor: payload.visuals.colors.skin,
                    faceColor: payload.visuals.colors.skin,
                    hairColor: payload.visuals.colors.hair,
                    armorColor: payload.visuals.colors.armor,
                    direction: ["up", "right", "down", "left"][payload.direction] || "down",
                    frame: 0
                };
                player.updateViewStateForce(state);
            }
        }
    }

    private lastViewMinX: number = -9999;
    private lastViewMinY: number = -9999;

    private async init(spawnPayload: any) {
        // 2. Load all assets via AssetManager
        await AssetManager.fetchAssets();
        await AssetManager.loadTextures();

        // Let MapChange handle the map loading, but if we need a default map immediately, we load it here or rely on spawnPayload.
        // Usually, the server will send a MapChange packet, so we don't strictly need tk0001 here unless required.
        // Wait for MapChange for initial map, or load based on spawnPayload if it contains map_id.
        if (spawnPayload && spawnPayload.map_id !== undefined && spawnPayload.map_id !== null) {
            await AssetManager.loadMap(spawnPayload.map_id);
        } else {
            // Fallback for PoC: Load Map 0 explicitly through proper loadMap function
            await AssetManager.loadMap(0);
        }

        if (!AssetManager.currentMap || !AssetManager.currentMap.tiles || !AssetManager.currentMap.width || !AssetManager.currentMap.height) {
            console.warn('Failed to load valid map data during init! Using a blank fallback map so the client can boot.');
            AssetManager.currentMap = {
                map_id: spawnPayload?.map_id ?? 0,
                width: 20,
                height: 20,
                tiles: Array(400).fill(0)
            };
        }

        // 3. Instantiate ChunkedMapRenderer
        console.log("Map Data being passed to renderer:", AssetManager.currentMap);
        this.mapRenderer = new ChunkedMapRenderer(AssetManager.currentMap);

        // 4. Add the layered containers to the Pixi stage
        this.app.stage.addChild(this.mapRenderer.groundContainer);
        this.app.stage.addChild(this.mapRenderer.objectContainer);
        this.app.stage.addChild(this.entityLayer);

        this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        // 5. Setup Debug Inspector Hit Area & Pointer Tracking
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(-999999, -999999, 1999998, 1999998);
        this.app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
            const worldPos = this.app.stage.toLocal(e.global);
            const gridX = Math.floor(worldPos.x / 48);
            const gridY = Math.floor(worldPos.y / 48);

            if (AssetManager.currentMap) {
                const mapWidth = AssetManager.currentMap.width;
                const mapHeight = AssetManager.currentMap.height;

                if (gridX >= 0 && gridX < mapWidth && gridY >= 0 && gridY < mapHeight) {
                    const index = gridY * mapWidth + gridX;
                    const tile = AssetManager.currentMap.tiles[index];
                    
                    eventBus.emit("HoveredTileData", {
                        x: gridX,
                        y: gridY,
                        index,
                        tile
                    });
                }
            }
        });

        if (spawnPayload && spawnPayload.x !== undefined && spawnPayload.y !== undefined) {
            this.centerCamera(spawnPayload.x, spawnPayload.y);
        } else {
            this.centerCamera(0, 0);
        }

        eventBus.emit("MapTransitionComplete");

        // Now that GameApp is fully initialized, flush any events that arrived while we were loading
        socket.flushEventBuffer();

        // 5. Add a Ticker loop to process chunks and animations
        this.app.ticker.add((delta) => {
            if (this.app.screen.width === 0) return;

            this.keyboardManager.update((dir) => this.handleMove(dir));

            // Ensure stage position is always centered (handles resizes)
            this.app.stage.position.set(Math.floor(this.app.screen.width / 2), Math.floor(this.app.screen.height / 2));

            this.entityManager.update(delta / 60);

            if (socket.localEntityId) {
                const player = this.entityManager.getEntity(socket.localEntityId);
                if (player) {
                    const pos = player.getPlayerPosition();
                    this.app.stage.pivot.x = Math.floor(pos.x + 24); // Center on player (48/2 offset)
                    this.app.stage.pivot.y = Math.floor(pos.y + 24);
                }
            }

            // Sort entities by Y so they overlap each other correctly
            this.entityLayer.children.sort((a, b) => a.y - b.y);

            if (this.mapRenderer) {
                // Hardcoded static viewport for PoC (0,0 to 30,20 tiles)
                // In a real app this would follow the player
                // We've centered the camera dynamically in handleMapChange or we should do it here if tracking player
                // But for now, just static visible chunks update based on current pivot:
                const viewMinX = (this.app.stage.pivot.x - this.app.screen.width / 2) / 48;
                const viewMinY = (this.app.stage.pivot.y - this.app.screen.height / 2) / 48;
                
                // Only update chunks if camera moved more than a fraction of a tile to save CPU
                if (Math.abs(viewMinX - this.lastViewMinX) > 0.5 || Math.abs(viewMinY - this.lastViewMinY) > 0.5) {
                    const viewMaxX = (this.app.stage.pivot.x + this.app.screen.width / 2) / 48;
                    const viewMaxY = (this.app.stage.pivot.y + this.app.screen.height / 2) / 48;
                    this.mapRenderer.updateVisibleChunks(viewMinX, viewMinY, viewMaxX, viewMaxY);
                    this.lastViewMinX = viewMinX;
                    this.lastViewMinY = viewMinY;
                }
                
                // Animation loop
                this.lastAnimTime += this.app.ticker.deltaMS;
                if (this.lastAnimTime >= this.ANIMATION_SPEED) {
                    this.lastAnimTime -= this.ANIMATION_SPEED;
                    this.animationTick++;
                    this.mapRenderer.updateAnimations(this.animationTick);
                }
            }
        });

        // Start the application ticker now that everything is loaded
        this.app.ticker.start();

        console.log('Game bootstrap complete! Map renderer is running.');
    }

    private handleMove(direction: number) {
        socket.send({ type: "Move", payload: { direction } });
    }

    public destroy() {
        if (this.unsubscribeMapChange) {
            this.unsubscribeMapChange();
        }
        if (this.unsubscribePlayerPosition) {
            this.unsubscribePlayerPosition();
        }
        if (this.unsubscribeSpawnEntity) this.unsubscribeSpawnEntity();
        if (this.unsubscribeSpawn) this.unsubscribeSpawn();
        if (this.unsubscribeEntityMove) this.unsubscribeEntityMove();
        if (this.unsubscribeEntityRemove) this.unsubscribeEntityRemove();
        
        if (this.mapRenderer) {
            this.mapRenderer.destroy();
        }
        if (this.entityManager) {
            this.entityManager.clearAll();
        }
        if (this.keyboardManager) {
            this.keyboardManager.destroy();
        }
        this.app.destroy(true, { children: true });
    }
}