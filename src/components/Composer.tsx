"use client";

import { useEffect, useRef } from "react";
import type { Mode } from "@/lib/types";
import Icon from "./Icons";

export const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "code", label: "Code", icon: "code" },
  { id: "image", label: "Image", icon: "image" },
  { id: "agent", label: "Agent", icon: "agent" },
];

export function ModeTabs({ mode, onChange, compact = false }: { mode: Mode; onChange: (m: Mode) => void; compact?: boolean }) {
  return (
    <div className="inline-flex rounded-2xl border border-line bg-soft p-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1.5 rounded-xl font-medium transition ${compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm sm:px-5"} ${
            mode === m.id ? "bg-card text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
          }`}
        >
          <Icon name={m.icon} className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          <span className={compact ? "hidden sm:inline" : ""}>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  mode: Mode;
  files: { name: string; text: string }[];
  onFiles: (f: FileList) => void;
  onRemoveFile: (i: number) => void;
}

const PLACEHOLDER: Record<Mode, string> = {
  chat: "Ask anything…",
  code: "Describe what you want to build…",
  image: "Describe the image you want to create…",
  agent: "Give Alex's team a big task, e.g. “Build a 3D portfolio website”…",
};

export default function Composer({ value, onChange, onSend, onStop, busy, mode, files, onFiles, onRemoveFile }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  const canSend = value.trim().length > 0 || files.length > 0;

  return (
    <div className="rounded-[26px] border border-line bg-card p-2 shadow-[var(--shadow)] transition focus-within:border-accent/60">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2 pb-1 pt-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-xl bg-soft px-2.5 py-1 text-xs">
              <Icon name="clip" className="h-3 w-3 text-muted" />
              <span className="max-w-[160px] truncate">{f.name}</span>
              <button onClick={() => onRemoveFile(i)} className="text-muted hover:text-fg" aria-label="Remove file">
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={ta}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
            e.preventDefault();
            if (!busy && canSend) onSend();
          }
        }}
        placeholder={PLACEHOLDER[mode]}
        className="block max-h-[220px] min-h-[48px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted"
      />
      <div className="flex items-center justify-between px-1.5 pb-0.5 pt-1">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.c,.cpp,.go,.rs,.rb,.php,.sh,.yml,.yaml,.xml,.sql,.log,text/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl p-2.5 text-muted transition hover:bg-hov hover:text-fg"
            aria-label="Attach text file"
            title="Attach text / code file"
          >
            <Icon name="clip" className="h-[18px] w-[18px]" />
          </button>
        </div>
        {busy ? (
          <button
            onClick={onStop}
            className="grid h-10 w-10 place-items-center rounded-full bg-fg text-bg transition hover:opacity-80"
            aria-label="Stop"
          >
            <Icon name="stop" className="h-4 w-4" fill />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white shadow-lg shadow-accent/30 transition hover:scale-105 disabled:scale-100 disabled:opacity-35 disabled:shadow-none"
            aria-label="Send"
          >
            <Icon name="send" className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </button>
        )}
      </div>
    </div>
  );
}
