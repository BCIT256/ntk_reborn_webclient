"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Terminal, X, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface LogEntry {
  id: string;
  type: "in" | "out";
  packetType: string;
  size: number;
  payload: any;
  timestamp: number;
}

interface DebugConsoleProps {
  onToggle: () => void;
}

const DebugConsole = ({ onToggle }: DebugConsoleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: "in" | "out", packetType: string, size: number, payload: any) => {
    setLogs((prev) => {
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(7),
        type,
        packetType,
        size,
        payload,
        timestamp: Date.now(),
      };
      return [newEntry, ...prev].slice(0, 500); // Keep last 500
    });
  }, []);

  // Expose addLog to the window so socket.ts can call it
  useEffect(() => {
    (window as any).addDebugLog = addLog;
    return () => {
      delete (window as any).addDebugLog;
    };
  }, [addLog]);

  useEffect(() => {
    if (isOpen && isExpanded) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen, isExpanded]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    onToggle();
  };

  const clearLogs = () => setLogs([]);

  const filteredLogs = logs.filter((log) =>
    log.packetType.toLowerCase().includes(filter.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 left-80 right-0 z-[300] flex flex-col max-h-[400px] bg-slate-950/90 border-t-2 border-slate-700 font-mono text-xs shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 select-none">
        <div className="flex items-center gap-2 text-emerald-400">
          <Terminal className="w-4 h-4" />
          <span className="font-bold tracking-widest uppercase">Network Debug Console</span>
          <Activity className="w-3 h-3 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-slate-400 hover:text-white"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-slate-400 hover:text-red-400"
            onClick={clearLogs}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-slate-400 hover:text-white"
            onClick={toggleOpen}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-1 bg-slate-900/50 flex items-center gap-2 border-b border-slate-800">
        <input
          type="text"
          placeholder="Filter packet type..."
          className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-300 outline-none focus:border-emerald-500 w-48"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-slate-500">|</span>
        <span className="text-slate-500">
          Logs: {logs.length}
        </span>
      </div>

      {/* Log Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-2 space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`group flex flex-col border-l-2 pl-2 py-1 transition-colors ${
                  log.type === "in"
                    ? "border-blue-500 bg-blue-500/5 hover:bg-blue-500/10"
                    : "border-amber-500 bg-amber-500/5 hover:bg-amber-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold uppercase ${
                        log.type === "in" ? "text-blue-400" : "text-amber-400"
                      }`}
                    >
                      {log.type === "in" ? "← IN" : "→ OUT"}
                    </span>
                    <span className="text-slate-300">{log.packetType}</span>
                  </div>
                  <div className="text-slate-500 text-[10px]">
                    {log.size} bytes • {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <pre className="mt-1 text-slate-400 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto scrollbar-hide">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-slate-600 italic">
                No packets captured.
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default DebugConsole;