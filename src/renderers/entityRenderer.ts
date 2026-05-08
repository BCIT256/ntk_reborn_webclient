import * as PIXI from "pixi.js";

export class EntityRenderer {
    private container: PIXI.Container;
    private playerSprite: PIXI.Graphics;
    
    // Local state for smooth camera tracking and prediction
    private targetX: number = 0;
    private targetY: number = 0;
    private TILE_SIZE: number = 32;

    constructor(cameraContainer: PIXI.Container) {
        this.container = new PIXI.Container();
        cameraContainer.addChild(this.container);

        // SAFE MOCK PLAYER: A simple red square. 
        // Hardcoded 0xFF0000 ensures we never get the NaN color crash!
        this.playerSprite = new PIXI.Graphics();
        this.playerSprite.beginFill(0xFF0000); 
        this.playerSprite.drawRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        this.playerSprite.endFill();

        this.container.addChild(this.playerSprite);
    }

    handleResync(x: number, y: number) {
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;
        
        // Multiply grid coordinates by TILE_SIZE to get actual pixel coordinates
        this.targetX = x * this.TILE_SIZE;
        this.targetY = y * this.TILE_SIZE;
        
        // Instantly snap the graphic to the correct server location
        this.playerSprite.x = this.targetX;
        this.playerSprite.y = this.targetY;
    }

    predictMove(direction: number) {
        // 0: Up, 1: Right, 2: Down, 3: Left
        if (direction === 0) this.targetY -= this.TILE_SIZE; 
        if (direction === 1) this.targetX += this.TILE_SIZE; 
        if (direction === 2) this.targetY += this.TILE_SIZE; 
        if (direction === 3) this.targetX -= this.TILE_SIZE; 
        
        // Instantly update visuals for client-side prediction
        this.playerSprite.x = this.targetX;
        this.playerSprite.y = this.targetY;
    }

    handlePacket(packet: any) {
        // Future logic for handling other players/monsters spawning nearby
    }

    getPlayerPosition() {
        return { x: this.playerSprite.x, y: this.playerSprite.y };
    }
}