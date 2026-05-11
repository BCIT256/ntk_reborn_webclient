# Protobuf Networking Guide

Yuroxia now uses Protocol Buffers for the WebSocket game protocol. The old JSON
shape is no longer the intended transport. The server still keeps a small
internal Rust enum for gameplay messages, but WebSocket delivery is binary
`ntk.GamePacket` data.

## Why Protobuf

JSON was useful while the web client was moving quickly, but it has problems for
the long-term server:

- It is verbose and repeats field names on every packet.
- It depends on loose string-based message names.
- Type mismatches are easy to miss until runtime.
- High-frequency packets like movement, spawns, vitals, and animation updates
consume more bandwidth than they need.

Protobuf gives us a compact binary schema that both Rust and TypeScript can
generate code from. The schema is the contract.

## Important Files

```text
proto/game.proto
```

The central network schema. This is the source of truth for WebSocket packets.

```text
build.rs
```

Runs `prost-build` during Cargo builds and generates Rust types from
`proto/game.proto`.

```text
src/net/proto.rs
```

Includes the generated Rust code:

```rust
pub mod ntk {
    include!(concat!(env!("OUT_DIR"), "/ntk.rs"));
}
```

```text
src/net/protocol.rs
```

Contains the server's internal message enum and conversion code between internal
Rust messages and generated protobuf messages.

```text
src/net/websocket.rs
```

Encodes outbound packets as WebSocket binary frames and decodes inbound
protobuf client packets.

## Build Setup

The Rust dependencies are:

```toml
prost = "0.13"
prost-types = "0.13"

[build-dependencies]
prost-build = "0.13"
```

On build, Cargo runs `build.rs`, which compiles:

```text
proto/game.proto
```

into generated Rust under Cargo's `OUT_DIR`. Do not edit the generated file
directly. Edit `proto/game.proto` and rebuild.

## Packet Wrapper

Every WebSocket packet is wrapped in:

```protobuf
message GamePacket {
  oneof payload {
    MapChange map_change = 2;
    SpawnEntity spawn_entity = 3;
    EntityMove entity_move = 4;
    PlayerPosition player_position = 5;
    PlayerVitalsUpdate player_vitals_update = 6;
  }
}
```

The `oneof` means each network frame contains exactly one logical message.
Instead of sending JSON like:

```json
{ "type": "EntityMove", "payload": { "...": "..." } }
```

the server sends a binary-encoded `GamePacket` whose active payload is
`entity_move`.

## Direction Contract

Direction is codified in the schema and matches the legacy NexusTK/Mithia
server:

```protobuf
enum Direction {
  DIRECTION_UP = 0;
  DIRECTION_RIGHT = 1;
  DIRECTION_DOWN = 2;
  DIRECTION_LEFT = 3;
}
```

Plain language mapping:

```text
0 = Up
1 = Right
2 = Down
3 = Left
```

Rust still stores direction as a compact integer internally. Protobuf gives the
client a named enum so the meaning is clear.

## Entity State

The schema reserves an entity state enum:

```protobuf
enum EntityState {
  ENTITY_STATE_IDLE = 0;
  ENTITY_STATE_WALKING = 1;
  ENTITY_STATE_ATTACKING = 2;
  ENTITY_STATE_CASTING = 3;
  ENTITY_STATE_DEAD = 4;
}
```

This gives us a stable place to expose authoritative Rust/Lua state such as
walking, casting, attacking, and dead. Current movement packets already mark
movement as `ENTITY_STATE_WALKING`.

## Visual Schema

Characters and mobs use `SpawnEntity`:

```protobuf
message SpawnEntity {
  int32 entity_id = 1;
  bool is_local_player = 2;
  int32 x = 3;
  int32 y = 4;
  Direction direction = 5;
  Visuals visuals = 6;
  EntityState state = 7;
}
```

The `visuals` field tells the frontend which sprite assets to load:

```protobuf
message Visuals {
  int32 body = 1;
  int32 hair = 2;
  int32 armor = 3;
  int32 face = 4;
  int32 weapon = 5;
  int32 shield = 6;
  Colors colors = 7;
}
```

Example:

```text
body = 1  -> public/assets/sprites/body_1.json
hair = 5  -> public/assets/sprites/hair_5.json
face = 1  -> public/assets/sprites/face_1.json
```

This matches the atlas generator naming convention.

## Server To Client Messages

High-priority gameplay packets are included in `GamePacket`:

```text
LoginSuccess
MapChange
SpawnEntity
EntityMove
PlayerPosition
PlayerVitalsUpdate
EntityDirection
EntityRemove
EntityHealthUpdate
ChatNormal
SystemMessage
ShowMenu
ShowInput
SpawnFloorItem
BroadcastMessage
DialogPopup
InventoryAdd
InventoryRemove
EquipItem
PlaySound
PlayAnimation
SetWeather
```

These mirror the old internal `ServerMessage` enum, but they are delivered as
binary protobuf frames.

## Client To Server Messages

Client request payloads are also part of `GamePacket`:

```text
LoginRequest
MoveRequest
TurnRequest
ActionRequest
InteractRequest
ChatRequest
DialogResponse
MenuResponse
InputResponse
UseItemRequest
RequestEquipItem
RequestUnequipItem
RequestDropItem
```

The Rust backend decodes these into the existing authoritative `ClientMessage`
enum and then runs the same server-side logic as before.

## WebSocket Transport

Outbound WebSocket packets are now sent as:

```rust
Message::Binary(encoded_game_packet)
```

The server no longer sends gameplay packets as JSON text frames.

Inbound packets are decoded as protobuf binary frames. There is a temporary
UTF-8 check for old JSON clients during transition, but the target protocol is
binary protobuf.

## Rust Conversion Flow

The backend keeps game logic separate from transport encoding:

```text
game logic -> ServerMessage -> ToProto -> ntk.GamePacket -> WebSocket binary
```

The conversion trait is:

```rust
pub trait ToProto {
    type Proto;

    fn to_proto(&self) -> Self::Proto;
}
```

This keeps ECS, map systems, combat, Lua, and persistence code from depending
directly on generated protobuf structs.

## Adding A New Packet

To add a new WebSocket packet:

1. Add the message to `proto/game.proto`.
2. Add it to the `GamePacket.oneof payload`.
3. Run `cargo build` so `prost-build` regenerates Rust types.
4. Add or update the internal Rust `ServerMessage` or `ClientMessage` variant.
5. Add conversion code in `src/net/protocol.rs`.
6. Update the frontend generated protobuf bindings.

Do not manually invent one-off binary layouts in WebSocket code. The `.proto`
file is the contract.

## Frontend Notes

The frontend should generate TypeScript types from `proto/game.proto` and use
binary WebSocket frames:

```text
WebSocket.binaryType = "arraybuffer"
```

Inbound:

```text
ArrayBuffer -> Uint8Array -> GamePacket.decode(...)
```

Outbound:

```text
GamePacket.encode(packet).finish() -> WebSocket.send(bytes)
```

The frontend should switch on the active `GamePacket.payload` case instead of
checking a JSON `"type"` string.

## Compatibility Rule

The long-term rule is simple:

```text
WebSocket gameplay packets are protobuf binary frames.
```

JSON can still exist for HTTP assets, map JSON files, manifests, generated atlas
metadata, and tooling output. It should not be used for live gameplay transport.

