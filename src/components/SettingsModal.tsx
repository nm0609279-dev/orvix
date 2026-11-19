"use client";

import { useState } from "react";
import type { KeyEntry, ProviderId } from "@/lib/types";
import { detectProvider, PROVIDERS, PROVIDER_MAP } from "@/lib/providers";
import Icon from "./Icons";

interface Props {
  keys: KeyEntry[];
  onAdd: (raw: string, provider: ProviderId | "auto") => Promise<string>;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
  onClose: () => void;
}

const mask = (k: string) => (k.length <= 10 ? "••••••" : `${k.slice(0, 6)}••••••${k.slice(-4)}`);

export default function SettingsModal({ keys, onAdd, onRemove, onRefresh, onClose }: Props) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<ProviderId | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const first = text.split(/\s+/).filter(Boolean)[0];
  const detected = first ? detectProvider(first) : null;
  const total = keys.reduce((n, k) => n + k.models.length, 0);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await onAdd(text, provider);
    setBusy(false);
    const ok = !res.startsWith("!");
    setMsg({ ok, text: ok ? res : res.slice(1) });
    if (ok) setText("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-[var(--shadow)] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">API keys</h2>
            <p className="text-xs text-muted">
              {keys.length} key{keys.length === 1 ? "" : "s"} connected · {total} models available
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted transition hover:bg-hov hover:text-fg" aria-label="Close">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section>
            <label className="mb-2 block text-sm font-medium">Paste your key(s)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder={"sk-or-v1-…   (one key per line — OpenRouter, OpenAI, Anthropic, Gemini, Groq…)"}
              className="w-full resize-none rounded-2xl border border-line bg-soft px-4 py-3 font-mono text-[13px] outline-none transition placeholder:text-muted focus:border-accent"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId | "auto")}
                className="rounded-xl border border-line bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="auto">Auto-detect provider{detected ? ` (${PROVIDER_MAP[detected].label})` : ""}</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                onClick={submit}
                disabled={busy || !text.trim()}
                className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-accent/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <span className="dot-blink">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <>
                    <Icon name="bolt" className="h-4 w-4" fill /> Connect & load models
                  </>
                )}
              </button>
            </div>
            {msg && (
              <p className={`mt-3 whitespace-pre-line rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                {msg.text}
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted">
              🔒 Keys stay in this browser (localStorage). They are sent only to your Orvix server to be forwarded to the provider you chose — never stored on the server.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Connected</h3>
            {keys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No keys yet. Paste one above and all of its models will appear automatically.
              </div>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 rounded-2xl border border-line bg-soft px-3.5 py-3">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.status === "ok" ? "bg-emerald-500" : k.status === "loading" ? "animate-pulse bg-amber-400" : "bg-red-500"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                        {PROVIDER_MAP[k.provider].label}
                        {PROVIDER_MAP[k.provider].freeTier && <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">FREE TIER</span>}
                      </div>
                      <div className="truncate font-mono text-xs text-muted">{mask(k.key)}</div>
                      <div className="text-xs text-muted">
                        {k.status === "error" ? (
                          <span className="text-red-500">{k.error || "Failed"}</span>
                        ) : (
                          (() => {
                            const ms = k.freeTier ? k.models.filter((m) => m.free) : k.models;
                            return `${ms.length} models · ${ms.filter((m) => m.kind === "chat").length} chat · ${ms.filter((m) => m.kind === "code").length} code · ${ms.filter((m) => m.kind === "image").length} image${k.freeTier ? " · free tier" : ""}`;
                          })()
                        )}
                      </div>
                    </div>
                    <button onClick={() => onRefresh(k.id)} className="rounded-lg p-2 text-muted transition hover:bg-hov hover:text-fg" aria-label="Refresh models">
                      <Icon name="refresh" className={`h-4 w-4 ${k.status === "loading" ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => onRemove(k.id)} className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-500" aria-label="Remove key">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Supported providers</h3>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDERS.map((p) => (
                <a
                  key={p.id}
                  href={p.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:bg-hov hover:text-fg"
                >
                  {p.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
