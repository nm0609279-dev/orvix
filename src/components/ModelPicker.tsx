"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelInfo } from "@/lib/types";
import { brandColor } from "@/lib/modelutil";
import { PROVIDER_MAP } from "@/lib/providers";
import Icon from "./Icons";

export function BrandDot({ brand, size = 28 }: { brand: string; size?: number }) {
  const c = brandColor(brand);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: c, fontSize: size * 0.42 }}
    >
      {brand.charAt(0).toUpperCase()}
    </span>
  );
}

interface Props {
  models: ModelInfo[];
  selected: string; // "auto" or model key
  onSelect: (key: string) => void;
  onOpenSettings: () => void;
  label: string;
}

export default function ModelPicker({ models, selected, onSelect, onOpenSettings, label }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("All");
  const [shown, setShown] = useState(60);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const brands = useMemo(() => {
    const c = new Map<string, number>();
    models.forEach((m) => c.set(m.brand, (c.get(m.brand) || 0) + 1));
    return ["All", ...[...c.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b)];
  }, [models]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(
      (m) =>
        (brand === "All" || m.brand === brand) &&
        (!s || m.name.toLowerCase().includes(s) || m.id.toLowerCase().includes(s) || m.brand.toLowerCase().includes(s)),
    );
  }, [models, q, brand]);

  const current = selected === "auto" ? null : models.find((m) => m.key === selected);
  const best = models[0];

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setShown(60);
        }}
        className="flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[15px] font-semibold transition hover:bg-hov"
      >
        {current ? <BrandDot brand={current.brand} size={22} /> : <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white"><Icon name="bolt" className="h-3 w-3" fill /></span>}
        <span className="truncate">{current ? current.name : "Auto · best available"}</span>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="anim-fade-in fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
          <div className="anim-sheet md:anim-pop fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-[var(--shadow)] md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:max-h-[min(560px,75dvh)] md:w-[440px] md:rounded-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-muted">{models.length} models</div>
            </div>
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-soft px-3 py-2">
                <Icon name="search" className="h-4 w-4 text-muted" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(60);
                  }}
                  placeholder="Search model or brand…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            </div>
            {models.length > 0 && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
                {brands.slice(0, 24).map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setBrand(b);
                      setShown(60);
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                      brand === b ? "border-transparent bg-fg text-bg" : "border-line text-muted hover:bg-hov hover:text-fg"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {models.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-soft text-muted">
                    <Icon name="key" className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">No models yet</p>
                  <p className="mx-auto mt-1 max-w-[260px] text-xs text-muted">Paste an API key and every model it can access appears here automatically.</p>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onOpenSettings();
                    }}
                    className="mt-4 rounded-xl bg-gradient-to-r from-accent to-accent2 px-4 py-2 text-sm font-medium text-white"
                  >
                    Add API key
                  </button>
                </div>
              ) : (
                <>
                  {!q && brand === "All" && (
                    <Row
                      active={selected === "auto"}
                      onClick={() => {
                        onSelect("auto");
                        setOpen(false);
                      }}
                      left={
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white">
                          <Icon name="bolt" className="h-3.5 w-3.5" fill />
                        </span>
                      }
                      title="Auto · best available"
                      sub={best ? `Currently ${best.name} — falls back automatically` : ""}
                    />
                  )}
                  {filtered.slice(0, shown).map((m) => (
                    <Row
                      key={m.key}
                      active={selected === m.key}
                      onClick={() => {
                        onSelect(m.key);
                        setOpen(false);
                      }}
                      left={<BrandDot brand={m.brand} />}
                      title={m.name}
                      sub={`${m.brand} · ${PROVIDER_MAP[m.provider].label}`}
                      right={
                        <>
                          {m.free && <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">FREE</span>}
                          {m.kind === "code" && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">CODE</span>}
                        </>
                      }
                    />
                  ))}
                  {filtered.length > shown && (
                    <button onClick={() => setShown((s) => s + 80)} className="mt-1 w-full rounded-xl py-2 text-xs text-muted hover:bg-hov">
                      Show more ({filtered.length - shown})
                    </button>
                  )}
                  {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">No match</p>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  active,
  onClick,
  left,
  title,
  sub,
  right,
}: {
  active: boolean;
  onClick: () => void;
  left: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-hov ${active ? "bg-hov" : ""}`}
    >
      {left}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{right}</span>
      {active && <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />}
    </button>
  );
}
