import { Container } from "pixi.js";
import { EntityRenderer, FallbackType } from "../renderers/entityRenderer";

/** Matches the SpawnCharacter payload from the protocol. */
export interface SpawnData {
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
  graphic_id: string;
}

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

  handleSpawn(data: SpawnData) {
    // Don't spawn duplicates
    if (this.entities.has(data.entity_id)) {
      // Update position of existing entity
      const existing = this.entities.get(data.entity_id)!;
      existing.handleResync(data.x, data.y);
      return;
    }

    // Determine fallback colour based on PK status
    const fallbackColor = data.is_pk ? 0xcc4444 : 0x4488cc;

    // Determine fallback type from the graphic_id prefix
    let fallbackType: FallbackType = "mob";
    const gid = (data.graphic_id || "").toLowerCase();
    if (gid.startsWith("player") || gid.startsWith("char")) {
      fallbackType = "player";
    } else if (gid.startsWith("npc") || gid.startsWith("merchant")) {
      fallbackType = "npc";
    }

    const entity = new EntityRenderer(this.container, {
      entityId: data.entity_id,
      name: data.name,
      graphicId: data.graphic_id || "",
      isLocalPlayer: false,
      fallbackColor,
      fallbackType,
      nameColor: data.name_color,
    });

    entity.handleResync(data.x, data.y);
    // Set facing direction from spawn data
    entity.moveToTarget(data.x, data.y, data.direction);
    this.entities.set(data.entity_id, entity);

    console.log(
      `[EntityManager] Spawned entity ${data.entity_id} ("${data.name}" gfx=${data.graphic_id}) at (${data.x}, ${data.y})`
    );
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
