import * as PIXI from "pixi.js";
import { ServerToClient } from "../protocol";

export class EntityRenderer {
  private container: PIXI.Container;
  private entities: Map<number, PIXI.Graphics> = new Map();
  private TILE_SIZE = 32;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  handlePacket(packet: ServerToClient) {
    if ("SpawnCharacter" in packet) {
      const data = packet.SpawnCharacter;
      this.spawnCharacter(data);
    } else if ("EntityRemove" in packet) {
      this.removeEntity(packet.EntityRemove.entity_id);
    }
  }

  private spawnCharacter(data: any) {
    // Remove if already exists
    this.removeEntity(data.entity_id);

    const graphics = new PIXI.Graphics();
    // Use a random color based on entity_id for now
    const color = (data.entity_id * 12345) % 0xFFFFFF;
    
    graphics.beginFill(color);
    graphics.drawRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
    graphics.endFill();

    // Position based on tile coordinates
    graphics.x = data.x * this.TILE_SIZE;
    graphics.y = data.y * this.TILE_SIZE;

    this.container.addChild(graphics);
    this.entities.set(data.entity_id, graphics);
    
    console.log(`Spawned entity ${data.entity_id} at ${data.x}, ${data.y}`);
  }

  private removeEntity(id: number) {
    const entity = this.entities.get(id);
    if (entity) {
      this.container.removeChild(entity);
      this.entities.delete(id);
    }
  }
}