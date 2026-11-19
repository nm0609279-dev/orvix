"use client";

import { useState } from "react";
import type { ChatMsg } from "@/lib/types";
import Markdown from "./Markdown";
import AgentPanel from "./AgentPanel";
import Icon, { Logo } from "./Icons";
import Orb from "./Orb";
import { BrandDot } from "./ModelPicker";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        } catch {
          /* ignore */
        }
      }}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-hov hover:text-fg"
    >
      <Icon name={ok ? "check" : "copy"} className="h-3.5 w-3.5" />
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

export default function Messages({
  messages,
  busyId,
  dark,
  modelLabel,
}: {
  messages: ChatMsg[];
  busyId: string | null;
  dark: boolean;
  modelLabel: (key?: string) => { name: string; brand: string } | null;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-6 sm:px-6">
      {messages.map((m) => {
        if (m.role === "user") {
          return (
            <div key={m.id} className="anim-fade-up flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-hov px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[80%]">
                {m.shown ?? m.content}
                {m.files && m.files.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.files.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-lg bg-card px-2 py-0.5 text-xs text-muted">
                        <Icon name="clip" className="h-3 w-3" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }
        const busy = busyId === m.id;
        const info = modelLabel(m.model);
        const waiting = busy && !m.content && !m.images?.length && !(m.agent && m.agent.agents.length);
        return (
          <div key={m.id} className="anim-fade-up flex gap-3 sm:gap-4">
            <div className="mt-0.5 h-8 w-8 shrink-0">
              {busy ? (
                <div className="-m-2 h-12 w-12">
                  <Orb state={m.content ? "speaking" : "thinking"} dark={dark} points={220} interactive={false} />
                </div>
              ) : (
                <Logo className="h-8 w-8" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {m.agent && <AgentPanel run={m.agent} live={busy} />}
              {waiting && (
                <div className="dot-blink flex h-8 items-center">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {m.error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{m.content}</div>
              ) : (
                m.content && <Markdown>{m.content}</Markdown>
              )}
              {m.images && m.images.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {m.images.map((src, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-2xl border border-line bg-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="Generated" className="h-auto w-full" />
                      <a
                        href={src}
                        download={`orvix-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-2 top-2 rounded-xl bg-black/60 p-2 text-white opacity-100 backdrop-blur transition sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Download"
                      >
                        <Icon name="download" className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {!busy && (m.content || m.images?.length) && !m.error && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.content && <CopyBtn text={m.content} />}
                  {info && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <BrandDot brand={info.brand} size={14} />
                      {info.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
