import { useState, useEffect } from "react";
import { eventBus } from "../utils/eventBus";

// ─── Types ────────────────────────────────────────────────────────────

export interface VitalsState {
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
}

export interface InventoryItem {
  slot: number;
  name: string;
  icon_id: number;
  quantity: number;
}

export interface SpellInfo {
  spell_id: number;
  name: string;
  icon_id: number;
}

export interface GameState {
  vitals: VitalsState;
  inventory: InventoryItem[];
  spells: SpellInfo[];
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_VITALS: VitalsState = {
  hp: 0,
  max_hp: 0,
  mp: 0,
  max_mp: 0,
  xp: 0,
  xp_next: 0,
  gold: 0,
  level: 1,
  armor_class: 0,
  hit: 0,
  damage_modifier: 0,
  str: 0,
  dex: 0,
  int: 0,
  wis: 0,
};

const DEFAULT_STATE: GameState = {
  vitals: DEFAULT_VITALS,
  inventory: [],
  spells: [],
};

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * useGameState — subscribes to game EventBus events and exposes
 * reactive React state for vitals, inventory, and spells.
 */
export const useGameState = (): GameState => {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);

  useEffect(() => {
    const unsubVitals = eventBus.on("PlayerVitalsUpdate", (data) => {
      setState((prev) => ({
        ...prev,
        vitals: {
          hp: data.hp,
          max_hp: data.max_hp,
          mp: data.mp,
          max_mp: data.max_mp,
          xp: data.xp,
          xp_next: data.xp_next,
          gold: data.gold,
          level: data.level,
          armor_class: data.armor_class,
          hit: data.hit,
          damage_modifier: data.damage_modifier,
          str: data.str,
          dex: data.dex,
          int: data.int,
          wis: data.wis,
        },
      }));
    });

    const unsubInventory = eventBus.on("InventoryUpdate", (data) => {
      setState((prev) => ({
        ...prev,
        inventory: data.items,
      }));
    });

    const unsubSpells = eventBus.on("SpellListUpdate", (data) => {
      setState((prev) => ({
        ...prev,
        spells: data.spells,
      }));
    });

    return () => {
      unsubVitals();
      unsubInventory();
      unsubSpells();
    };
  }, []);

  return state;
};
