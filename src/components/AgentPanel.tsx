"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentInfo, AgentRun } from "@/lib/types";
import { brandColor } from "@/lib/modelutil";
import Markdown from "./Markdown";
import Icon from "./Icons";

function Avatar({ a, size = 36 }: { a: AgentInfo; size?: number }) {
  const c = brandColor(a.brand);
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full font-semibold text-white ${a.status === "working" ? "working-ring" : ""}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 55%, #000))`, fontSize: size * 0.4 }}
    >
      {a.name.charAt(0)}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
          a.status === "working" ? "animate-pulse bg-amber-400" : a.status === "done" ? "bg-emerald-500" : a.status === "failed" ? "bg-red-500" : "bg-zinc-400"
        }`}
      />
    </span>
  );
}

const KIND_LABEL = { lead: "Lead", builder: "Builder", reviewer: "Reviewer" } as const;

export default function AgentPanel({ run, live }: { run: AgentRun; live: boolean }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"team" | "chat" | "work">("chat");
  const [view, setView] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === "chat" && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [run.feed.length, tab]);

  const working = run.agents.filter((a) => a.status === "working").length;
  const finished = run.agents.filter((a) => a.status === "done").length;
  const byName = (n: string) => run.agents.find((a) => a.name === n);

  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-white">
          <Icon name="agent" className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            Alex&apos;s team · {run.agents.length} agents
          </span>
          <span className={`block truncate text-xs ${live ? "shimmer-text" : "text-muted"}`}>
            {run.phase || "Assembling the team…"}
            {live && working > 0 ? ` · ${working} working` : ""}
            {!live && run.done ? ` · ${finished}/${run.agents.length} finished` : ""}
          </span>
        </span>
        <Icon name="chevron" className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line">
          {/* avatars strip */}
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
            {run.agents.map((a) => (
              <button
                key={a.name}
                onClick={() => {
                  setView(a.name);
                  setTab("work");
                }}
                className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"
                title={`${a.name} · ${a.role} · ${a.modelName}`}
              >
                <Avatar a={a} />
                <span className="w-full truncate text-[11px] font-medium">{a.name}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1 border-y border-line px-3 py-1.5 text-xs">
            {(
              [
                ["chat", "Team chat"],
                ["team", "Roster"],
                ["work", "Work"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${tab === k ? "bg-hov text-fg" : "text-muted hover:text-fg"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <div ref={feedRef} className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
              {run.feed.length === 0 && <p className="py-4 text-center text-xs text-muted">Waiting for the first message…</p>}
              {run.feed.map((f) =>
                f.kind === "phase" ? (
                  <div key={f.id} className="flex items-center gap-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <span className="h-px flex-1 bg-line" />
                    {f.text}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                ) : f.kind === "note" ? (
                  <div key={f.id} className="text-center text-[11px] text-muted">
                    {f.text}
                  </div>
                ) : (
                  <div key={f.id} className="anim-fade-in flex items-start gap-2">
                    {byName(f.from || "") ? <Avatar a={byName(f.from || "")!} size={24} /> : <span className="h-6 w-6" />}
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-soft px-3 py-2 text-[13px] leading-snug">
                      <div className="mb-0.5 text-[11px] text-muted">
                        <b className="text-fg">{f.from}</b> → {f.to === "all" ? "everyone" : f.to}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{f.text}</div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {tab === "team" && (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
              {run.agents.map((a) => (
                <div key={a.name} className="flex items-center gap-3 rounded-2xl border border-line bg-soft px-3 py-2.5">
                  <Avatar a={a} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {a.name}
                      <span className="rounded-md bg-hov px-1.5 py-0.5 text-[10px] font-medium text-muted">{KIND_LABEL[a.kind]}</span>
                    </div>
                    <div className="truncate text-xs text-muted">{a.role}</div>
                    <div className="truncate text-[11px] text-muted">
                      {a.modelName} · {a.brand}
                    </div>
                    {a.note && <div className="truncate text-[11px] text-accent">{a.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "work" && (
            <div className="p-3">
              <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
                {run.agents
                  .filter((a) => run.outputs[a.name])
                  .map((a) => (
                    <button
                      key={a.name}
                      onClick={() => setView(a.name)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${view === a.name ? "border-transparent bg-fg text-bg" : "border-line text-muted hover:bg-hov"}`}
                    >
                      {a.name}
                    </button>
                  ))}
              </div>
              {view && run.outputs[view] ? (
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-line bg-bg px-4 py-3">
                  <div className="mb-2 text-xs text-muted">
                    {view} · {byName(view)?.role}
                  </div>
                  <Markdown>{run.outputs[view]}</Markdown>
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-muted">Pick an agent to read their work.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
