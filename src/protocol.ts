export interface ClientMessages {
  LoginRequest: { username: string, password_hash: string };
  Move: { direction: number };
  Action: { action_type: number, target_id: number | null, spell_id: number | null };
  Chat: { message: string };
  DialogResponse: { npc_id: number, response: number };
  MenuResponse: { menu_id: number, selected_index: number };
  UseItem: { inventory_slot: number, target_id: number | null };
  RequestEquipItem: { inventory_slot: number, target_equip_slot: number };
  RequestUnequipItem: { equip_slot: number };
  RequestDropItem: { inventory_slot: number, amount: number };
}

export type ClientToServer = {
  [K in keyof ClientMessages]: { type: K; payload: ClientMessages[K] }
}[keyof ClientMessages];

export interface ServerMessages {
  LoginSuccess: { entity_id: number };
  MapChange: { map_id: number };
  SpawnCharacter: {
    entity_id: number, x: number, y: number, direction: number, name: string,
    speed: number, state: number, sex: number, face: number, face_color: number,
    hair: number, hair_color: number, skin_color: number, equipment: number[],
    is_grouped: boolean, is_pk: boolean, name_color: number,
    graphic_id: string
  };
  EntityMove: { entity_id: number, x: number, y: number, direction: number };
  EntityRemove: { entity_id: number, is_death: boolean };
  PlayerPosition: { x: number, y: number, view_x: number, view_y: number };
  EntityHealthUpdate: { entity_id: number, damage: number, hp_percent: number, hit_type: number };
  PlayerVitalsUpdate: { hp: number, max_hp: number, mp: number, max_mp: number, xp: number, xp_next: number, gold: number, level: number };
  ChatNormal: { entity_id: number, message: string };
  SystemMessage: { message: string };
  DialogPopup: { npc_id: number, name: string, message: string };
  ShowMenu: { menu_id: number, title: string, options: string[] };
}

export type ServerToClient = {
  [K in keyof ServerMessages]: { type: K; payload: ServerMessages[K] }
}[keyof ServerMessages];
