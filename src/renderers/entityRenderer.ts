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

  /**
   * Instantly moves the player sprite locally (Prediction).
   */
  predictMove(direction: number) {
    if (this.playerEntityId === null) return;
    const player = this.entities.get(this.playerEntityId);
    if (!player) return;

    if (direction === 0) player.y -= this.TILE_SIZE;      // Up
    else if (direction === 1) player.x += this.TILE_SIZE; // Right
    else if (direction === 2) player.y += this.TILE_SIZE; // Down
    else if (direction === 3) player.x -= this.TILE_SIZE; // Left
  }

  /**
   * Forcefully snaps the player to specific coordinates (Reconciliation/Rubberbanding).
   */
  handleResync(x: number, y: number) {
    if (this.playerEntityId === null) return;
    const player = this.entities.get(this.playerEntityId);
    if (player) {
      player.x = x * this.TILE_SIZE;
      player.y = y * this.TILE_SIZE;
    }
  }

  handlePacket(packet: ServerToClient) {
    const { type, payload } = packet;

    if (type === "SpawnCharacter") {
      this.spawnCharacter(payload);
      // Assume the first character spawned is the player for this implementation
      if (this.playerEntityId === null) {
        this.playerEntityId = payload.entity_id;
      }
    } else if (type === "EntityMove") {
      const entity = this.entities.get(payload.entity_id);
      if (entity) {
        // Only update other entities; player is handled by prediction/resync
        if (payload.entity_id !== this.playerEntityId) {
          entity.x = payload.x * this.TILE_SIZE;
          entity.y = payload.y * this.TILE_SIZE;
        }
      }
    } else if (type === "EntityRemove") {
      this.removeEntity(payload.entity_id);
    }
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