import * as PIXI from "pixi.js";
import { ServerToClient } from "../protocol";

export class EntityRenderer {
  private container: PIXI.Container;
  private entities: Map<number, PIXI.Graphics> = new Map();
  private TILE_SIZE = 32;
  private playerEntityId: number | null = null;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  handlePacket(packet: ServerToClient): { playerMoved: boolean, x: number, y: number } | null {
    if ("SpawnCharacter" in packet) {
      const data = packet.SpawnCharacter;
      this.spawnCharacter(data);
      // For now, assume the first character spawned is the player
      if (this.playerEntityId === null) {
        this.playerEntityId = data.entity_id;
      }
    } else if ("EntityMove" in packet) {
      const data = packet.EntityMove;
      const entity = this.entities.get(data.entity_id);
      if (entity) {
        entity.x = data.x * this.TILE_SIZE;
        entity.y = data.y * this.TILE_SIZE;
        
        if (data.entity_id === this.playerEntityId) {
          return { playerMoved: true, x: entity.x, y: entity.y };
        }
      }
    } else if ("EntityRemove" in packet) {
      this.removeEntity(packet.EntityRemove.entity_id);
    }
    return null;
  }

  private spawnCharacter(data: any) {
    this.removeEntity(data.entity_id);

    const graphics = new PIXI.Graphics();
    const color = (data.entity_id * 12345) % 0xFFFFFF;
    
    graphics.beginFill(color);
    graphics.drawRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
    graphics.endFill();

    graphics.x = data.x * this.TILE_SIZE;
    graphics.y = data.y * this.TILE_SIZE;

    this.container.addChild(graphics);
    this.entities.set(data.entity_id, graphics);
  }

  private removeEntity(id: number) {
    const entity = this.entities.get(id);
    if (entity) {
      this.container.removeChild(entity);
      this.entities.delete(id);
    }
  }

  getPlayerPosition() {
    if (this.playerEntityId !== null) {
      const player = this.entities.get(this.playerEntityId);
      if (player) return { x: player.x, y: player.y };
    }
    return null;
  }
}