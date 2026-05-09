import { useState, useCallback } from "react";
import { useGameState } from "@/hooks/useGameState";
import { socket } from "@/socket";

/**
 * InventoryGrid — 52-slot inventory grid in the classic NexusTK style.
 *
 * Items can be dragged from the grid and dropped onto the canvas area
 * to fire a RequestDropItem packet. Clicking an item selects it for
 * potential use.
 */
const InventoryGrid = () => {
  const { inventory } = useGameState();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Build a lookup map for quick slot access
  const itemMap = new Map(inventory.map((item) => [item.slot, item]));

  const TOTAL_SLOTS = 52;

  const handleDragStart = useCallback(
    (e: React.DragEvent, slot: number) => {
      const item = itemMap.get(slot);
      if (!item) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", JSON.stringify({ slot, name: item.name, quantity: item.quantity }));
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
    },
    [itemMap]
  );

  const handleSlotClick = useCallback(
    (e: React.MouseEvent, slot: number) => {
      e.stopPropagation();
      const item = itemMap.get(slot);
      if (!item) return;
      setSelectedSlot(slot);
      // Use the item (no target)
      socket.send({
        type: "UseItem",
        payload: { inventory_slot: slot, target_id: null },
      });
    },
    [itemMap]
  );

  return (
    <div
      className="grid grid-cols-4 gap-1 p-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
        const item = itemMap.get(i);
        const isSelected = selectedSlot === i;

        return (
          <div
            key={i}
            draggable={!!item}
            onDragStart={(e) => handleDragStart(e, i)}
            onClick={(e) => handleSlotClick(e, i)}
            className={`
              aspect-square border text-center flex flex-col items-center justify-center
              cursor-default select-none text-[10px] leading-tight
              transition-colors
              ${
                isSelected
                  ? "border-amber-500 bg-slate-700"
                  : item
                    ? "border-slate-500 bg-slate-800 hover:bg-slate-700 hover:border-slate-400"
                    : "border-slate-700 bg-slate-900"
              }
            `}
            title={item ? `${item.name} (x${item.quantity})` : `Slot ${i}`}
          >
            {item && (
              <>
                <span className="text-slate-200 truncate w-full px-0.5">
                  {item.name}
                </span>
                {item.quantity > 1 && (
                  <span className="text-amber-400">{item.quantity}</span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default InventoryGrid;
