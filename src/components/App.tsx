"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentEvent,
  AgentRun,
  ChatMsg,
  Conversation,
  KeyEntry,
  Mode,
  ModelInfo,
  ProviderId,
} from "@/lib/types";
import { detectProvider, PROVIDER_MAP } from "@/lib/providers";
import { modelsForMode, toLite } from "@/lib/modelutil";
import Sidebar from "./Sidebar";
import Composer, { ModeTabs } from "./Composer";
import Messages from "./Messages";
import ModelPicker from "./ModelPicker";
import SettingsModal from "./SettingsModal";
import Orb from "./Orb";
import Icon from "./Icons";

const LS = { keys: "orvix.keys", convs: "orvix.convs", prefs: "orvix.prefs", theme: "orvix.theme" };

type ImgMode = "chat" | "code" | "image";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

function providerCandidates(key: string, provider: ProviderId | "auto"): ProviderId[] {
  if (provider !== "auto") return [provider];
  if (key.startsWith("sk-") && !key.startsWith("sk-or-") && !key.startsWith("sk-ant-")) return ["openai", "deepseek", "moonshot"];
  const d = detectProvider(key);
  if (d) return [d];
  return ["mistral", "together", "openrouter", "groq", "cerebras"];
}

async function fetchModelsApi(provider: ProviderId, key: string): Promise<{ models: ModelInfo[]; freeTier?: boolean }> {
  const res = await fetch("/api/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, key }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return { models: j.models as ModelInfo[], freeTier: j.freeTier as boolean | undefined };
}

function reduceRun(r: AgentRun, ev: AgentEvent): AgentRun {
  const fid = r.feed.length;
  switch (ev.type) {
    case "team":
      return { ...r, agents: ev.agents };
    case "phase":
      return { ...r, phase: ev.label, feed: [...r.feed, { id: fid, kind: "phase", text: ev.label }] };
    case "status":
      return {
        ...r,
        agents: r.agents.map((a) =>
          a.name === ev.name
            ? { ...a, status: ev.status, note: ev.note, model: ev.model ?? a.model, modelName: ev.modelName ?? a.modelName }
            : a,
        ),
        feed: ev.note?.startsWith("switched") ? [...r.feed, { id: fid, kind: "note", text: `${ev.name} ${ev.note}` }] : r.feed,
      };
    case "message":
      return { ...r, feed: [...r.feed, { id: fid, kind: "message", from: ev.from, to: ev.to, text: ev.text }] };
    case "output":
      return { ...r, outputs: { ...r.outputs, [ev.name]: ev.text } };
    case "done":
      return { ...r, done: true, phase: "Finished" };
    default:
      return r;
  }
}

const SUGGESTIONS: Record<Mode, string[]> = {
  chat: ["Explain how transformers work, like I'm 12", "Plan a 3-day trip to Tokyo on a budget", "Write a punchy cold email for my SaaS", "Rust vs Go — which should I learn in 2026?"],
  code: ["Build a React todo app with drag & drop", "Write a Python script that renames photos by date", "Explain this regex: ^(?=.*\\d)(?=.*[a-z]).{8,}$", "Create a REST API in Node with JWT auth"],
  image: ["A neon-lit cyberpunk alley in the rain, cinematic", "A cozy cabin on a glowing aurora night, watercolor", "A glass orb floating above a desert at sunset", "Minimal logo of a fox made of geometric shapes"],
  agent: ["Build a stunning 3D landing page with Three.js — a floating solar system", "Create a complete snake game with a neon UI and leaderboard", "Design and code a responsive SaaS pricing page with animations", "Build a Pomodoro app with stats, themes and sounds"],
};

const GREETING: Record<Mode, string> = {
  chat: "What can I help you with?",
  code: "What shall we build today?",
  image: "What do you want to imagine?",
  agent: "Alex and his team are ready.",
};

function TeamControl({ n, onChange, models }: { n: number; onChange: (n: number) => void; models: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1">
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white">
        <Icon name="agent" className="h-3 w-3" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold">Alex + {n - 1} agents</div>
        <div className="hidden text-[11px] text-muted sm:block">best {Math.min(models, n)} of {models} models auto-picked</div>
      </div>
      <div className="ml-1 flex items-center rounded-lg border border-line bg-soft">
        <button onClick={() => onChange(Math.max(4, n - 1))} className="px-2 py-1 text-muted transition hover:text-fg" aria-label="Fewer agents">
          −
        </button>
        <span className="w-6 text-center text-xs font-semibold tabular-nums">{n}</span>
        <button onClick={() => onChange(Math.min(20, n + 1))} className="px-2 py-1 text-muted transition hover:text-fg" aria-label="More agents">
          +
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [selection, setSelection] = useState<Record<ImgMode, string>>({ chat: "auto", code: "auto", image: "auto" });
  const [teamSize, setTeamSize] = useState(12);
  const [dark, setDark] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [desktopNav, setDesktopNav] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const keysRef = useRef<KeyEntry[]>([]);

  /* ---------- hydrate ---------- */
  useEffect(() => {
    const k = load<KeyEntry[]>(LS.keys, []).map((e) => ({
      ...e,
      status: e.status === "loading" ? (e.models?.length ? "ok" : "error") : e.status,
    })) as KeyEntry[];
    setKeys(k);
    keysRef.current = k;
    const c = load<Conversation[]>(LS.convs, []);
    setConvs(c);
    const p = load<{ selection?: Record<ImgMode, string>; teamSize?: number; mode?: Mode; desktopNav?: boolean }>(LS.prefs, {});
    if (p.selection) setSelection((s) => ({ ...s, ...p.selection }));
    if (p.teamSize) setTeamSize(p.teamSize);
    if (p.mode) setMode(p.mode);
    if (p.desktopNav === false) setDesktopNav(false);
    setDark(document.documentElement.classList.contains("dark"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    keysRef.current = keys;
    if (hydrated) save(LS.keys, keys);
  }, [keys, hydrated]);
  useEffect(() => {
    if (hydrated) save(LS.prefs, { selection, teamSize, mode, desktopNav });
  }, [selection, teamSize, mode, desktopNav, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      if (save(LS.convs, convs)) return;
      const slim = convs.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({ ...m, images: undefined, agent: m.agent ? { ...m.agent, outputs: {} } : undefined })),
      }));
      save(LS.convs, slim);
    }, 500);
    return () => clearTimeout(t);
  }, [convs, hydrated]);

  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    save(LS.theme, d ? "dark" : "light");
    try {
      localStorage.setItem(LS.theme, d ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  /* ---------- models ---------- */
  const { allModels, keyMap } = useMemo(() => {
    const map = new Map<string, string>();
    const list: ModelInfo[] = [];
    for (const e of keys) {
      if (e.status === "error") continue;
      for (const m of e.models) {
        if (e.freeTier && !m.free) continue;
        if (map.has(m.key)) continue;
        map.set(m.key, e.key);
        list.push(m);
      }
    }
    return { allModels: list, keyMap: map };
  }, [keys]);

  const modeModels = useMemo(() => (mode === "agent" ? [] : modelsForMode(allModels, mode)), [allModels, mode]);

  const modelLabel = useCallback(
    (key?: string) => {
      if (!key) return null;
      const m = allModels.find((x) => x.key === key);
      return m ? { name: m.name, brand: m.brand } : null;
    },
    [allModels],
  );

  const addKeys = async (raw: string, provider: ProviderId | "auto"): Promise<string> => {
    const list = Array.from(new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter((k) => k.length >= 8)));
    if (!list.length) return "!Paste at least one API key.";
    const out: string[] = [];
    let ok = 0;
    for (const key of list) {
      if (keysRef.current.some((e) => e.key === key)) {
        out.push(`• ${key.slice(0, 8)}… is already connected`);
        continue;
      }
      let lastErr = "";
      let done = false;
      for (const p of providerCandidates(key, provider)) {
        try {
          const { models, freeTier } = await fetchModelsApi(p, key);
          const entry: KeyEntry = { id: uid(), provider: p, key, addedAt: Date.now(), status: "ok", models, freeTier };
          keysRef.current = [...keysRef.current, entry];
          setKeys(keysRef.current);
          const usable = freeTier ? models.filter((m) => m.free).length : models.length;
          out.push(`✓ ${PROVIDER_MAP[p].label}: ${usable} models ready${freeTier ? " (free tier — showing free models)" : ""}`);
          ok++;
          done = true;
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : "failed";
        }
      }
      if (!done) out.push(`✗ ${key.slice(0, 8)}…: ${lastErr}`);
    }
    return (ok ? "" : "!") + out.join("\n");
  };

  const refreshKey = async (id: string) => {
    const e = keysRef.current.find((k) => k.id === id);
    if (!e) return;
    setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, status: "loading" } : k)));
    try {
      const { models, freeTier } = await fetchModelsApi(e.provider, e.key);
      setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, status: "ok", error: undefined, models, freeTier } : k)));
    } catch (err) {
      setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, status: "error", error: err instanceof Error ? err.message : "failed" } : k)));
    }
  };

  const removeKey = (id: string) => setKeys((ks) => ks.filter((k) => k.id !== id));

  /* ---------- conversations ---------- */
  const active = convs.find((c) => c.id === activeId) || null;
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;

  const patch = useCallback((cid: string, mid: string, p: Partial<ChatMsg>) => {
    setConvs((prev) =>
      prev.map((c) => (c.id !== cid ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id !== mid ? m : { ...m, ...p })) })),
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [convs, activeId]);

  const newChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setInput("");
    setFiles([]);
  };
  const selectConv = (id: string) => {
    const c = convs.find((x) => x.id === id);
    if (!c) return;
    abortRef.current?.abort();
    setActiveId(id);
    setMode(c.mode);
    stick.current = true;
  };
  const deleteConv = (id: string) => {
    setConvs((cs) => cs.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  };

  const resolveCandidates = (m: ImgMode): ModelInfo[] => {
    const list = modelsForMode(allModels, m);
    const sel = selection[m];
    if (sel !== "auto") {
      const found = allModels.find((x) => x.key === sel);
      if (found) return [found];
    }
    const top = list.slice(0, 4);
    const free = list.filter((x) => x.free && !top.includes(x)).slice(0, 3);
    return [...top, ...free];
  };

  const addFiles = async (fl: FileList) => {
    const next: { name: string; text: string }[] = [];
    for (const f of Array.from(fl).slice(0, 5)) {
      if (f.size > 300_000) continue;
      next.push({ name: f.name, text: await f.text() });
    }
    setFiles((p) => [...p, ...next].slice(0, 5));
  };

  /* ---------- send ---------- */
  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if ((!text && !files.length) || busyId) return;
    const apiText = files.length
      ? `${text}\n\n${files.map((f) => `--- ${f.name} ---\n\`\`\`\n${f.text}\n\`\`\``).join("\n\n")}`
      : text;
    const userMsg: ChatMsg = {
      id: uid(),
      role: "user",
      content: apiText,
      shown: files.length ? text : undefined,
      files: files.length ? files.map((f) => f.name) : undefined,
      mode,
    };
    const asst: ChatMsg = { id: uid(), role: "assistant", content: "", mode };
    const history = (active?.messages ?? [])
      .filter((m) => !m.error && (m.content || m.images?.length))
      .map((m) => ({ role: m.role, content: m.content || "[image generated]" }));

    let cid = active?.id;
    if (!cid) {
      cid = uid();
      const conv: Conversation = {
        id: cid,
        title: (text || files[0]?.name || "New chat").slice(0, 48),
        mode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [userMsg, asst],
      };
      setConvs((p) => [conv, ...p]);
      setActiveId(cid);
    } else {
      const id = cid;
      setConvs((p) => p.map((c) => (c.id === id ? { ...c, mode, updatedAt: Date.now(), messages: [...c.messages, userMsg, asst] } : c)));
    }
    setInput("");
    setFiles([]);
    setBusyId(asst.id);
    stick.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const convId = cid;
    const fail = (msg: string) => patch(convId, asst.id, { content: msg, error: true });

    try {
      if (mode === "chat" || mode === "code") {
        const cands = resolveCandidates(mode);
        if (!cands.length) {
          fail("No models available yet. Open **API keys** and paste a key — all of its models will appear automatically.");
          setSettingsOpen(true);
          return;
        }
        let lastErr = "";
        let acc = "";
        let ok = false;
        const msgs = [...history, { role: "user" as const, content: apiText }];
        for (const m of cands) {
          if (ctrl.signal.aborted) break;
          acc = "";
          try {
            const res = await fetch("/api/chat", {
              method: "POST",
              headers: { "content-type": "application/json" },
              signal: ctrl.signal,
              body: JSON.stringify({ provider: m.provider, key: keyMap.get(m.key), model: m.id, mode, messages: msgs }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(j.error || `HTTP ${res.status}`);
            }
            patch(convId, asst.id, { model: m.key });
            const reader = res.body!.getReader();
            const dec = new TextDecoder();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                acc += dec.decode(value, { stream: true });
                patch(convId, asst.id, { content: acc });
              }
              ok = true;
            } catch (e) {
              if (ctrl.signal.aborted) throw e;
              if (acc) {
                patch(convId, asst.id, { content: acc + `\n\n_⚠ Stream interrupted: ${e instanceof Error ? e.message : "network error"}_` });
                ok = true;
              } else throw e;
            }
            break;
          } catch (e) {
            if (ctrl.signal.aborted) break;
            lastErr = `${m.name}: ${e instanceof Error ? e.message : "failed"}`;
          }
        }
        if (ctrl.signal.aborted) {
          patch(convId, asst.id, { content: acc || "_Stopped._" });
        } else if (!ok) {
          fail(`Couldn't get a response.\n\n${lastErr}\n\nTip: pick another model from the selector, or check that your key has access/credits.`);
        }
      } else if (mode === "image") {
        const cands = resolveCandidates("image");
        if (!cands.length) {
          fail("No image models found in your keys. Image generation works with OpenRouter image models and OpenAI, Google Imagen, Together or xAI keys.");
          return;
        }
        let lastErr = "";
        let ok = false;
        for (const m of cands) {
          if (ctrl.signal.aborted) break;
          try {
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "content-type": "application/json" },
              signal: ctrl.signal,
              body: JSON.stringify({ provider: m.provider, key: keyMap.get(m.key), model: m.id, prompt: apiText }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            patch(convId, asst.id, { images: j.images as string[], model: m.key, content: "" });
            ok = true;
            break;
          } catch (e) {
            if (ctrl.signal.aborted) break;
            lastErr = `${m.name}: ${e instanceof Error ? e.message : "failed"}`;
          }
        }
        if (ctrl.signal.aborted) patch(convId, asst.id, { content: "_Stopped._" });
        else if (!ok) fail(`Image generation failed.\n\n${lastErr}`);
      } else {
        // agent
        const keyByProvider: Record<string, string> = {};
        for (const e of keysRef.current) if (e.status === "ok" && !keyByProvider[e.provider]) keyByProvider[e.provider] = e.key;
        const lite = allModels.filter((m) => m.kind !== "image").map(toLite);
        if (!lite.length) {
          fail("No chat models available yet. Open **API keys** and paste a key first.");
          setSettingsOpen(true);
          return;
        }
        let run: AgentRun = { agents: [], feed: [], outputs: {}, phase: "Assembling the team…", done: false };
        patch(convId, asst.id, { agent: run });
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({ prompt: apiText, history: history.slice(-6), teamSize, keys: keyByProvider, models: lite }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let final = "";
        let errText = "";
        let lastPaint = 0;
        const paint = (force = false) => {
          const now = performance.now();
          if (!force && now - lastPaint < 60) return;
          lastPaint = now;
          patch(convId, asst.id, { agent: run, content: final });
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;
            let ev: AgentEvent;
            try {
              ev = JSON.parse(line) as AgentEvent;
            } catch {
              continue;
            }
            if (ev.type === "final") final += ev.delta;
            else if (ev.type === "error") errText = ev.text;
            else run = reduceRun(run, ev);
            paint(ev.type !== "final");
          }
        }
        run = { ...run, done: true };
        patch(convId, asst.id, errText && !final ? { agent: run, content: errText, error: true } : { agent: run, content: final });
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        setConvs((p) =>
          p.map((c) =>
            c.id !== convId
              ? c
              : { ...c, messages: c.messages.map((m) => (m.id === asst.id ? { ...m, content: m.content || "_Stopped._", agent: m.agent ? { ...m.agent, done: true } : m.agent } : m)) },
          ),
        );
      } else {
        fail(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setBusyId(null);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  if (!hydrated) return <div className="h-dvh w-full bg-bg" />;

  const imgMode = mode === "agent" ? null : (mode as ImgMode);
  const orbState = busyId ? "thinking" : input ? "speaking" : "idle";
  const noKeys = keys.length === 0;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg">
      <Sidebar
        convs={convs}
        activeId={activeId}
        onNew={newChat}
        onSelect={selectConv}
        onDelete={deleteConv}
        onSettings={() => setSettingsOpen(true)}
        dark={dark}
        onToggleTheme={toggleTheme}
        mobileOpen={mobileNav}
        desktopOpen={desktopNav}
        onClose={() => setMobileNav(false)}
        onCollapse={() => setDesktopNav(false)}
        keyCount={keys.length}
        modelCount={allModels.length}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="pt-safe relative z-30 flex items-center gap-1 px-2 py-2 sm:px-4">
          <button
            onClick={() => setMobileNav(true)}
            className="rounded-xl p-2.5 text-muted transition hover:bg-hov hover:text-fg lg:hidden"
            aria-label="Open menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          {!desktopNav && (
            <button
              onClick={() => setDesktopNav(true)}
              className="hidden rounded-xl p-2.5 text-muted transition hover:bg-hov hover:text-fg lg:block"
              aria-label="Open sidebar"
            >
              <Icon name="panel" className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {imgMode ? (
              <ModelPicker
                models={modeModels}
                selected={selection[imgMode]}
                onSelect={(k) => setSelection((s) => ({ ...s, [imgMode]: k }))}
                onOpenSettings={() => setSettingsOpen(true)}
                label={imgMode === "image" ? "Image models" : imgMode === "code" ? "Coding models" : "Chat models"}
              />
            ) : (
              <TeamControl n={teamSize} onChange={setTeamSize} models={allModels.filter((m) => m.kind !== "image").length} />
            )}
          </div>
          {!empty && (
            <button onClick={newChat} className="rounded-xl p-2.5 text-muted transition hover:bg-hov hover:text-fg" aria-label="New chat" title="New chat">
              <Icon name="edit" className="h-[18px] w-[18px]" />
            </button>
          )}
          <button onClick={toggleTheme} className="rounded-xl p-2.5 text-muted transition hover:bg-hov hover:text-fg" aria-label="Toggle theme">
            <Icon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`relative rounded-xl p-2.5 transition hover:bg-hov ${noKeys ? "text-accent" : "text-muted hover:text-fg"}`}
            aria-label="API keys"
          >
            <Icon name="key" className="h-[18px] w-[18px]" />
            {noKeys && <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-ping rounded-full bg-accent" />}
          </button>
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
          {empty ? (
            <div className="relative flex min-h-full flex-col items-center justify-center px-4 pb-10 pt-2">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-accent2/10 blur-3xl" />
              </div>
              <div className="relative flex w-full max-w-2xl flex-col items-center">
                <div className="anim-fade-in h-[min(34dvh,17rem)] w-[min(34dvh,17rem)] min-h-[9rem] min-w-[9rem] cursor-pointer sm:h-[min(38dvh,19rem)] sm:w-[min(38dvh,19rem)]">
                  <Orb state={orbState} dark={dark} />
                </div>
                <h1 className="anim-fade-up mt-1 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                  Hi, I&apos;m <span className="grad-text">Orvix</span>
                </h1>
                <p className="anim-fade-up mt-2 text-center text-[15px] text-muted sm:text-base" style={{ animationDelay: "60ms" }}>
                  {GREETING[mode]}
                </p>
                <div className="anim-fade-up mt-6" style={{ animationDelay: "120ms" }}>
                  <ModeTabs mode={mode} onChange={setMode} />
                </div>
                <div className="anim-fade-up mt-5 w-full" style={{ animationDelay: "180ms" }}>
                  <Composer
                    value={input}
                    onChange={setInput}
                    onSend={() => send()}
                    onStop={stop}
                    busy={!!busyId}
                    mode={mode}
                    files={files}
                    onFiles={addFiles}
                    onRemoveFile={(i) => setFiles((f) => f.filter((_, j) => j !== i))}
                  />
                </div>
                {noKeys ? (
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="anim-fade-up mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-4 py-3.5 text-left transition hover:bg-accent/10"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-white">
                      <Icon name="key" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Paste your API key to begin</span>
                      <span className="block text-xs text-muted">OpenRouter, OpenAI, Anthropic, Gemini, Groq and more — all their models appear automatically.</span>
                    </span>
                    <Icon name="arrow" className="h-4 w-4 text-accent" />
                  </button>
                ) : (
                  <div className="anim-fade-up mt-5 flex w-full flex-wrap justify-center gap-2" style={{ animationDelay: "240ms" }}>
                    {SUGGESTIONS[mode].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-full border border-line bg-card/70 px-3.5 py-2 text-left text-[13px] text-muted backdrop-blur transition hover:border-accent/40 hover:text-fg"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Messages messages={messages} busyId={busyId} dark={dark} modelLabel={modelLabel} />
          )}
        </div>

        {!empty && (
          <div className="px-3 pb-safe pt-1 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-2 flex justify-center">
                <ModeTabs mode={mode} onChange={setMode} compact />
              </div>
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => send()}
                onStop={stop}
                busy={!!busyId}
                mode={mode}
                files={files}
                onFiles={addFiles}
                onRemoveFile={(i) => setFiles((f) => f.filter((_, j) => j !== i))}
              />
              <p className="mt-1.5 text-center text-[11px] text-muted">AI can make mistakes. Verify important information.</p>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsModal keys={keys} onAdd={addKeys} onRemove={removeKey} onRefresh={refreshKey} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
