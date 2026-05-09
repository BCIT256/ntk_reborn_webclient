import { useState, useEffect, useRef, useCallback } from "react";
import { eventBus } from "../utils/eventBus";
import { socket, entityNameCache } from "../socket";

interface ChatMessage {
  id: number;
  text: string;
  type: "system" | "broadcast" | "chat";
}

/** Slot labels: 1-0 then S1-S0 */
const HOTBAR_LABELS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S0",
];

const BottomHUD = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const addMessage = useCallback((text: string, type: ChatMessage["type"]) => {
    setMessages((prev) => {
      const id = nextId.current++;
      // Keep last 200 messages to prevent memory growth
      const next = [...prev, { id, text, type }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  // Subscribe to chat events from the EventBus
  useEffect(() => {
    const unsubSystem = eventBus.on("SystemMessage", (data) => {
      addMessage(data.message, "system");
    });
    const unsubBroadcast = eventBus.on("BroadcastMessage", (data) => {
      addMessage(data.message, "broadcast");
    });
    const unsubChat = eventBus.on("ChatNormal", (data) => {
      const entityId = Number(data.entity_id);
      const localId = Number(socket.localEntityId);
      const isLocal = entityId === localId;
      const name = isLocal ? "You" : entityNameCache.get(entityId) || entityId.toString();
      const prefix = `[${name}]`;
      addMessage(`${prefix} ${data.message}`, "chat");
    });
    // Listen for FocusChatInput event to programmatically focus the input
    const unsubFocus = eventBus.on("FocusChatInput", () => {
      inputRef.current?.focus();
    });

    return () => {
      unsubSystem();
      unsubBroadcast();
      unsubChat();
      unsubFocus();
    };
  }, [addMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputValue.trim();
      if (!text) {
        // Even if empty, blur so movement resumes immediately
        inputRef.current?.blur();
        return;
      }
      socket.send({ type: "Chat", payload: { message: text } });
      setInputValue("");
      // Auto-blur: return focus to the body so KeyboardManager resumes WASD
      inputRef.current?.blur();
    },
    [inputValue]
  );

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation on keydown so the KeyboardManager doesn't trigger
    // movement or hotbar actions while the user is typing.
    e.stopPropagation();
  }, []);

  const handleInputKeyUp = useCallback((e: React.KeyboardEvent) => {
    // Do NOT stop propagation on keyup! The KeyboardManager's window-level
    // keyup listener must see these events so it can clear keys from its
    // Set. Otherwise, if a user presses WASD while focused on chat and
    // releases while still focused, that key gets stuck as "held down"
    // in the KeyboardManager — causing permanent movement after blur.
    // We intentionally let keyup bubble to window here.
  }, []);

  const messageColor = (type: ChatMessage["type"]) => {
    switch (type) {
      case "system":
        return "text-yellow-300";
      case "broadcast":
        return "text-cyan-300";
      case "chat":
        return "text-white";
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-80 z-[100] flex flex-col font-mono select-none"
      style={{ pointerEvents: "auto" }}
    >
      {/* ── Chat Box ──────────────────────────────────────────────── */}
      <div className="h-32 bg-slate-900/80 border-t-2 border-slate-500 overflow-y-auto text-sm px-1 py-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`leading-tight ${messageColor(msg.type)}`}>
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* ── Chat Input + Hotbar Row ───────────────────────────────── */}
      <div className="flex items-stretch bg-slate-900/90 border-t-2 border-slate-500">
        {/* Chat input */}
        <form onSubmit={handleChatSubmit} className="flex-shrink-0 flex">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onKeyUp={handleInputKeyUp}
            placeholder="Say something..."
            maxLength={256}
            className="w-56 bg-slate-950 border-r-2 border-slate-500 text-white text-sm px-2 py-1 outline-none placeholder:text-slate-500"
          />
        </form>

        {/* Hotbar slots */}
        <div className="flex gap-[2px] px-1 py-1 overflow-x-auto">
          {HOTBAR_LABELS.map((label, i) => (
            <div
              key={i}
              className="w-7 h-7 bg-slate-800 border-2 border-slate-500 flex items-end justify-end p-[1px] flex-shrink-0"
              title={`Hotbar slot ${i + 1}`}
            >
              <span className="text-[8px] text-slate-400 leading-none">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BottomHUD;
