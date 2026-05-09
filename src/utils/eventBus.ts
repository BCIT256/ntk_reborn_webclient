/**
 * EventBus — lightweight typed publish/subscribe system.
 * Decouples the WebSocket layer from renderers and UI managers.
 *
 * Usage:
 *   eventBus.on("EntityHealthUpdate", (data) => { ... });
 *   eventBus.emit("EntityHealthUpdate", { entity_id: 5, damage: 42, ... });
 */

type Listener<T = unknown> = (data: T) => void;

export interface GameEvents {
  // ─── World ────────────────────────────────────────────────────────
  MapChange: { map_id: number; x: number; y: number; objects: any[] };
  PlayerPosition: { x: number; y: number; view_x: number; view_y: number };
  SpawnCharacter: {
    entity_id: number;
    x: number;
    y: number;
    direction: number;
    name: string;
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
    name_color: number;
    graphic_id: string;
  };
  EntityMove: { entity_id: number; x: number; y: number; direction: number };
  EntityRemove: { entity_id: number; is_death: boolean };

  // ─── Combat ───────────────────────────────────────────────────────
  EntityHealthUpdate: {
    entity_id: number;
    damage: number;
    hp_percent: number;
    hit_type: number;
  };

  // ─── Vitals ────────────────────────────────────────────────────────
  PlayerVitalsUpdate: {
    hp: number;
    max_hp: number;
    mp: number;
    max_mp: number;
    xp: number;
    xp_next: number;
    gold: number;
    level: number;
    armor_class: number;
    hit: number;
    damage_modifier: number;
    str: number;
    dex: number;
    int: number;
    wis: number;
  };

  // ─── Dialog / Menu ────────────────────────────────────────────────
  DialogPopup: { npc_id: number; name: string; message: string };
  ShowMenu: { menu_id: number; title: string; options: string[] };

  // ─── Chat / System ─────────────────────────────────────────────────
  SystemMessage: { message: string };
  BroadcastMessage: { message: string };
  ChatNormal: { entity_id: number; message: string };

  // ─── UI Lock (keyboard / dialog) ───────────────────────────────────
  DialogOpened: void;
  DialogClosed: void;

  // ─── Map Transitions ──────────────────────────────────────────────
  MapTransitionStart: { map_id: number };
  MapTransitionComplete: void;

  // ─── Inventory ─────────────────────────────────────────────────────
  InventoryUpdate: {
    items: { slot: number; name: string; icon_id: number; quantity: number }[];
  };

  // ─── Spells ────────────────────────────────────────────────────────
  SpellListUpdate: {
    spells: { spell_id: number; name: string; icon_id: number }[];
  };

  // ─── Combat FX ─────────────────────────────────────────────────────
  PlaySound: { sound_id: number };
  PlayAnimation: { entity_id: number | null; anim_id: number; x: number | null; y: number | null };
  DamageNumber: { entity_id: number; amount: number; color: string };

  // ─── UI Events (React ↔ PixiJS) ───────────────────────────────────
  ToggleSystemMenu: void;
  QuitToTitle: void;
  HotbarSlot: { slot: number };
}

class EventBusClass {
  private listeners: Map<string, Set<Listener>> = new Map();

  on<K extends keyof GameEvents>(
    event: K,
    callback: GameEvents[K] extends void ? () => void : Listener<GameEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as Listener);

    // Return unsubscribe function
    return () => {
      set.delete(callback as Listener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  emit<K extends keyof GameEvents>(...args: GameEvents[K] extends void ? [event: K] : [event: K, data: GameEvents[K]]): void {
    const event = args[0] as string;
    const data = args[1];
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      (cb as Listener)(data);
    }
  }

  /** Remove all listeners for every event. */
  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBusClass();