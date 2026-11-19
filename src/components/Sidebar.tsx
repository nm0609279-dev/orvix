"use client";

import type { Conversation } from "@/lib/types";
import Icon, { Logo } from "./Icons";

interface Props {
  convs: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  mobileOpen: boolean;
  desktopOpen: boolean;
  onClose: () => void;
  onCollapse: () => void;
  keyCount: number;
  modelCount: number;
}

const MODE_ICON = { chat: "chat", code: "code", image: "image", agent: "agent" } as const;

function group(convs: Conversation[]) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const buckets: [string, Conversation[]][] = [
    ["Today", []],
    ["Yesterday", []],
    ["Previous 7 days", []],
    ["Older", []],
  ];
  [...convs]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((c) => {
      const t = c.updatedAt;
      if (t >= startToday) buckets[0][1].push(c);
      else if (t >= startToday - day) buckets[1][1].push(c);
      else if (t >= startToday - 7 * day) buckets[2][1].push(c);
      else buckets[3][1].push(c);
    });
  return buckets.filter(([, l]) => l.length);
}

export default function Sidebar(p: Props) {
  const groups = group(p.convs);
  return (
    <>
      {p.mobileOpen && <div className="anim-fade-in fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={p.onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[86vw] flex-col border-r border-line bg-soft transition-all duration-300 lg:static lg:z-0 lg:max-w-none lg:translate-x-0 ${
          p.mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${p.desktopOpen ? "lg:w-[280px]" : "lg:w-0 lg:overflow-hidden lg:border-r-0"}`}
      >
        <div className="flex min-w-[280px] flex-1 flex-col overflow-hidden pt-safe">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight">Orvix</span>
            </div>
            <button
              onClick={() => {
                p.onClose();
                p.onCollapse();
              }}
              className="rounded-xl p-2 text-muted transition hover:bg-hov hover:text-fg"
              aria-label="Collapse sidebar"
            >
              <Icon name="panel" className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="px-3 pb-2 pt-2">
            <button
              onClick={() => {
                p.onNew();
                p.onClose();
              }}
              className="group flex w-full items-center gap-2.5 rounded-2xl border border-line bg-card px-3.5 py-3 text-sm font-medium shadow-sm transition hover:border-accent/50 hover:shadow-md"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-white">
                <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              New chat
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {groups.length === 0 && <p className="px-4 py-8 text-center text-xs text-muted">Your conversations will appear here.</p>}
            {groups.map(([label, list]) => (
              <div key={label} className="mb-3">
                <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
                {list.map((c) => (
                  <div
                    key={c.id}
                    className={`group relative flex items-center rounded-xl transition hover:bg-hov ${c.id === p.activeId ? "bg-hov" : ""}`}
                  >
                    <button
                      onClick={() => {
                        p.onSelect(c.id);
                        p.onClose();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                    >
                      <Icon name={MODE_ICON[c.mode]} className="h-4 w-4 shrink-0 text-muted" />
                      <span className="truncate text-sm">{c.title}</span>
                    </button>
                    <button
                      onClick={() => p.onDelete(c.id)}
                      className="mr-1.5 rounded-lg p-1.5 text-muted opacity-100 transition hover:bg-red-500/10 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </nav>

          <div className="space-y-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                p.onSettings();
                p.onClose();
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-line transition hover:ring-accent/50"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-hov text-accent">
                <Icon name="key" className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">API keys</span>
                <span className="block truncate text-xs text-muted">
                  {p.keyCount ? `${p.keyCount} connected · ${p.modelCount} models` : "Add a key to begin"}
                </span>
              </span>
              <Icon name="settings" className="h-4 w-4 text-muted" />
            </button>
            <button
              onClick={p.onToggleTheme}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted transition hover:bg-hov hover:text-fg"
            >
              <Icon name={p.dark ? "sun" : "moon"} className="h-4 w-4" />
              {p.dark ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
