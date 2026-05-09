import NpcDialog from "./NpcDialog";
import NpcMenu from "./NpcMenu";

/**
 * InteractionOverlay — Renders the active NPC dialog or menu on top of the game canvas.
 *
 * Only one interaction can be active at a time. The overlay is mounted
 * inside the "playing" game state and sits above the PixiJS canvas.
 *
 * Click propagation is stopped inside each child component so clicks
 * don't fall through to the game canvas underneath.
 */
const InteractionOverlay = () => {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {/* Both components self-check their active state and render conditionally.
          pointer-events-auto is set inside each component only when visible. */}
      <div className="pointer-events-auto">
        <NpcDialog />
        <NpcMenu />
      </div>
    </div>
  );
};

export default InteractionOverlay;
