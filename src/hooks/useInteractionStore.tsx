import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { eventBus } from "../utils/eventBus";
import { socket } from "../socket";

// ─── Types ────────────────────────────────────────────────────────────

interface DialogState {
  kind: "dialog";
  npcId: number;
  name: string;
  message: string;
}

interface MenuState {
  kind: "menu";
  menuId: number;
  title: string;
  options: string[];
}

type InteractionState = DialogState | MenuState | null;

interface InteractionContextValue {
  /** Currently active dialog/menu, or null if none. */
  active: InteractionState;
  /** Dismiss the current dialog and send the appropriate response. */
  respondDialog: (npcId: number, response: number) => void;
  /** Select a menu option and send the response. */
  respondMenu: (menuId: number, selectedIndex: number) => void;
}

// ─── Context ───────────────────────────────────────────────────────────

const InteractionContext = createContext<InteractionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export const InteractionProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<InteractionState>(null);
  const activeRef = useRef<InteractionState>(null);

  // Keep ref in sync so EventBus callbacks always see latest state
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // ── Subscribe to EventBus ──────────────────────────────────────────
  useEffect(() => {
    const unsubDialog = eventBus.on("DialogPopup", (data) => {
      setActive({
        kind: "dialog",
        npcId: data.npc_id,
        name: data.name,
        message: data.message,
      });
      eventBus.emit("DialogOpened");
    });

    const unsubMenu = eventBus.on("ShowMenu", (data) => {
      setActive({
        kind: "menu",
        menuId: data.menu_id,
        title: data.title,
        options: data.options,
      });
      eventBus.emit("DialogOpened");
    });

    return () => {
      unsubDialog();
      unsubMenu();
    };
  }, []);

  // ── Response handlers ──────────────────────────────────────────────

  const respondDialog = useCallback((npcId: number, response: number) => {
    socket.send({
      type: "DialogResponse",
      payload: { npc_id: npcId, response },
    });
    setActive(null);
    eventBus.emit("DialogClosed");
  }, []);

  const respondMenu = useCallback(
    (menuId: number, selectedIndex: number) => {
      socket.send({
        type: "MenuResponse",
        payload: { menu_id: menuId, selected_index: selectedIndex },
      });
      setActive(null);
      eventBus.emit("DialogClosed");
    },
    []
  );

  return (
    <InteractionContext.Provider
      value={{ active, respondDialog, respondMenu }}
    >
      {children}
    </InteractionContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────

export const useInteraction = (): InteractionContextValue => {
  const ctx = useContext(InteractionContext);
  if (!ctx) {
    throw new Error("useInteraction must be used within an InteractionProvider");
  }
  return ctx;
};
