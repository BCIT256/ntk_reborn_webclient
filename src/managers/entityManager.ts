import { Container } from "pixi.js";
import { EntityRenderer, FallbackType } from "../renderers/entityRenderer";
import { socket } from "../socket";

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
    this.container.sortableChildren = true;
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

    const isLocalPlayer = data.entity_id === socket.localEntityId;

    // Determine fallback colour based on PK status
    const fallbackColor = data.is_pk ? 0xcc4444 : 0x4488cc;

    // Determine fallback type from the graphic_id prefix
    let fallbackType: FallbackType = "mob";
    const gid = (data.graphic_id || "").toLowerCase();
    if (gid.startsWith("player") || gid.startsWith("char") || isLocalPlayer) {
      fallbackType = "player";
    } else if (gid.startsWith("npc") || gid.startsWith("merchant")) {
      fallbackType = "npc";
    }

    const entity = new EntityRenderer(this.container, {
      entityId: data.entity_id,
      name: data.name,
      graphicId: data.graphic_id || "",
      isLocalPlayer,
      fallbackColor,
      fallbackType,
      nameColor: data.name_color,
      visualData: data // Pass data directly
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
      // Might be an entity we haven't seen spawn yet — ignore
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

  /** Show a speech bubble above a specific remote entity. */
  showSpeechBubble(entityId: number, text: string) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.showSpeechBubble(text);
    }
  }

  // ─── Per-frame update ──────────────────────────────────────────────

  update(dt: number) {
    for (const entity of this.entities.values()) {
      entity.update(dt);
    }

    // Update each entity container's zIndex based on its Y position.
    // PIXI's sortableChildren then auto-sorts for correct draw order.
    // This ensures entities lower on screen render in front of those higher up.
    // FX and damage numbers use fixed high zIndex values so they always
    // render above entities regardless of Y position.
    for (const entity of this.entities.values()) {
      const pos = entity.getPlayerPosition();
      entity.getContainer().zIndex = pos.y;
    }

    // Also update the local player's zIndex
    // (handled separately in GameApp since localPlayer isn't stored here)
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