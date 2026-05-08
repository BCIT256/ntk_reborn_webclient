import { Container } from "pixi.js";
import { EntityRenderer, EntityConfig } from "../renderers/entityRenderer";

/**
 * Manages all remote entities in the viewport.
 * The local player is NOT stored here — it lives in GameApp directly.
 */
export class EntityManager {
  private entities: Map<number, EntityRenderer> = new Map();
  private container: Container;

  constructor(entityLayer: Container) {
    this.container = entityLayer;
  }

  // ─── Packet handlers ──────────────────────────────────────────────

  handleSpawn(data: {
    entity_id: number;
    x: number;
    y: number;
    direction: number;
    name: string;
    name_color: number;
    speed: number;
    state: number;
    sex: number;
    face: number;
    face_color: number;
    hair: number;
    hair_color: number;
    skin_color: number;
    equipment: number[];
    is_grouped: boolean;
    is_pk: boolean;
  }) {
    // Don't spawn duplicates
    if (this.entities.has(data.entity_id)) {
      // Update position of existing entity
      const existing = this.entities.get(data.entity_id)!;
      existing.handleResync(data.x, data.y);
      return;
    }

    // Pick a fallback colour based on whether entity is a PK (red) or not (blue-ish)
    const fallbackColor = data.is_pk ? 0xcc4444 : 0x4488cc;

    const config: EntityConfig = {
      entityId: data.entity_id,
      name: data.name,
      isLocalPlayer: false,
      fallbackColor,
      nameColor: data.name_color,
    };

    const entity = new EntityRenderer(this.container, config);
    entity.handleResync(data.x, data.y);
    // Set facing direction from spawn data (moveToTarget handles already-at-target gracefully)
    entity.moveToTarget(data.x, data.y, data.direction);
    this.entities.set(data.entity_id, entity);

    console.log(`[EntityManager] Spawned entity ${data.entity_id} ("${data.name}") at (${data.x}, ${data.y})`);
  }

  handleMove(data: { entity_id: number; x: number; y: number; direction: number }) {
    const entity = this.entities.get(data.entity_id);
    if (!entity) {
      // Might be the local player or an entity we haven't seen spawn yet — ignore
      return;
    }
    entity.moveToTarget(data.x, data.y, data.direction);
  }

  handleRemove(entityId: number) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    entity.destroy();
    this.entities.delete(entityId);
    console.log(`[EntityManager] Removed entity ${entityId}`);
  }

  // ─── Per-frame update ──────────────────────────────────────────────

  update(dt: number) {
    for (const entity of this.entities.values()) {
      entity.update(dt);
    }

    // Z-sort: entities with higher Y render in front (painter's algorithm)
    const children = this.container.children;
    if (children.length >= 2) {
      // Each child is an EntityRenderer's container, positioned at the entity's world Y
      children.sort((a, b) => {
        return (a as Container).y - (b as Container).y;
      });
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────

  getEntity(id: number): EntityRenderer | undefined {
    return this.entities.get(id);
  }

  hasEntity(id: number): boolean {
    return this.entities.has(id);
  }

  /** Remove all entities (e.g. on map change). */
  clearAll() {
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    this.entities.clear();
  }
}
